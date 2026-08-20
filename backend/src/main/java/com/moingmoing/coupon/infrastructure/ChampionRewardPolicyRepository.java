package com.moingmoing.coupon.infrastructure;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.coupon.domain.ChampionRewardPolicy;

public interface ChampionRewardPolicyRepository extends JpaRepository<ChampionRewardPolicy, UUID> {
    Optional<ChampionRewardPolicy> findFirstByActiveTrueAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
            LocalDate targetMonth);
}
