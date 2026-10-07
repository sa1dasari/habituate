package com.habituate.api.coach;

import java.util.List;
import java.util.Map;

/**
 * System prompt + tool schemas for Ask Habituate. The non-causal-language
 * rule here is the same one CLAUDE.md carries forward from the deleted
 * correlation engine ("never 'X causes Y'... only 'you complete Y on X% of
 * the days you complete X'") — it's a hard product requirement, not a style
 * preference. This prompt (plus the computed HabitSnapshot data it's built
 * from, and the JSON-schema validation every tool call goes through before
 * CoachService trusts any of it) is this app's actual anti-hallucination
 * mechanism — not a separate reference document, since nothing here is a
 * static fact a doc could capture; it's "ground claims in the real,
 * per-request data" plus "never guess at structured output the schema
 * already constrains."
 */
final class CoachPrompts {

    private CoachPrompts() {
    }

    static final String ADJUSTMENT_TOOL_NAME = "propose_habit_adjustment";
    static final String CREATION_TOOL_NAME = "propose_habit_creation";

    /**
     * Not an enforced enum (HabitService.createHabit accepts any free-text
     * category — see Habit.java), just steered toward the app's existing
     * set so a new habit's icon/category grouping stays consistent with
     * what HabitsScreen already shows, matching mobile's own
     * constants/habitCategories.js list.
     */
    private static final List<String> SUGGESTED_CATEGORIES = List.of(
            "Health", "Fitness", "Nutrition", "Sleep", "Mindfulness", "Productivity",
            "Learning", "Career", "Finance", "Creativity", "Social", "Home",
            "Digital Wellbeing", "Other"
    );

    static String systemPrompt(List<HabitSnapshot> snapshots) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
                You are "Ask Habituate", a habit coach inside the Habituate app. You answer \
                the user's questions about their own habit-tracking data, and can help them \
                create new habits or adjust existing ones — always with their explicit confirmation.

                Ground every factual claim ONLY in the habit data listed below — never invent \
                numbers, streaks, or patterns that aren't directly supported by it. If the data \
                doesn't answer the question, say so plainly instead of guessing.

                Tone: encouraging, concise (2-4 sentences), non-judgmental. Never shame the user \
                for missed days or use "failure"-type language. Never use causal language like \
                "X causes Y" or "X helps you do Y" — only descriptive or correlational framing, \
                e.g. "you complete Y on X%% of the days you complete X", or hedged phrasing like \
                "could make mornings more manageable".

                You have two tools, and may call AT MOST ONE of them, AT MOST ONCE, per reply:

                1. %s — if and only if you have one specific, concrete, small adjustment to \
                suggest to an EXISTING habit's target (for example lowering a weekly or daily \
                target to make it easier to hit consistently). Only propose an adjustment for a \
                habit that actually appears in the data below, using its exact habitId.

                2. %s — if and only if the user has asked you to create a NEW habit. Before \
                calling this tool, make sure you actually know what to create: if the user's \
                request is vague (e.g. just "create a habit" with no name, or no sense of how \
                often), ask a short clarifying question in plain text first — don't call the tool \
                yet. Once you know at least a clear name and how often (daily, N times a week, or \
                N times a month), you may call it even if the user didn't specify every field — \
                fill in reasonable defaults for anything unstated (category from this app's \
                existing set: %s; tracking mode BOOLEAN unless the user describes something \
                countable like reps or applications, which is COUNT) and say what you defaulted \
                in the card's description so the user can correct it before confirming.

                Nothing from either tool is ever applied automatically — the user must explicitly \
                confirm the proposal in the app before anything changes or gets created. If \
                neither applies, just reply in text with no tool call.

                The user's current habit data:
                """.formatted(ADJUSTMENT_TOOL_NAME, CREATION_TOOL_NAME, String.join(", ", SUGGESTED_CATEGORIES)));

        if (snapshots.isEmpty()) {
            sb.append("(No habits tracked yet.)\n");
        } else {
            for (HabitSnapshot snapshot : snapshots) {
                sb.append(formatSnapshot(snapshot));
            }
        }

        return sb.toString();
    }

    private static String formatSnapshot(HabitSnapshot s) {
        return """
                - habitId %d: "%s" (category: %s, tracking mode: %s)
                  Daily target: %s | Weekly target: %s | Monthly target: %s
                  Current streak: %d days (longest: %d days)
                  Last 7 days: %d of %d days active
                  Last 30 days: %d of %d days active

                """.formatted(
                s.id(), s.name(), s.category(), s.trackingMode(),
                s.cadenceTarget(),
                s.weeklyTarget() == null ? "not set" : String.valueOf(s.weeklyTarget()),
                s.monthlyTarget() == null ? "not set" : String.valueOf(s.monthlyTarget()),
                s.currentStreak(), s.longestStreak(),
                s.completedLast7(), s.possibleLast7(),
                s.completedLast30(), s.possibleLast30()
        );
    }

    static List<Map<String, Object>> tools() {
        return List.of(adjustmentTool(), creationTool());
    }

    private static Map<String, Object> adjustmentTool() {
        Map<String, Object> properties = Map.of(
                "habitId", Map.of(
                        "type", "integer",
                        "description", "id of the habit this adjustment applies to, matching one habitId from the provided habit data"
                ),
                "field", Map.of(
                        "type", "string",
                        "enum", List.of("cadenceTarget", "weeklyTarget", "monthlyTarget"),
                        "description", "which target field to change"
                ),
                "newValue", Map.of(
                        "type", "integer",
                        "description", "the new value for that field — a positive integer"
                ),
                "title", Map.of(
                        "type", "string",
                        "description", "short title for the suggestion card, e.g. 'Lower your weekly target'"
                ),
                "description", Map.of(
                        "type", "string",
                        "description", "one sentence describing the concrete change, e.g. 'Set your weekly target to 2 instead of 3.'"
                )
        );

        Map<String, Object> schema = Map.of(
                "type", "object",
                "properties", properties,
                "required", List.of("habitId", "field", "newValue", "title", "description")
        );

        return Map.of(
                "name", ADJUSTMENT_TOOL_NAME,
                "description", "Propose a single concrete, small adjustment to one of the user's EXISTING habit targets. Only call this when you have a specific, data-grounded suggestion.",
                "input_schema", schema
        );
    }

    private static Map<String, Object> creationTool() {
        Map<String, Object> properties = Map.ofEntries(
                Map.entry("name", Map.of(
                        "type", "string",
                        "description", "the new habit's name, as a short natural phrase a person would read on a habit tracker card (e.g. 'Drink Water', 'Evening Walk') — Title Case words separated by spaces, NEVER snake_case or a code-style identifier. Base it on what the user described, don't invent or embellish it."
                )),
                Map.entry("category", Map.of(
                        "type", "string",
                        "description", "a category for the habit — prefer one of: " + String.join(", ", SUGGESTED_CATEGORIES)
                )),
                Map.entry("cadenceTarget", Map.of(
                        "type", "integer",
                        "description", "times per day, if this is a daily habit (e.g. 1 for most habits, higher for something like 'drink water 8x/day'). Omit if this habit is weekly/monthly-only."
                )),
                Map.entry("weeklyTarget", Map.of(
                        "type", "integer",
                        "description", "times per week, only if the user described a weekly cadence (e.g. 'gym 3x a week')"
                )),
                Map.entry("monthlyTarget", Map.of(
                        "type", "integer",
                        "description", "times per month, only if the user described a monthly cadence (e.g. '50 job applications this month')"
                )),
                Map.entry("trackingMode", Map.of(
                        "type", "string",
                        "enum", List.of("BOOLEAN", "COUNT"),
                        "description", "BOOLEAN for a simple did-it-happen habit (the default); COUNT only if the user described logging a quantity, like reps or applications"
                )),
                Map.entry("title", Map.of(
                        "type", "string",
                        "description", "short title for the suggestion card, e.g. \"Create 'Evening Walk'\""
                )),
                Map.entry("description", Map.of(
                        "type", "string",
                        "description", "one sentence summarizing what will be created, naming anything you defaulted that the user didn't specify"
                ))
        );

        Map<String, Object> schema = Map.of(
                "type", "object",
                "properties", properties,
                "required", List.of("name", "title", "description")
        );

        return Map.of(
                "name", CREATION_TOOL_NAME,
                "description", "Propose creating a brand-new habit. Only call this once you know at least a clear name and a sense of how often, after asking a clarifying question first if the user's request was too vague.",
                "input_schema", schema
        );
    }
}
