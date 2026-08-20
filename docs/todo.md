# MVP 구현 로드맵

상태 표기는 `[ ]` 미착수, `[~]` 진행, `[x]` 완료를 사용한다. 각 Phase는 기능 완료 기준과 검증 명령이 충족되어야 완료로 바꾼다.

## Phase 0 — 설계 기반

- [x] 프로젝트 요구사항, 아키텍처, 최초 도메인 모델 문서화.
- [x] 미확정 설계 질문과 단계별 로드맵 작성.
- [x] Codex 작업 규칙과 검증 원칙 작성.
- [ ] 우선순위 높은 open question 결정 및 문서 반영.

완료 기준: 구현을 시작할 핵심 경계와 보존 원칙이 문서에 있고, 미결정 사항이 숨겨져 있지 않다.

## Phase 1 — 프로젝트 초기화

- [x] Git 저장소와 기본 `.gitignore`, `.editorconfig` 초기화.
- [x] `backend/` Java 21 Spring Boot Gradle 프로젝트 생성.
- [x] `frontend/` React + TypeScript + Vite 프로젝트 생성.
- [x] 개발용 PostgreSQL Docker Compose, `.env.example`, 프로필 구성.
- [x] Flyway baseline migration 및 migration 검증 테스트 구성.
- [x] 백엔드 Checkstyle, 프론트 ESLint/Prettier/Vitest 확정.
- [x] `scripts/verify.ps1`과 CI용 `verify.sh` 구현.
- [x] GitHub Actions에서 전체 검증 실행.
- [x] 로컬 개발 실행/DB 초기화/환경변수 문서 작성.

완료 기준: 깨끗한 checkout에서 문서의 명령으로 DB를 시작하고 양쪽 앱과 전체 검증을 재현할 수 있다.

### 집 PC에서 검증 필요

- [ ] Docker Compose로 PostgreSQL 컨테이너를 기동하고 healthcheck가 `healthy`인지 확인한다.
- [ ] 백엔드를 실행해 Flyway `V1`, `V2` migration이 PostgreSQL에 실제 적용되는지 확인한다.
- [ ] Docker 사용 가능 환경에서 Testcontainers PostgreSQL migration 테스트가 skip되지 않고 통과하는지 확인한다.

회사 PC에서는 Docker 없이 backend compile/unit test/Checkstyle와 frontend lint/test/build을 실행한다. Docker 제한을 우회하기 위한 별도 개발 환경이나 의존성은 추가하지 않는다.

## Phase 2 — 인증과 회원 관리

- [~] 인증 방식 확정 및 최소 관리자 로그인/로그아웃 구현.
- [~] Member, MemberActivityExclusion schema와 도메인 규칙 구현.
- [~] 회원 목록/상세/등록/수정/탈퇴/재활성화 API와 기본 화면 구현. 필터·정렬·입력 오류 표시는 계속 구현.
- [~] 활동 제외 기간 등록·수정·종료 API와 UI 구현. 입력 오류 표시와 통합 테스트는 계속 보강.
- [~] 회원 목록 검색·상태 필터·정렬과 Bean Validation 필드 오류 표시 구현. 실제 API 오류 응답과 통합 테스트는 계속 보강.
- [ ] DB 기반 로그인과 회원 관리 수동 검증 후 프론트 개발 전용 데모 계정(`admin` / `admin`) 및 데모 데이터를 제거.

완료 기준: 운영자가 현재/탈퇴/활동 제외 회원을 관리하며 이력 보존을 테스트로 증명한다.

### 집 PC에서 검증 필요

- [ ] Member 및 MemberActivityExclusion migration이 PostgreSQL에 적용되는지 확인한다.
- [ ] PostgreSQL Testcontainers 통합 테스트로 회원 상태 전이와 활동 제외 기간 제약을 검증한다.

## Phase 3 — 출석 관리

- [~] Gathering과 Attendance schema 및 기본 도메인 상태 전이 구현.
- [~] 날짜별 출석부 생성/조회/열기/마감/취소, 출석 기록/취소와 회원별 전체 이력 API 구현. DB 통합 테스트는 계속 구현.
- [~] 출석부 생성/목록/상태 변경, 월간 캘린더와 모달 기반 모임 생성·출석 처리, 회원별 출석 기록·취소·전체 이력 화면 구현. 실제 DB 연동 수동 검증은 계속 구현.
- [~] 중복 출석, 탈퇴일 이후 입력, 취소 모임 규칙 단위 테스트 작성. 백엔드 자동 실행과 DB 통합 테스트는 계속 검증.

완료 기준: 날짜별 출석을 안정적으로 기록하고 탈퇴 후에도 과거 기록을 조회한다.

### 집 PC에서 검증 필요

- [ ] Gathering 및 Attendance migration이 PostgreSQL에 적용되는지 확인한다.

## Phase 4 — 월별 통계와 출석왕 계산

- [~] 출석률/활동률 `draft-v1` 정책과 예시를 문서화. 운영진 확정은 계속 필요.
- [~] 분자/분모와 상세 근거를 반환하는 월별 통계 API 구현. 화면은 계속 구현.
- [ ] 일반(`NORMAL`) 출석만 반영하는 출석왕 계산 구현.
- [ ] 공동 순위 정책(현재 1~2명: 2회, 3명 이상: 1회)과 정책 버전, 확정 결과의 멱등성 테스트.

완료 기준: 경계 날짜/가입/탈퇴/활동 제외 사례의 기대 수치를 자동 테스트로 설명할 수 있다.

## Phase 5 — 쿠폰 관리

- [~] Coupon, CouponUsage, AttendanceChampionAward, 버전 관리되는 ChampionRewardPolicy schema 구현. Flyway `V4` 작성 완료, PostgreSQL 적용 검증 및 JPA 구현 계속.
- [~] 수동 쿠폰 발급·목록 조회, 정지, 폐기, 사용 기간 연장 API와 관리자 화면 구현. 실제 DB 검증, 사용 기간 연장 UI와 사용 이력 조회 UI는 계속 구현.
- [~] 쿠폰 사용·사용 취소 API와 사용 이력 조회 API 구현. 발급·정지·폐기·기간 연장·사용 이력 조회와 열린 출석부를 선택하는 사용/사용 취소 화면을 구현했으며, 실제 DB 검증은 계속 구현.
- [~] 출석왕 확정에서 정책 스냅샷(`policyVersion`, `rewardUses`)을 저장하고 다음 달 쿠폰을 자동 발급한다. 관리자 취소 시 미사용 쿠폰을 `VOIDED`로 처리하며, 관리자 화면과 PostgreSQL 통합 검증은 계속 보강한다.
- [ ] 동시 사용과 재실행 중복 방지 통합 테스트.

완료 기준: 쿠폰의 전체 생명주기와 감사 가능한 사용 이력이 보존된다.

### 집 PC에서 검증 필요

- [ ] PostgreSQL에서 Flyway `V4` migration과 출석왕 보상 정책 초기 데이터가 정상 적용되는지 확인한다.

## Phase 6 — QR 검증과 사용

> 보류: QR 이미지 발급과 카메라 스캔은 `html5-qrcode` 설치·실기기 카메라 권한 검증이 가능한 환경에서 재개한다. 현재는 QR 토큰 발급 및 붙여넣기 기반 사용 API/UI까지만 구현되어 있다.

- [ ] QR 라이브러리 후보의 라이선스/유지보수/XSS·카메라 보안 검토 기록.
- [ ] 불투명 토큰 생성, 저장, 회전/폐기 전략 구현.
- [ ] 모바일 QR 스캔 → 유효성 조회 → 관리자 확인 → 원자적 사용 처리 구현.
- [ ] 복제, 만료, 정지, 이미 사용, 권한 없는 요청 테스트.

완료 기준: QR에 민감 데이터가 노출되지 않고 서버가 모든 유효성 및 권한을 최종 판단한다.

## Phase 7 — 회의록

- [ ] 카테고리 CRUD/비활성화와 색상/정렬 구현.
- [ ] 회의록 작성, 수정, 숨김, 목록, 상세, 필터 구현.
- [ ] Markdown 편집/미리보기/안전한 렌더링 구현.
- [ ] 선택한 라이브러리와 라이선스 기록, XSS 테스트.

완료 기준: 요구된 Markdown 요소가 안전하고 읽기 좋게 표시되며 숨긴 문서도 정책에 따라 복구 가능하다.

## Phase 8 — 배포 준비

- [ ] 배포 환경과 비용 확정, 운영 설정/비밀 주입 구성.
- [ ] HTTPS, CORS/CSRF, 쿠키, 보안 헤더 점검.
- [ ] DB 자동 백업과 복구 절차 작성 및 리허설.
- [ ] migration/rollback(애플리케이션) 배포 절차와 healthcheck 구성.
- [ ] 로그 개인정보/토큰 마스킹, 최소 모니터링과 장애 대응 문서 작성.
- [ ] 운영 수용 테스트 및 초기 관리자 생성 절차 검증.

완료 기준: 새 환경에 반복 배포 가능하고 백업에서 복구할 수 있으며 운영 보안 체크리스트를 통과한다.

## 이후 후보

- 스크린샷/OCR 기반 명부 비교와 사람이 승인하는 변경 후보 화면.
- 회의록 revision/첨부파일.
- 역할 세분화와 감사 로그 검색.
- 실제 사용 데이터에 기반한 UX/쿼리 최적화.
