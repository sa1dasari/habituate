package com.habituate.api.coach;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.HabitResponse;
import com.habituate.api.habits.HabitService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CoachService {

    private static final int MAX_CONTENT_LENGTH = 2000;
    // Kept short on purpose — this is cost/latency budget per request, not a
    // "memory limit" the user would notice; Claude still has the full stored
    // thread available via listMessages() when the app reopens the screen.
    private static final int MAX_HISTORY_MESSAGES = 16;
    private static final Set<String> ADJUSTABLE_FIELDS = Set.of("cadenceTarget", "weeklyTarget", "monthlyTarget");
    private static final int MAX_NAME_LENGTH = 60;

    // The small, fixed emoji set the user picks from (long-press any bubble)
    // AND the only emojis the AI's own local heuristic below ever picks from
    // for the user's messages — same set, so the chat only ever shows these
    // six reaction glyphs regardless of who placed them. (pom.xml targets
    // Java 21 — JEP 400 makes UTF-8 the JVM's default charset everywhere,
    // so these literals read correctly on any build machine.)
    private static final String EMOJI_FIRE = "🔥";      // fire
    private static final String EMOJI_HEART = "❤️";     // red heart
    private static final String EMOJI_LAUGH = "😂";     // face with tears of joy
    private static final String EMOJI_SURPRISE = "😮";  // face with open mouth
    private static final String EMOJI_THUMBS_UP = "👍"; // thumbs up
    private static final String EMOJI_HUNDRED = "💯";   // hundred points
    private static final String EMOJI_ROFL = "🤣";      // rolling on the floor laughing

    private static final Set<String> ALLOWED_REACTIONS = Set.of(
            EMOJI_FIRE, EMOJI_HEART, EMOJI_LAUGH, EMOJI_SURPRISE, EMOJI_THUMBS_UP, EMOJI_HUNDRED);

    // Cheap, maintainable, zero-API-call sentiment heuristic for the AI's
    // auto-reaction to the user's own messages (CLAUDE.md: never add a second
    // Anthropic round-trip just for this). Deliberately simple ordered
    // keyword buckets, not an ML sentiment model — checked in this order so a
    // message matching more than one bucket (e.g. "lol I totally bailed on
    // my streak today") resolves to the first, most specific match.
    private static final String REACTION_FIRE = EMOJI_FIRE; // streak / milestone
    private static final String REACTION_LAUGH = EMOJI_LAUGH; // funny / lighthearted
    private static final String REACTION_HUNDRED = EMOJI_HUNDRED; // effort / struggle / showing up anyway
    private static final String REACTION_HEART = EMOJI_HEART; // gratitude / affection
    private static final String REACTION_SURPRISE = EMOJI_SURPRISE; // surprise / disbelief
    private static final String REACTION_THUMBS_UP = EMOJI_THUMBS_UP; // default, nothing else matched

    private static final String[] MILESTONE_KEYWORDS = {
            "streak", "milestone", "longest", "new record", "personal record",
            "pr ", "finally hit", "crushed it", "nailed it", "hit my goal",
            "reached my goal", "100 days", "30 days", "7 days in a row"
    };
    private static final String[] FUNNY_KEYWORDS = {
            "lol", "lmao", "rofl", "haha", "hahaha", "funny", "joke", EMOJI_LAUGH, EMOJI_ROFL
    };
    private static final String[] STRUGGLE_KEYWORDS = {
            "tired", "exhausted", "struggl", "hard day", "rough day", "burnt out",
            "burnout", "overwhelm", "didn't have time", "missed", "failed",
            "give up", "giving up", "hate this", "sucks", "stressed", "anxious",
            "difficult", "hard to", "no motivation", "unmotivated"
    };
    private static final String[] GRATITUDE_KEYWORDS = {
            "thank", "grateful", "love this", "appreciate", "means a lot"
    };
    private static final String[] SURPRISE_KEYWORDS = {
            "can't believe", "cant believe", "shocked", "no way", "surprised",
            "whoa", "woah", "wow"
    };

    private final CoachMessageRepository coachMessageRepository;
    private final HabitRepository habitRepository;
    private final HabitService habitService;
    private final CheckInRepository checkInRepository;
    private final AnthropicClient anthropicClient;
    private final ObjectMapper objectMapper;

    public CoachService(
            CoachMessageRepository coachMessageRepository,
            HabitRepository habitRepository,
            HabitService habitService,
            CheckInRepository checkInRepository,
            AnthropicClient anthropicClient,
            ObjectMapper objectMapper) {
        this.coachMessageRepository = coachMessageRepository;
        this.habitRepository = habitRepository;
        this.habitService = habitService;
        this.checkInRepository = checkInRepository;
        this.anthropicClient = anthropicClient;
        this.objectMapper = objectMapper;
    }

    public List<CoachMessageResponse> listMessages(String userId) {
        List<CoachMessage> messages = coachMessageRepository.findByUserIdOrderByCreatedAtAsc(userId);
        Map<Long, String> habitNames = habitNameLookup(userId);
        return messages.stream()
                .map(m -> toResponse(m, habitNames.get(m.getHabitId())))
                .toList();
    }

    /** Permanent — there's no undo, the mobile client confirms this with the user before calling it. */
    @Transactional
    public void clearConversation(String userId) {
        coachMessageRepository.deleteByUserId(userId);
    }

    /**
     * Persists the user's question, calls the model with fresh grounding data
     * + recent thread history, and persists + returns the assistant's reply.
     * @Transactional matters here beyond the usual atomicity reason: if the
     * Anthropic call throws, rolling back the already-saved user message
     * prevents an orphaned trailing USER turn — the next call's history would
     * otherwise have two consecutive "user" turns, which the Messages API
     * rejects (it requires strict user/assistant alternation).
     */
    @Transactional
    public AskCoachResponse ask(String userId, String timezone, String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Message can't be empty");
        }
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("Message is too long (max " + MAX_CONTENT_LENGTH + " characters)");
        }

        CoachMessage userMessage = new CoachMessage(userId, CoachMessage.ROLE_USER, trimmed);
        // Local heuristic only — no extra Anthropic call, computed and saved
        // in the same transaction as the user's own message.
        userMessage.setAiReaction(computeAiReaction(trimmed));
        coachMessageRepository.save(userMessage);

        ZoneId zone = resolveZone(timezone);
        List<Habit> habits = habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userId);
        List<HabitSnapshot> snapshots = CoachContextBuilder.buildSnapshots(habits, checkInRepository, zone);

        AnthropicResponse response = anthropicClient.sendMessage(
                CoachPrompts.systemPrompt(snapshots),
                buildHistory(userId),
                CoachPrompts.tools()
        );

        String replyText = "";
        Map<String, Object> adjustmentInput = null;
        Map<String, Object> creationInput = null;
        if (response != null && response.content() != null) {
            for (AnthropicContentBlock block : response.content()) {
                if ("text".equals(block.type()) && block.text() != null) {
                    replyText = replyText.isEmpty() ? block.text() : replyText + "\n\n" + block.text();
                } else if ("tool_use".equals(block.type())) {
                    // The model is instructed to call at most one tool once, but if it
                    // misbehaves, only the first valid proposal of either kind wins —
                    // never both on the same message.
                    if (adjustmentInput == null && creationInput == null
                            && CoachPrompts.ADJUSTMENT_TOOL_NAME.equals(block.name())) {
                        adjustmentInput = block.input();
                    } else if (adjustmentInput == null && creationInput == null
                            && CoachPrompts.CREATION_TOOL_NAME.equals(block.name())) {
                        creationInput = block.input();
                    }
                }
            }
        }

        AdjustmentProposal adjustment = buildAdjustmentProposal(adjustmentInput, snapshots);
        CreationProposal creation = adjustment == null ? buildCreationProposal(creationInput) : null;

        if (replyText.isBlank()) {
            replyText = (adjustment != null || creation != null)
                    ? "Here's an idea based on your check-ins."
                    : "I don't have a specific read on that yet — try asking about one of your habits by name.";
        }

        CoachMessage assistantMessage = new CoachMessage(userId, CoachMessage.ROLE_ASSISTANT, replyText);
        if (adjustment != null) {
            assistantMessage.setProposalType(CoachMessage.PROPOSAL_ADJUST_HABIT);
            assistantMessage.setHabitId(adjustment.habitId());
            assistantMessage.setAdjustmentField(adjustment.field());
            assistantMessage.setAdjustmentCurrentValue(adjustment.currentValue());
            assistantMessage.setAdjustmentNewValue(adjustment.newValue());
            assistantMessage.setAdjustmentTitle(adjustment.title());
            assistantMessage.setAdjustmentDescription(adjustment.description());
            assistantMessage.setAdjustmentStatus(CoachMessage.ADJUSTMENT_PENDING);
        } else if (creation != null) {
            assistantMessage.setProposalType(CoachMessage.PROPOSAL_CREATE_HABIT);
            assistantMessage.setProposalPayload(writeCreationPayload(creation));
            assistantMessage.setAdjustmentTitle(creation.title());
            assistantMessage.setAdjustmentDescription(creation.description());
            assistantMessage.setAdjustmentStatus(CoachMessage.ADJUSTMENT_PENDING);
        }

        coachMessageRepository.save(assistantMessage);

        String habitName = habitNameFor(assistantMessage.getHabitId(), snapshots);
        return new AskCoachResponse(toResponse(userMessage, null), toResponse(assistantMessage, habitName));
    }

    @Transactional
    public CoachMessageResponse confirmProposal(String userId, Long messageId) {
        CoachMessage message = requireOwnedPendingProposal(userId, messageId);

        if (CoachMessage.PROPOSAL_CREATE_HABIT.equals(message.getProposalType())) {
            return confirmCreation(userId, message);
        }
        return confirmAdjustment(userId, message);
    }

    private CoachMessageResponse confirmAdjustment(String userId, CoachMessage message) {
        Habit habit = habitRepository.findById(message.getHabitId())
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + message.getHabitId()));
        if (!userId.equals(habit.getUserId())) {
            throw new ForbiddenException("Habit does not belong to user: " + userId);
        }

        switch (message.getAdjustmentField()) {
            case "weeklyTarget" -> habit.setWeeklyTarget(message.getAdjustmentNewValue());
            case "monthlyTarget" -> habit.setMonthlyTarget(message.getAdjustmentNewValue());
            default -> habit.setCadenceTarget(message.getAdjustmentNewValue());
        }
        habitRepository.save(habit);

        message.setAdjustmentStatus(CoachMessage.ADJUSTMENT_CONFIRMED);
        coachMessageRepository.save(message);
        return toResponse(message, habit.getName());
    }

    private CoachMessageResponse confirmCreation(String userId, CoachMessage message) {
        CreationProposal creation = readCreationPayload(message.getProposalPayload());
        if (creation == null) {
            throw new IllegalArgumentException("This suggestion is no longer valid.");
        }

        HabitResponse created = habitService.createHabit(userId, new CreateHabitRequest(
                creation.name(), creation.category(), "DAILY",
                creation.cadenceTarget(), creation.weeklyTarget(), creation.monthlyTarget(),
                creation.trackingMode(), null, null, null
        ));

        // Points the citation/habitId at the habit that now actually exists,
        // so the rest of the UI (and any later turn in this same thread) can
        // reference it like any other habit-grounded message.
        message.setHabitId(created.id());
        message.setAdjustmentStatus(CoachMessage.ADJUSTMENT_CONFIRMED);
        coachMessageRepository.save(message);
        return toResponse(message, created.name());
    }

    @Transactional
    public CoachMessageResponse rejectProposal(String userId, Long messageId) {
        CoachMessage message = requireOwnedPendingProposal(userId, messageId);
        message.setAdjustmentStatus(CoachMessage.ADJUSTMENT_REJECTED);
        coachMessageRepository.save(message);

        String habitName = message.getHabitId() == null
                ? null
                : habitRepository.findById(message.getHabitId()).map(Habit::getName).orElse(null);
        return toResponse(message, habitName);
    }

    /**
     * Sets or clears the authenticated user's own reaction on a message in
     * their thread — either their own USER bubble or the AI's ASSISTANT
     * reply, long-pressed in the mobile client. Re-derives ownership from
     * the message itself rather than trusting the client, same spirit as
     * GroupActivityService.cheer re-deriving group membership. Passing a
     * blank/null emoji clears it (the client re-sends the same emoji to
     * toggle it off, or this can be called with null directly).
     */
    @Transactional
    public CoachMessageResponse setUserReaction(String userId, Long messageId, String emoji) {
        CoachMessage message = coachMessageRepository.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException("Message not found: " + messageId));
        if (!userId.equals(message.getUserId())) {
            throw new ForbiddenException("Message does not belong to user: " + userId);
        }

        String cleaned = (emoji == null || emoji.isBlank()) ? null : emoji.trim();
        if (cleaned != null && !ALLOWED_REACTIONS.contains(cleaned)) {
            throw new IllegalArgumentException("Unsupported reaction: " + cleaned);
        }

        message.setUserReaction(cleaned);
        coachMessageRepository.save(message);

        String habitName = message.getHabitId() == null
                ? null
                : habitRepository.findById(message.getHabitId()).map(Habit::getName).orElse(null);
        return toResponse(message, habitName);
    }

    /**
     * Cheap, local, deterministic sentiment pick for the AI's auto-reaction
     * to the user's own message — ordered keyword-bucket matching, no LLM
     * call, no new tool schema, so this adds zero latency/cost to the
     * existing Anthropic round-trip. Case-insensitive substring checks only;
     * swap for something fancier later if it's ever worth it, but this is
     * intentionally not a sentiment ML model.
     */
    private String computeAiReaction(String content) {
        String lower = content.toLowerCase();
        if (containsAny(lower, MILESTONE_KEYWORDS)) return REACTION_FIRE;
        if (containsAny(lower, FUNNY_KEYWORDS)) return REACTION_LAUGH;
        if (containsAny(lower, STRUGGLE_KEYWORDS)) return REACTION_HUNDRED;
        if (containsAny(lower, GRATITUDE_KEYWORDS)) return REACTION_HEART;
        if (containsAny(lower, SURPRISE_KEYWORDS)) return REACTION_SURPRISE;
        return REACTION_THUMBS_UP;
    }

    private boolean containsAny(String haystack, String[] needles) {
        for (String needle : needles) {
            if (haystack.contains(needle)) return true;
        }
        return false;
    }

    private CoachMessage requireOwnedPendingProposal(String userId, Long messageId) {
        CoachMessage message = coachMessageRepository.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException("Message not found: " + messageId));
        if (!userId.equals(message.getUserId())) {
            throw new ForbiddenException("Message does not belong to user: " + userId);
        }
        if (!CoachMessage.ADJUSTMENT_PENDING.equals(message.getAdjustmentStatus())) {
            throw new IllegalArgumentException("This suggestion has already been acted on.");
        }
        return message;
    }

    private CoachMessageResponse toResponse(CoachMessage message, String habitName) {
        CreationHabitView creationHabit = CoachMessage.PROPOSAL_CREATE_HABIT.equals(message.getProposalType())
                ? toCreationHabitView(readCreationPayload(message.getProposalPayload()))
                : null;
        return CoachMessageResponse.from(message, habitName, creationHabit);
    }

    private record AdjustmentProposal(
            Long habitId, String field, Integer currentValue, int newValue, String title, String description) {
    }

    /**
     * Validates the model's tool-call input against the grounded habit list
     * before trusting any of it — habitId must be one we actually handed the
     * model, field must be one of the three real target columns, and a
     * no-op suggestion (newValue already equal to the current value) is
     * dropped rather than shown as if it were a real suggestion. Returns
     * null for "no adjustment" in all of those cases, including malformed
     * tool input from the model — the text reply still goes through either way.
     */
    private AdjustmentProposal buildAdjustmentProposal(Map<String, Object> input, List<HabitSnapshot> snapshots) {
        if (input == null) return null;

        try {
            Long habitId = ((Number) input.get("habitId")).longValue();
            String field = String.valueOf(input.get("field"));
            int newValue = ((Number) input.get("newValue")).intValue();
            String title = String.valueOf(input.get("title"));
            String description = String.valueOf(input.get("description"));

            if (!ADJUSTABLE_FIELDS.contains(field) || newValue <= 0) return null;

            HabitSnapshot snapshot = snapshots.stream()
                    .filter(s -> s.id().equals(habitId))
                    .findFirst()
                    .orElse(null);
            if (snapshot == null) return null;

            Integer currentValue = switch (field) {
                case "weeklyTarget" -> snapshot.weeklyTarget();
                case "monthlyTarget" -> snapshot.monthlyTarget();
                default -> snapshot.cadenceTarget();
            };
            if (newValue == (currentValue == null ? 0 : currentValue)) return null;

            return new AdjustmentProposal(habitId, field, currentValue, newValue, title, description);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private record CreationProposal(
            String name, String category, Integer cadenceTarget, Integer weeklyTarget,
            Integer monthlyTarget, String trackingMode, String title, String description) {
    }

    /**
     * Validates + defaults the model's creation tool-call input — mirrors
     * HabitService.createHabit's own defaulting (blank category → "General",
     * unrecognized trackingMode → "BOOLEAN") rather than re-trusting whatever
     * the model sent verbatim. Only `name` is required; everything else gets
     * a sane default so a minimally-specified request still proposes
     * something concrete for the user to confirm or correct.
     */
    private CreationProposal buildCreationProposal(Map<String, Object> input) {
        if (input == null) return null;

        try {
            String name = String.valueOf(input.get("name")).trim();
            if (name.isEmpty() || "null".equals(name)) return null;
            if (name.length() > MAX_NAME_LENGTH) {
                name = name.substring(0, MAX_NAME_LENGTH).trim();
            }

            String category = cleanOptionalString(input.get("category"));
            if (category == null) category = "General";

            Integer cadenceTarget = positiveIntOrNull(input.get("cadenceTarget"));
            Integer weeklyTarget = positiveIntOrNull(input.get("weeklyTarget"));
            Integer monthlyTarget = positiveIntOrNull(input.get("monthlyTarget"));
            // A habit needs at least one real target scale — default to a
            // plain daily habit (cadenceTarget=1) only when the model gave
            // none at all, same as HabitService.createHabit's own default.
            if (cadenceTarget == null && weeklyTarget == null && monthlyTarget == null) {
                cadenceTarget = 1;
            }

            String trackingMode = "COUNT".equalsIgnoreCase(String.valueOf(input.get("trackingMode")))
                    ? "COUNT" : "BOOLEAN";

            String title = cleanOptionalString(input.get("title"));
            if (title == null) title = "Create '" + name + "'";
            String description = cleanOptionalString(input.get("description"));
            if (description == null) description = "Creates a new habit called \"" + name + "\".";

            return new CreationProposal(name, category, cadenceTarget, weeklyTarget, monthlyTarget, trackingMode, title, description);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String cleanOptionalString(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        return (s.isEmpty() || "null".equals(s)) ? null : s;
    }

    private Integer positiveIntOrNull(Object value) {
        if (!(value instanceof Number number)) return null;
        int n = number.intValue();
        return n > 0 ? n : null;
    }

    private String writeCreationPayload(CreationProposal creation) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", creation.name());
        payload.put("category", creation.category());
        payload.put("cadenceTarget", creation.cadenceTarget());
        payload.put("weeklyTarget", creation.weeklyTarget());
        payload.put("monthlyTarget", creation.monthlyTarget());
        payload.put("trackingMode", creation.trackingMode());
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize habit creation proposal", ex);
        }
    }

    private CreationProposal readCreationPayload(String payload) {
        if (payload == null || payload.isBlank()) return null;
        try {
            Map<String, Object> map = objectMapper.readValue(payload, Map.class);
            return new CreationProposal(
                    (String) map.get("name"),
                    (String) map.get("category"),
                    (Integer) map.get("cadenceTarget"),
                    (Integer) map.get("weeklyTarget"),
                    (Integer) map.get("monthlyTarget"),
                    (String) map.get("trackingMode"),
                    null, null
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private CreationHabitView toCreationHabitView(CreationProposal creation) {
        if (creation == null) return null;
        return new CreationHabitView(
                creation.name(), creation.category(), creation.cadenceTarget(),
                creation.weeklyTarget(), creation.monthlyTarget(), creation.trackingMode()
        );
    }

    private List<Map<String, Object>> buildHistory(String userId) {
        List<CoachMessage> all = coachMessageRepository.findByUserIdOrderByCreatedAtAsc(userId);
        int from = Math.max(0, all.size() - MAX_HISTORY_MESSAGES);
        List<Map<String, Object>> turns = new ArrayList<>();
        for (CoachMessage m : all.subList(from, all.size())) {
            String role = CoachMessage.ROLE_USER.equals(m.getRole()) ? "user" : "assistant";
            turns.add(Map.of("role", role, "content", m.getContent()));
        }
        return turns;
    }

    private Map<Long, String> habitNameLookup(String userId) {
        return habitRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .collect(Collectors.toMap(Habit::getId, Habit::getName, (a, b) -> a));
    }

    private String habitNameFor(Long habitId, List<HabitSnapshot> snapshots) {
        if (habitId == null) return null;
        return snapshots.stream()
                .filter(s -> s.id().equals(habitId))
                .map(HabitSnapshot::name)
                .findFirst()
                .orElse(null);
    }

    private ZoneId resolveZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timezone.trim());
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }

}
