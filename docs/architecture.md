# 시스템 아키텍처

## 1. 결론

예상 규모와 운영 복잡도를 고려하면 React SPA, 단일 Spring Boot 애플리케이션, 단일 PostgreSQL 데이터베이스가 적절하다. 백엔드는 기능별 모듈 경계를 가진 모듈러 모놀리스 형태로 구성하되 별도 서비스로 분리하지 않는다. 프론트와 백엔드는 개발 시 별도 프로세스로 실행하고, 배포는 같은 호스트 또는 관리형 정적 호스팅 + 단일 API 중 운영이 단순한 방식을 선택한다.

```text
[운영자 브라우저 / React + TypeScript]
                 |
              HTTPS REST
                 |
[Spring Boot: auth, member, attendance, statistics,
              coupon, meeting-note]
                 |
              JPA/Flyway
                 |
             [PostgreSQL]
```

QR은 쿠폰 원문이나 예측 가능한 DB ID가 아닌 고엔트로피의 불투명 토큰 또는 토큰을 포함한 검증 URL을 표현한다. 브라우저가 QR을 읽으면 백엔드가 현재 상태와 권한을 검증하고, 별도 확인 동작으로 사용 처리한다.

## 2. 저장소와 애플리케이션 구조

모노레포를 사용한다.

```text
backend/
  src/main/java/.../
    member/
    attendance/
    statistics/
    coupon/
    meetingnote/
    auth/
    common/
  src/main/resources/db/migration/
frontend/
  src/features/
  src/shared/
docs/
scripts/
```

백엔드는 각 기능 안에서 다음 책임만 구분한다.

- API: Controller, 요청/응답 DTO, HTTP 오류 변환.
- Application: 유스케이스, 트랜잭션 경계, 권한 확인, 도메인 객체 조정.
- Domain: Entity와 값 객체, 상태 전이 및 계산 규칙.
- Infrastructure: JPA repository와 외부 기술 연동.

작은 기능에 빈 계층이나 인터페이스를 억지로 만들지 않는다. 기능 간 직접 Entity 조작은 피하고 application service 또는 명시적 조회 경계를 사용한다. 순환 의존성이 나타날 때만 모듈 경계를 강화한다.

## 3. API 원칙

- `/api/v1` 아래 리소스 중심 REST API를 제공한다.
- 요청과 응답은 DTO로 정의하고 Bean Validation을 적용한다.
- 오류 응답은 일관된 문제 상세 형식(HTTP 상태, 안정적인 오류 코드, 메시지, 필드 오류, 추적 ID)을 사용한다. 현재 MVP는 `{ code, message, fieldErrors? }`를 반환하며, `fieldErrors`는 필드명과 메시지의 맵이다. 추적 ID는 운영 관측성 도입 시 추가한다.
- 목록 API는 데이터가 작더라도 페이지네이션과 안정적인 정렬 기준을 제공한다.
- 날짜는 도메인 의미에 맞게 `LocalDate`, 시각은 저장 시 UTC `Instant`, 표시 시 `Asia/Seoul`을 기본으로 한다. 월 경계의 기준 시간대는 설정으로 명시한다.
- 동시 사용 처리 등 경쟁이 가능한 변경은 DB 제약과 낙관적 잠금 또는 조건부 update로 원자성을 보장한다.

## 4. 인증과 권한 검토

관리자 전용이고 사용자가 적더라도 회원 정보, 활동 기록과 유효 쿠폰을 다루므로 운영 환경에는 인증이 필요하다. "사용자가 10명 미만"은 인증 생략의 근거가 되지 않는다.

MVP 권장안은 Spring Security 기반 세션 인증이다.

- 같은 사이트에서 SPA와 API를 제공하거나 reverse proxy로 동일 origin을 만들면 HttpOnly/Secure/SameSite 쿠키와 CSRF 보호를 단순하게 운영할 수 있다.
- 자체 JWT 발급/갱신 구조는 현재 규모에서 불필요한 복잡성을 만든다.
- 비밀번호를 사용할 경우 적절한 적응형 해시를 적용하며 초기 관리자 생성 절차가 필요하다.
- 최소 역할은 `ADMIN` 하나로 시작할 수 있다. 쿠폰 사용 담당자를 분리해야 하면 `OPERATOR`/`VIEWER`를 추가한다.
- 로그인 시도 제한과 감사 로그 범위는 배포 전에 결정한다.

GitHub/Google OIDC 로그인은 비밀번호 운영을 줄일 수 있으나 외부 공급자 설정과 계정 종속성이 생긴다. 배포 환경과 운영진 계정 형태가 정해진 뒤 세션 기반 로컬 계정과 OIDC 중 선택한다. 개발 초기에는 인증을 임시 우회할 수 있지만 운영 프로필에서는 절대 허용하지 않는다.

## 5. 데이터와 이력 원칙

- PostgreSQL foreign key, unique/check 제약을 애플리케이션 검증과 함께 사용한다.
- 회원은 탈퇴 시 상태와 일자를 변경하고 행을 보존한다.
- 출석, 쿠폰 사용, 월간 보상 결과는 불변에 가까운 이력으로 취급한다. 오류 정정은 감사 가능한 취소/정정 정보를 남기는 방향을 우선한다.
- 회의록과 쿠폰은 숨김/폐기 상태를 사용한다. 법적·운영상 물리 삭제가 필요한 경우 참조 여부와 감사 요건을 확인하는 별도 유스케이스로 제한한다.
- 생성/수정 시각과 가능한 경우 수행 운영자 ID를 기록한다.
- 통계는 초기에는 원천 데이터를 쿼리해 계산한다. 규모상 집계 테이블이나 캐시는 필요하지 않다. 월간 출석왕의 확정/보상 결과만 재현성과 중복 방지를 위해 별도 기록한다.

## 6. 프론트엔드

- 기능별 화면/상태를 `features` 아래에 둔다.
- 서버 상태와 폼/화면 상태를 구분한다. 데이터 패칭 라이브러리는 실제 중복/캐시 문제가 확인되거나 초기화 시 합의한 뒤 도입한다.
- QR 생성/스캔과 Markdown은 검증된 무료 오픈소스 라이브러리를 후보 비교 후 선택한다. 사용자 Markdown 렌더링은 raw HTML을 기본 금지하고 XSS 방어 설정과 테스트를 둔다.
- 데스크톱 관리자 화면을 우선하되 QR 검증/사용 화면은 휴대폰에서 사용할 수 있는 반응형 UI로 만든다.

## 7. 개발·검증 환경

- 개발용 PostgreSQL은 고정 버전 이미지의 Docker Compose로 제공하고 데이터 볼륨, healthcheck, 안전한 개발 기본값을 둔다.
- 백엔드 설정은 local/test/prod 프로필로 분리하고 비밀값은 환경변수로 주입한다. 저장소에는 `.env.example`만 커밋한다.
- 단위 테스트는 외부 자원 없이 빠르게 실행한다. repository/migration 및 중요한 트랜잭션 테스트는 Testcontainers PostgreSQL을 사용해 운영 DB와의 차이를 줄인다.
- 루트 검증 스크립트와 GitHub Actions가 동일한 기본 명령을 호출하도록 한다.
- CI는 backend build/test, frontend lint/test/build, migration 검증을 수행한다. Git hook은 초기에는 사용하지 않는다.

## 8. 배포와 운영

초기 배포 단위는 프론트 정적 파일, Spring Boot 실행 파일, PostgreSQL이다. 한 대의 소형 서버에서 Docker Compose로 운영하거나 프론트 정적 호스팅 + 관리형 앱/DB를 쓸 수 있다. 최종 선택 전 다음을 확인한다.

- HTTPS와 동일 origin 구성 가능 여부.
- PostgreSQL 자동 백업, 복원 리허설, 보존 기간.
- Flyway migration을 배포 시 한 번만 안전하게 실행하는 방법.
- 운영 로그에서 개인정보와 QR 토큰을 마스킹하는 방법.
- 비용, 무료 티어의 휴면/데이터 손실 조건, 리전.

## 9. 의도적으로 제외한 구조

현재는 별도 인증 서비스, API gateway, message broker, Redis cache, 검색 엔진, 이벤트 소싱, Kubernetes가 필요하지 않다. 실제 성능 측정, 운영 장애 또는 명확한 기능 요구가 생길 때 결정 기록과 함께 재검토한다.
