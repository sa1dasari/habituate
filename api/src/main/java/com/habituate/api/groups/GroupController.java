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
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public List<GroupResponse> listMyGroups(HttpServletRequest req) {
        return groupService.listMyGroups(userId(req));
    }

    @GetMapping("/pending")
    public List<GroupInviteResponse> listPendingInvites(HttpServletRequest req) {
        return groupService.listPendingInvites(userId(req));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupResponse createGroup(HttpServletRequest req, @RequestBody CreateGroupRequest request) {
        return groupService.createGroup(userId(req), request);
    }

    @PostMapping("/{groupId}/invite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void invite(HttpServletRequest req, @PathVariable Long groupId, @RequestBody InviteToGroupRequest request) {
        groupService.invite(userId(req), groupId, request.friendUserId());
    }

    @PostMapping("/{groupId}/accept")
    public GroupResponse acceptInvite(
            HttpServletRequest req, @PathVariable Long groupId, @RequestBody AcceptGroupInviteRequest request) {
        return groupService.acceptInvite(userId(req), groupId, request.habitId());
    }
}
