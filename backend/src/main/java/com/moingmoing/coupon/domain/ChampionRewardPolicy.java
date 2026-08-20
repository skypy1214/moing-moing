package com.moingmoing.coupon.domain;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "champion_reward_policies")
public class ChampionRewardPolicy {
    @Id
    private UUID id;
    private String version;
    private LocalDate effectiveFrom;
    private boolean active;

    protected ChampionRewardPolicy() {
    }

    public UUID getId() { return id; }
    public String getVersion() { return version; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public boolean isActive() { return active; }
}
