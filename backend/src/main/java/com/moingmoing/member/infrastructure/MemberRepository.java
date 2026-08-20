package com.moingmoing.member.infrastructure;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.member.domain.Member;

public interface MemberRepository extends JpaRepository<Member, UUID> {
}
