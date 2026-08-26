package com.moingmoing.common.infrastructure;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.moingmoing.auth.infrastructure.UserAccountRepository;
import com.moingmoing.member.application.MemberService;

/**
 * Keeps production's lazy boot optimization from moving the first-login and first-member-list cost
 * to an operator.
 */
@Component
@Profile("prod")
class ProductionStartupWarmup implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ProductionStartupWarmup.class);

    private final MemberService memberService;
    private final UserAccountRepository userAccountRepository;

    ProductionStartupWarmup(MemberService memberService, UserAccountRepository userAccountRepository) {
        this.memberService = memberService;
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        long startedAtNanos = System.nanoTime();
        userAccountRepository.findByLoginId("");
        memberService.findAllWithLastAttendance();
        log.info("startup-warmup completed durationMs={}",
                Duration.ofNanos(System.nanoTime() - startedAtNanos).toMillis());
    }
}
