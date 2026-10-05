package com.habituate.api.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Sends through Expo's push service (https://exp.host/--/api/v2/push/send)
 * rather than calling Firebase Cloud Messaging directly — this is what lets
 * the mobile app receive reminders from inside Expo Go on iOS without a
 * development build (Android still needs a dev build for remote push as of
 * Expo SDK 53+, an Expo Go platform limitation, not something this service
 * can work around).
 *
 * Only handles the immediate per-message response Expo returns synchronously
 * (a malformed/clearly-dead token comes back as an error right away). Full
 * delivery-receipt polling (Expo's two-step ticket→receipt flow, which also
 * catches a token that *was* valid but was since uninstalled) is a known v1
 * simplification — stale tokens from that case will just keep failing
 * silently until Expo's own token lifecycle catches up, not a correctness bug.
 */
@Service
public class ExpoPushService {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushService.class);
    private static final String ENDPOINT = "https://exp.host/--/api/v2/push/send";
    private static final int MAX_BATCH_SIZE = 100;

    private final RestTemplate restTemplate = new RestTemplate();
    private final PushTokenRepository pushTokenRepository;

    public ExpoPushService(PushTokenRepository pushTokenRepository) {
        this.pushTokenRepository = pushTokenRepository;
    }

    public void send(List<ExpoPushMessage> messages) {
        if (messages.isEmpty()) {
            return;
        }
        for (int start = 0; start < messages.size(); start += MAX_BATCH_SIZE) {
            List<ExpoPushMessage> batch = messages.subList(start, Math.min(start + MAX_BATCH_SIZE, messages.size()));
            sendBatch(batch);
        }
    }

    @SuppressWarnings("unchecked")
    private void sendBatch(List<ExpoPushMessage> batch) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        try {
            Map<String, Object> response = restTemplate.postForObject(
                    ENDPOINT, new HttpEntity<>(batch, headers), Map.class);
            if (response == null) {
                return;
            }
            Object data = response.get("data");
            if (!(data instanceof List<?> tickets)) {
                return;
            }
            for (int i = 0; i < tickets.size() && i < batch.size(); i++) {
                Object ticket = tickets.get(i);
                if (!(ticket instanceof Map<?, ?> ticketMap)) {
                    continue;
                }
                if (!"ok".equals(ticketMap.get("status"))) {
                    handleFailedTicket(batch.get(i).to(), (Map<String, Object>) ticketMap);
                }
            }
        } catch (Exception e) {
            log.warn("Expo push send failed for a batch of {}: {}", batch.size(), e.getMessage());
        }
    }

    private void handleFailedTicket(String token, Map<String, Object> ticket) {
        Object details = ticket.get("details");
        String errorCode = (details instanceof Map<?, ?> detailsMap) ? String.valueOf(detailsMap.get("error")) : null;
        if ("DeviceNotRegistered".equals(errorCode)) {
            pushTokenRepository.deleteByToken(token);
            log.info("Removed stale push token (DeviceNotRegistered)");
        } else {
            log.warn("Expo push ticket error for a token: {}", ticket.get("message"));
        }
    }
}
