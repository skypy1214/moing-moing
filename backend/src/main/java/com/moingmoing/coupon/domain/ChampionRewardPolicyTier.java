package com.moingmoing.coupon.domain;

import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "champion_reward_policy_tiers")
public class ChampionRewardPolicyTier {
    @Id
    private UUID id;
    private UUID policyId;
    private int tieCountFrom;
    private Integer tieCountTo;
    private int couponUses;

    protected ChampionRewardPolicyTier() {
    }

    public boolean appliesTo(int tieCount) {
        return tieCount >= tieCountFrom && (tieCountTo == null || tieCount <= tieCountTo);
    }

    public int getCouponUses() { return couponUses; }
}
