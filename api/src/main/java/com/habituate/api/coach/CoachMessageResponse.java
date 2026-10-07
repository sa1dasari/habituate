package com.habituate.api.coach;

import java.time.Instant;

/**
 * groundingLabel (e.g. "Your check-ins · Morning Walk · Last 7 days") only
 * renders on the mobile data-citation row for an ADJUST_HABIT proposal — a
 * CREATE_HABIT proposal's habitId (set once confirmed, pointing at the newly
 * created habit) has no check-in history yet to cite.
 */
public record CoachMessageResponse(
        Long id,
        String role,
        String content,
        Long habitId,
        String habitName,
        String groundingLabel,
        String proposalType,
        CreationHabitView creationHabit,
        String adjustmentField,
        Integer adjustmentCurrentValue,
        Integer adjustmentNewValue,
        String adjustmentTitle,
        String adjustmentDescription,
        String adjustmentStatus,
        Instant createdAt
) {
    public static CoachMessageResponse from(CoachMessage message, String habitName, CreationHabitView creationHabit) {
        boolean isAdjustment = CoachMessage.PROPOSAL_ADJUST_HABIT.equals(message.getProposalType());
        String groundingLabel = (isAdjustment && message.getHabitId() != null && habitName != null)
                ? "Your check-ins · " + habitName + " · Last 7 days"
                : null;

        return new CoachMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getHabitId(),
                habitName,
                groundingLabel,
                message.getProposalType(),
                creationHabit,
                message.getAdjustmentField(),
                message.getAdjustmentCurrentValue(),
                message.getAdjustmentNewValue(),
                message.getAdjustmentTitle(),
                message.getAdjustmentDescription(),
                message.getAdjustmentStatus(),
                message.getCreatedAt()
        );
    }
}
