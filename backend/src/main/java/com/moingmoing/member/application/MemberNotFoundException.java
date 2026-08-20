package com.moingmoing.member.application;

import java.util.UUID;

public class MemberNotFoundException extends RuntimeException {
    public MemberNotFoundException(UUID id) {
        super("회원을 찾을 수 없습니다: " + id);
    }
}
