package com.moingmoing.member.infrastructure;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.moingmoing.member.domain.MemberActivityExclusion;

public interface MemberActivityExclusionRepository extends JpaRepository<MemberActivityExclusion, UUID> {
    List<MemberActivityExclusion> findByMemberIdOrderByStartDateDesc(UUID memberId);

    @Query("""
            select count(exclusion) > 0 from MemberActivityExclusion exclusion
            where exclusion.memberId = :memberId
              and (:excludedId is null or exclusion.id <> :excludedId)
              and exclusion.startDate <= :endDate
              and (exclusion.endDate is null or exclusion.endDate >= :startDate)
            """)
    boolean existsOverlapping(
            @Param("memberId") UUID memberId,
            @Param("excludedId") UUID excludedId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
            select exclusion.memberId from MemberActivityExclusion exclusion
            where exclusion.startDate <= :today
              and (exclusion.endDate is null or exclusion.endDate >= :today)
            """)
    List<UUID> findMemberIdsActiveOn(@Param("today") LocalDate today);
}
