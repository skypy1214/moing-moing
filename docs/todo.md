# MVP 구현 로드맵

## 다음 묶음 검증 (사용자 요청 시 실행)

- [ ] 이번 회원 관리·정모/출석·쿠폰·월별 통계 UI 변경에 대해 backend Gradle build/test/Checkstyle와 frontend lint/test/build를 한 번에 실행한다.
- [ ] 회원 상태 변경·참여 이력, 정모 개설/수정·진행자 변경, 행사 기간, 출석 마감, 월별 통계, 날짜·회원 선택 입력을 실제 브라우저에서 점검한다.

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
- [x] 백엔드를 실행해 Flyway `V1`, `V2` migration이 PostgreSQL에 실제 적용되는지 확인한다. (2026-08-21 Neon PostgreSQL 검증)
- [ ] Docker 사용 가능 환경에서 Testcontainers PostgreSQL migration 테스트가 skip되지 않고 통과하는지 확인한다.

회사 PC에서는 Docker 없이 backend compile/unit test/Checkstyle와 frontend lint/test/build을 실행한다. Docker 제한을 우회하기 위한 별도 개발 환경이나 의존성은 추가하지 않는다.

## Phase 2 — 인증과 회원 관리

- [~] 인증 방식 확정 및 최소 관리자 로그인/로그아웃 구현.
- [~] Member, MemberActivityExclusion schema와 도메인 규칙 구현.
- [~] 회원 목록/상세/등록/수정/탈퇴/재활성화 API와 기본 화면 구현. 필터·정렬·입력 오류 표시는 계속 구현.
- [~] 활동 제외 기간 등록·수정·종료 API와 UI 구현. 입력 오류 표시와 통합 테스트는 계속 보강.
- [~] 회원 목록 검색·상태 필터·정렬과 Bean Validation 필드 오류 표시 구현. 실제 API 오류 응답과 통합 테스트는 계속 보강.
- [~] 회원 직책 `MEMBER`(회원)·`STAFF`(운영진)·`LEADER`(모임장)를 Member에 추가. 로그인 권한과 분리하며 Flyway `V6` 적용과 실제 DB 검증은 계속 구현.
- [~] Neon PostgreSQL 기반 관리자 로그인·로그아웃과 보호된 회원 목록 API 수동 검증 완료. 회원 화면의 프론트 개발 전용 데모 계정(`admin` / `admin`)과 데모 회원 데이터 제거 완료. 나머지 기능 화면의 API 연동은 계속 진행.

완료 기준: 운영자가 현재/탈퇴/활동 제외 회원을 관리하며 이력 보존을 테스트로 증명한다.

### 집 PC에서 검증 필요

- [x] Member 및 MemberActivityExclusion migration이 PostgreSQL에 적용되는지 확인한다. (2026-08-21 Neon PostgreSQL 검증)
- [ ] PostgreSQL Testcontainers 통합 테스트로 회원 상태 전이와 활동 제외 기간 제약을 검증한다.

## Phase 3 — 출석 관리

- [~] Gathering과 Attendance schema 및 기본 도메인 상태 전이 구현.
- [~] 날짜별 출석부 생성/조회/열기/마감/취소, 출석 기록/취소와 회원별 전체 이력 API 구현. DB 통합 테스트는 계속 구현.
- [~] 출석부 생성/목록/상태 변경, 월간 캘린더와 모달 기반 모임 생성·출석 처리, 회원별 출석 기록·취소·전체 이력 화면을 실제 API에 연결. 실제 DB 연동 수동 검증은 계속 구현.
- [~] 중복 출석, 탈퇴일 이후 입력, 취소 모임 규칙 단위 테스트 작성. 백엔드 자동 실행과 DB 통합 테스트는 계속 검증.

완료 기준: 날짜별 출석을 안정적으로 기록하고 탈퇴 후에도 과거 기록을 조회한다.

### 집 PC에서 검증 필요

- [x] Gathering 및 Attendance migration이 PostgreSQL에 적용되는지 확인한다. (2026-08-21 Neon PostgreSQL 검증)

## Phase 4 — 월별 통계와 출석왕 계산

- [~] 출석률/활동률 `draft-v1` 정책과 예시를 문서화. 운영진 확정은 계속 필요.
- [~] 분자/분모와 상세 근거를 반환하는 월별 통계 API와 실제 API 기반 조회 화면 구현. 실제 DB 검증은 계속 구현.
- [ ] 일반(`NORMAL`) 출석만 반영하는 출석왕 계산 구현.
- [ ] 공동 순위 정책(현재 1~2명: 2회, 3명 이상: 1회)과 정책 버전, 확정 결과의 멱등성 테스트.

완료 기준: 경계 날짜/가입/탈퇴/활동 제외 사례의 기대 수치를 자동 테스트로 설명할 수 있다.

## Phase 5 — 쿠폰 관리

- [~] Coupon, CouponUsage, AttendanceChampionAward, 버전 관리되는 ChampionRewardPolicy schema 구현. Flyway `V4` 작성 완료, PostgreSQL 적용 검증 및 JPA 구현 계속.
- [~] 수동 쿠폰 발급·목록 조회, 정지, 폐기, 사용 기간 연장 API와 관리자 화면을 실제 API에 연결. 실제 DB 검증, 사용 기간 연장 UI와 사용 이력 조회 UI는 계속 구현.
- [~] 쿠폰 사용·사용 취소 API와 사용 이력 조회 API 구현. 발급·정지·폐기·기간 연장·사용 이력 조회와 열린 출석부를 선택하는 사용/사용 취소 화면을 실제 API에 연결했으며, 실제 DB 검증은 계속 구현.
- [~] 출석왕 확정에서 정책 스냅샷(`policyVersion`, `rewardUses`)을 저장하고 다음 달 쿠폰을 자동 발급한다. 관리자 취소 시 미사용 쿠폰을 `VOIDED`로 처리하며, 관리자 화면과 PostgreSQL 통합 검증은 계속 보강한다.
- [ ] 동시 사용과 재실행 중복 방지 통합 테스트.

완료 기준: 쿠폰의 전체 생명주기와 감사 가능한 사용 이력이 보존된다.

### 집 PC에서 검증 필요

- [ ] PostgreSQL에서 Flyway `V4` migration과 출석왕 보상 정책 초기 데이터가 정상 적용되는지 확인한다.

## Phase 6 — QR 검증과 사용

- [x] QR 라이브러리 후보의 라이선스·유지보수·카메라 보안 검토 기록. `@yudiel/react-qr-scanner`와 `qrcode.react`를 채택했다.
- [x] 불투명 토큰 생성, 해시 저장, 새 QR 발급 시 토큰 회전 구현.
- [~] 모바일 QR 스캔 → 유효성 조회 → 관리자 확인 → 원자적 사용 처리 구현. 실기기 카메라 권한·HTTPS 환경 검증은 계속 필요하다.
- [ ] 복제, 만료, 정지, 이미 사용, 권한 없는 요청 테스트.

완료 기준: QR에 민감 데이터가 노출되지 않고 서버가 모든 유효성 및 권한을 최종 판단한다.

## Phase 7 — 게시판

- [~] 카테고리 CRUD/비활성화와 색상/정렬, 관리자 전용 설정 화면 구현. 기본 카테고리(`회의록`, `대관 일정`) Flyway 초기 데이터와 실제 DB 검증은 계속 구현.
- [~] 게시글 작성, 수정, 숨김, 목록, 상세, 필터와 실제 API 기반 화면 구현. 실제 DB 검증은 계속 구현.
- [~] Markdown 편집/미리보기/안전한 렌더링 구현. 기존 렌더링 테스트는 유지하고 API 화면 테스트는 계속 보강.
- [ ] 선택한 라이브러리와 라이선스 기록, XSS 테스트.

완료 기준: 요구된 Markdown 요소가 안전하고 읽기 좋게 표시되며 숨긴 문서도 정책에 따라 복구 가능하다.

## Phase 8 — 배포 준비

- [~] Cloudflare Workers Static Assets(React/Vite) + Render Free Web Service(Spring Boot) + Neon PostgreSQL 배포 구성과 환경변수 분리. 실제 플랫폼 연결과 운영 URL 입력은 계속 필요.
- [~] Render `PORT`, production CORS origin, HTTPS 세션 쿠키 설정. Cloudflare Worker `/api/*` 프록시와 `API_ORIGIN` 설정을 추가했으며, 실제 iPhone Safari 로그인·세션 유지와 CSRF·보안 헤더 점검은 계속 필요.
- [~] Render Free cold start의 `startup-profile` 로그를 추가하고, prod lazy initialization과 DB readiness endpoint로 port scan 시간 초과를 피하도록 구성했다. 다음 cold start에서 플랫폼 기동 시간과 Spring 초기화 상위 단계를 확인한 뒤 개선 대상을 결정한다.
- [ ] DB 자동 백업과 복구 절차 작성 및 리허설.
- [ ] migration/rollback(애플리케이션) 배포 절차와 healthcheck 구성.
- [ ] 로그 개인정보/토큰 마스킹, 최소 모니터링과 장애 대응 문서 작성.
- [ ] 운영 수용 테스트 및 초기 관리자 생성 절차 검증.

완료 기준: 새 환경에 반복 배포 가능하고 백업에서 복구할 수 있으며 운영 보안 체크리스트를 통과한다.

## 횡단 UI/UX 리팩터링

- [ ] 회원 목록 → Bottom Sheet 빠른 확인/액션 → 상세 Page, 등록/수정 Page 흐름으로 분리한다. 탈퇴/재활성화는 Dialog 확인을 추가한다.
- [ ] 긴 입력 작업은 Page, 조회·빠른 액션은 Bottom Sheet, 위험 작업은 Dialog, QR 집중 작업은 Full Screen으로 정리한다.
- [ ] Bottom Sheet overlay가 목록 스크롤 위치·검색/필터/정렬·선택 맥락을 유지하도록 공통 동작을 구현한다.
- [ ] 공통 버튼, 입력, Bottom Sheet, Dialog, 상태 배지와 반응형 레이아웃을 충분한 touch target 기준으로 정리한다.

## 이후 후보

- 스크린샷/OCR 기반 명부 비교와 사람이 승인하는 변경 후보 화면.
- 회의록 revision/첨부파일.
- 역할 세분화와 감사 로그 검색.
- 실제 사용 데이터에 기반한 UX/쿼리 최적화.
