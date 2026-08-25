package com.moingmoing.audit.domain;

import java.time.Instant;
import java.util.UUID;

import com.moingmoing.auth.domain.UserAccount;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "activity_logs")
public class ActivityLog {
    @Id
    private UUID id;
    @ManyToOne
    @JoinColumn(name = "actor_user_account_id")
    private UserAccount actor;
    private String actorDisplayName;
    private String action;
    private String targetType;
    private String targetId;
    private String requestId;
    private String httpMethod;
    private String requestPath;
    private int responseStatus;
    private Instant occurredAt;

    protected ActivityLog() {
    }

    public ActivityLog(
            UserAccount actor,
            String action,
            String targetType,
            String targetId,
            String requestId,
            String httpMethod,
            String requestPath,
            int responseStatus) {
        this.id = UUID.randomUUID();
        this.actor = actor;
        this.actorDisplayName = actor == null ? null : actor.getDisplayName();
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.requestId = requestId;
        this.httpMethod = httpMethod;
        this.requestPath = requestPath;
        this.responseStatus = responseStatus;
        this.occurredAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UserAccount getActor() { return actor; }
    public String getActorDisplayName() { return actorDisplayName; }
    public String getAction() { return action; }
    public String getTargetType() { return targetType; }
    public String getTargetId() { return targetId; }
    public String getRequestId() { return requestId; }
    public String getHttpMethod() { return httpMethod; }
    public String getRequestPath() { return requestPath; }
    public int getResponseStatus() { return responseStatus; }
    public Instant getOccurredAt() { return occurredAt; }
}
