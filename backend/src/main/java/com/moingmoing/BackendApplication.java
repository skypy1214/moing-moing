package com.moingmoing;

import java.time.Duration;
import java.util.Comparator;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup;
import org.springframework.boot.context.metrics.buffering.StartupTimeline;
import org.springframework.context.ApplicationListener;

@SpringBootApplication
public class BackendApplication {
    private static final Logger log = LoggerFactory.getLogger(BackendApplication.class);
    private static final int STARTUP_TIMELINE_CAPACITY = 2048;
    private static final int SLOWEST_STARTUP_STEP_COUNT = 12;

    public static void main(String[] args) {
        long startedAtNanos = System.nanoTime();
        BufferingApplicationStartup applicationStartup =
                new BufferingApplicationStartup(STARTUP_TIMELINE_CAPACITY);
        SpringApplication application = new SpringApplication(BackendApplication.class);
        application.setApplicationStartup(applicationStartup);
        application.addListeners((ApplicationListener<ApplicationReadyEvent>) event ->
                logStartupProfile(applicationStartup, startedAtNanos));
        application.run(args);
    }

    private static void logStartupProfile(
            BufferingApplicationStartup applicationStartup, long startedAtNanos) {
        long totalDurationMillis = Duration.ofNanos(System.nanoTime() - startedAtNanos).toMillis();
        log.info("startup-profile application-ready durationMs={}", totalDurationMillis);

        applicationStartup.drainBufferedTimeline().getEvents().stream()
                .sorted(Comparator.comparing(StartupTimeline.TimelineEvent::getDuration).reversed())
                .limit(SLOWEST_STARTUP_STEP_COUNT)
                .forEach(event -> log.info(
                        "startup-profile step={} durationMs={}",
                        event.getStartupStep().getName(),
                        event.getDuration().toMillis()));
    }
}
