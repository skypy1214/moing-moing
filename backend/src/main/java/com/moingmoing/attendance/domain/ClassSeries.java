package com.moingmoing.attendance.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A set of weekly class gatherings that share one prepaid enrollment. */
@Entity
@Table(name = "class_series")
public class ClassSeries {
    @Id
    private UUID id;
    private String title;
    private LocalDate startsOn;
    private int sessionCount;
    private int sessionFee;
    private Instant createdAt;
    private Instant updatedAt;

    protected ClassSeries() {
    }

    public ClassSeries(String title, LocalDate startsOn, int sessionCount, int sessionFee) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("연속 수업 이름을 입력해 주세요.");
        }
        if (startsOn == null) {
            throw new IllegalArgumentException("연속 수업 시작일을 입력해 주세요.");
        }
        if (sessionCount < 2 || sessionCount > 24) {
            throw new IllegalArgumentException("연속 수업은 2회부터 24회까지 개설할 수 있습니다.");
        }
        if (sessionFee < 0) {
            throw new IllegalArgumentException("회당 참가비는 0원 이상이어야 합니다.");
        }
        this.id = UUID.randomUUID();
        this.title = title.trim();
        this.startsOn = startsOn;
        this.sessionCount = sessionCount;
        this.sessionFee = sessionFee;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public LocalDate getStartsOn() { return startsOn; }
    public int getSessionCount() { return sessionCount; }
    public int getSessionFee() { return sessionFee; }
    public int getTotalFee() { return sessionCount * sessionFee; }
}
