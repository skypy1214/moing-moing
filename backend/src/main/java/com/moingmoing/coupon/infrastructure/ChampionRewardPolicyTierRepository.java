package com.moingmoing.coupon.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.coupon.domain.ChampionRewardPolicyTier;

public interface ChampionRewardPolicyTierRepository extends JpaRepository<ChampionRewardPolicyTier, UUID> {
    List<ChampionRewardPolicyTier> findByPolicyIdOrderByTieCountFromAsc(UUID policyId);
}
