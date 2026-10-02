package com.habituate.api.groups;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/friendships")
public class FriendshipController {

    private final FriendshipService friendshipService;

    public FriendshipController(FriendshipService friendshipService) {
        this.friendshipService = friendshipService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public List<FriendshipResponse> listFriends(HttpServletRequest req) {
        return friendshipService.listFriends(userId(req));
    }

    @GetMapping("/pending")
    public List<FriendshipResponse> listPending(HttpServletRequest req) {
        return friendshipService.listPendingRequests(userId(req));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FriendshipResponse sendRequest(HttpServletRequest req, @RequestBody CreateFriendRequest request) {
        return friendshipService.sendRequest(userId(req), request.email());
    }

    @PostMapping("/{id}/accept")
    public FriendshipResponse accept(HttpServletRequest req, @PathVariable Long id) {
        return friendshipService.respond(userId(req), id, true);
    }

    @PostMapping("/{id}/decline")
    public FriendshipResponse decline(HttpServletRequest req, @PathVariable Long id) {
        return friendshipService.respond(userId(req), id, false);
    }
}
