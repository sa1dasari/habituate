package com.habituate.api.groups;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Backs the Profile page's "Shared progress" feed — see CLAUDE.md's groups/social architecture note. */
@RestController
@RequestMapping("/api/groups/activity")
public class GroupActivityController {

    private final GroupActivityService groupActivityService;

    public GroupActivityController(GroupActivityService groupActivityService) {
        this.groupActivityService = groupActivityService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public List<GroupActivityItem> recentActivity(HttpServletRequest req) {
        return groupActivityService.recentActivity(userId(req));
    }

    @PostMapping("/{checkInId}/cheer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cheer(HttpServletRequest req, @PathVariable Long checkInId) {
        groupActivityService.cheer(userId(req), checkInId);
    }

    @DeleteMapping("/{checkInId}/cheer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uncheer(HttpServletRequest req, @PathVariable Long checkInId) {
        groupActivityService.uncheer(userId(req), checkInId);
    }
}
