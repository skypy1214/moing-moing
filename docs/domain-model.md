# 최초 도메인 모델

## 1. 모델링 방향

회원의 "현재 상태"만 저장하면 과거 월의 통계 분모를 재구성할 수 없다. 따라서 회원 생명주기와 통계 제외 사유를 기간으로 표현한다. 출석은 회원을 참조하되 회원 탈퇴로 삭제되지 않는다. 쿠폰의 발급/상태와 실제 사용 이력은 분리한다.

명칭은 `LEAVE`처럼 탈퇴와 휴식을 혼동할 수 있는 값 대신 아래처럼 제안한다.

- 회원 생명주기: `ACTIVE`, `WITHDRAWN`.
- 활동 제외 기간: 별도 `MemberActivityExclusion` 엔티티로 `PERSONAL_BREAK` 등의 사유와 기간 관리.

`INACTIVE`가 장기 미참여를 뜻한다면 자동 파생 값으로 볼 수 있고, 운영자가 명시하는 상태라면 제외 기간 사유로 추가한다. 하나의 상태 enum에 `ACTIVE`, `INACTIVE`, `LEAVE`, `WITHDRAWN`을 모두 담으면 "회원인지"와 "잠시 활동 가능한지"라는 서로 다른 축이 섞인다.

## 2. 관계 개요

```text
Member 1 --- N MemberActivityExclusion
Member 1 --- N Attendance N --- 1 Gathering
Member 1 --- N Coupon 1 --- N CouponUsage
CouponUsage 0..1 --- 1 Attendance
MeetingNote N --- 1 MeetingNoteCategory

AttendanceChampionAward N --- 1 Member
AttendanceChampionAward 1 --- N Coupon (정책에 따라 1개 또는 2개)
```

`Gathering`은 날짜별 출석부의 헤더다. 이를 두지 않고 Attendance에 날짜만 넣으면 모임 취소, 장소/메모와 출석부 상태를 확장하기 어렵고 동일 날짜 모임의 의미도 불명확해진다.

## 3. 엔티티 제안

### Member

주요 필드:

- `id`: 내부 식별자.
- `displayName`: 운영 화면 표시 이름.
- `externalNickname` 또는 `externalMemberKey`: 외부 소모임 명부 비교용 값. 실제 안정적인 외부 ID가 없으면 nickname의 유일성을 가정하지 않는다.
- `membershipStatus`: `ACTIVE | WITHDRAWN`.
- `joinedOn`, `withdrawnOn`: 생명주기 날짜.
- `memo`: 운영 메모(민감정보 최소화).
- `createdAt`, `updatedAt`.

불변조건:

- `WITHDRAWN`이면 `withdrawnOn`이 필요하고, `ACTIVE`이면 없어야 한다.
- 탈퇴는 삭제가 아닌 상태 전이다. 재가입을 동일 Member로 복원할지 새 가입 이력으로 볼지는 미확정이다.
- 이름은 변경 가능하므로 과거 관계의 식별 기준으로 사용하지 않는다.

### MemberActivityExclusion

통계상 정상 활동을 기대하지 않는 기간을 표현한다.

- `id`, `memberId`.
- `reason`: `PERSONAL_BREAK`, `MEDICAL`, `MILITARY_SERVICE`, `OTHER` 등 설정 가능한 최소 enum 또는 코드.
- `startDate`, `endDate`(nullable). 종료일이 없으면 별도 종료 처리 전까지 무기한 활동 제외를 뜻한다.
- `note`, `createdBy`, `createdAt`, `updatedAt`.

이 모델은 과거 월의 활동률을 당시 기준으로 재계산하고, 월 일부만 쉰 경우의 정책도 나중에 바꿀 수 있게 한다. 종료일이 없는 기간은 현재도 계속되는 제외 기간이며, 복귀 처리 시 종료일을 기록한다. 기간 중첩은 혼란을 만들므로 같은 회원에 대한 중첩을 application 검증과 통합 테스트로 방지한다. 무기한 기간이 존재하면 새 제외 기간을 시작할 수 없다.

### Gathering

날짜별 출석부/모임을 나타낸다.

- `id`, `heldOn`.
- 선택 필드 `title`, `startsAt`, `location`.
- `status`: `DRAFT | OPEN | CLOSED | CANCELLED` 후보.
- `createdBy`, `createdAt`, `updatedAt`.

하루에 모임이 반드시 하나라는 규칙이 확정되면 `heldOn`을 unique로 둔다. 아니면 날짜+순번 또는 시작 시각 기준 unique가 필요하다.

### Attendance

- `id`, `gatheringId`, `memberId`.
- `participationType`: `PAID | FREE`를 우선 제안한다.
- `couponUsageId`: 무료 참여가 쿠폰에 의해 발생하면 연결.
- `recordedBy`, `recordedAt`.
- 정정 지원 시 `status: RECORDED | CANCELLED`, `cancelledAt`, `cancelledBy`, `cancellationReason`.

`NORMAL`, `COUPON`, `ATTENDANCE_KING_COUPON`은 결제 방식과 쿠폰 종류를 한 enum에 섞는다. 출석왕 집계의 본질은 유료/일반 참여인지이므로 Attendance에는 `participationType`을 저장하고, 무료 사유의 상세는 연결된 Coupon의 종류에서 찾는다. 쿠폰 없이 관리자가 무료 처리할 수 있다면 별도 `freeReason`이 필요하다.

불변조건:

- `(gatheringId, memberId)`는 유효 출석 기준으로 하나다.
- `FREE`이면서 쿠폰 사용이면 유효한 CouponUsage와 연결한다.
- `PAID`만 출석왕 집계에 포함한다. 향후 명칭이 `COUNTED | NOT_COUNTED`가 더 정확한지 정책 확정 시 검토한다.
- 탈퇴 회원도 과거 출석의 참조 대상이 될 수 있으나, 탈퇴일 이후 신규 출석 입력은 기본 차단한다.

### Coupon

- `id`, `memberId`(수령자).
- `type`: `ATTENDANCE_CHAMPION`, `MANUAL_FREE_PASS`, 기타 명시적 유형.
- `status`: `ISSUED | SUSPENDED | EXPIRED | FULLY_USED | VOIDED`.
- `validFrom`, `validUntil`.
- `totalUses`, `remainingUses` 또는 사용 이력 집계.
- `qrTokenHash`: 원본 토큰 대신 해시 저장을 우선 검토.
- `issuedReason`, `issuedBy`, `issuedAt`, `suspendedAt`, `voidedAt`.
- 출석왕 보상이라면 `championAwardId`.

상태는 가능한 경우 날짜와 사용 이력에서 파생하되, 정지/폐기처럼 명시적 조치가 필요한 상태는 저장한다. `EXPIRED`를 배치로 변경할 필요 없이 `validUntil`로 유효성을 계산할 수도 있다. 표시 상태와 영속 상태를 구분해 상태 불일치를 줄인다.

### CouponUsage

- `id`, `couponId`, `attendanceId`(사용이 출석 생성과 함께라면 연결).
- `usedAt`, `usedBy`.
- 취소를 허용하면 `status: USED | REVERSED`, `reversedAt`, `reversedBy`, `reason`.

Coupon 한 장에 2회 잔액을 담는다면 1:N이 필수다. 1회권만 발급하더라도 별도 사용 엔티티가 감사와 사용 취소를 명확하게 한다. 쿠폰 사용과 출석 생성은 한 트랜잭션에서 처리하며, 잔여 횟수 초과 사용을 DB/잠금 전략으로 방지한다.

### AttendanceChampionAward

월간 집계의 확정 결과와 보상 중복 방지를 위한 엔티티다.

- `id`, `targetMonth` (`YearMonth` 변환 값).
- `memberId`, `qualifyingAttendanceCount`.
- `rank`, `policyVersion`.
- `status`: `CALCULATED | GRANTED | CANCELLED` 후보.
- `calculatedAt`, `grantedAt`, `grantedBy`.

`(targetMonth, memberId, policyVersion)` 또는 확정 정책에 맞는 unique 제약으로 재실행을 멱등하게 한다. 쿠폰은 이 보상 결과를 참조한다. 집계 대상 월과 쿠폰 유효 월을 구분한다.

### MeetingNoteCategory

- `id`, `name`, `color`, `displayOrder`.
- `active`, `createdAt`, `updatedAt`.

이름 또는 slug의 중복 정책과 이미 사용된 카테고리의 삭제 대신 비활성화 규칙이 필요하다. 색상은 허용 형식(예: hex)을 검증한다.

### MeetingNote

- `id`, `categoryId`, `title`, `markdownContent`.
- `visibilityStatus`: `VISIBLE | HIDDEN`.
- `meetingDate`(실제 회의일), `createdBy`, `updatedBy`.
- `createdAt`, `updatedAt`, `hiddenAt`.

Markdown 원문을 저장하고 렌더링은 프론트에서 안전하게 수행한다. HTML 결과를 DB에 함께 저장하는 것은 캐시 필요성이 확인되기 전까지 하지 않는다. 수정 이력이 필요하면 향후 `MeetingNoteRevision`을 추가한다.

### AdminUser (인증 채택 시)

- `id`, `loginId` 또는 OIDC subject.
- 로컬 인증이면 `passwordHash`.
- `role`, `status`, `lastLoginAt`, 감사 시각.

도메인의 `createdBy`, `usedBy` 등은 이 엔티티를 참조한다. 운영자 삭제 시 감사 참조가 사라지지 않도록 비활성화한다.

## 4. 주요 유스케이스와 트랜잭션

- 회원 탈퇴: Member 상태/일자 변경. 출석·쿠폰·회의 이력은 변경하거나 삭제하지 않는다.
- 출석 기록: Gathering과 Member 가능 여부 검증 후 Attendance 생성.
- 쿠폰 사용 출석: 쿠폰 소유자, 기간, 정지/폐기, 잔여 횟수를 확인하고 CouponUsage와 Attendance를 한 트랜잭션으로 생성.
- 출석왕 확정: 대상 월의 유효한 `PAID` 출석 집계 → 동률 정책 적용 → Award 저장 → 다음 달 유효 쿠폰 발급. unique 제약으로 중복 방지.
- 활동률 계산: 대상 월의 회원 생명주기와 제외 기간을 조회한 뒤 버전이 있는 정책 함수가 분자/분모 및 상세 내역을 반환.

## 5. 삭제와 감사 정책

- Member, Attendance, CouponUsage, AttendanceChampionAward, AdminUser: 물리 삭제 금지 원칙.
- Coupon: 미사용 오발급도 `VOIDED` 우선. 생성 직후 테스트 데이터 등 물리 삭제 허용 조건은 별도 결정.
- MeetingNote/Category: 숨김/비활성화 우선. 개인정보 삭제 요구에 대응할 별도 관리 절차는 배포 전 정한다.
- 모든 중요한 상태 변경에는 수행자와 시각을 남긴다. 범용 감사 이벤트 테이블은 실제 조회 요구가 확정되기 전에는 도입하지 않는다.

## 6. 통계 정책의 변경 용이성

통계 계산을 Controller, repository query, UI에 중복하지 않는다. application/domain의 `MonthlyParticipationPolicy` 같은 한 컴포넌트가 다음 입력을 받아 결과를 만든다.

- 대상 월과 기준 시간대.
- 해당 월에 유효한 회원 생명주기.
- 활동 제외 기간.
- 유효 출석 목록 또는 집계값.
- 정책 버전/설정.

결과에는 출석률/활동률 숫자뿐 아니라 대상자 ID 집합, 출석자 집합, 인정 제외자 집합과 제외 이유를 포함해 관리자가 수치를 설명할 수 있게 한다. 구현은 단일 정책 클래스로 시작하고, 실제 복수 정책을 동시에 운영해야 할 때만 Strategy 형태로 확장한다.
