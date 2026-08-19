# Moing Moing 개발 에이전트 지침

이 저장소는 소모임 운영진용 관리 웹 애플리케이션이다. 이 파일은 빠른 작업 진입점이며, 상세 내용은 `docs/`를 source of truth로 사용한다.

## 작업 전 읽기 순서

1. `REQUIREMENTS.md`: 확정 범위와 미확정 요구사항
2. `docs/architecture.md`: 시스템 경계와 기술 구조
3. `docs/domain-model.md`: 엔티티, 관계, 핵심 불변조건
4. `docs/open-questions.md`: 구현 전에 결정할 사항
5. `docs/todo.md`: 현재 단계와 완료 조건
6. `docs/development.md`: 로컬 실행, DB, 환경변수, 검증 명령
7. `docs/dependencies.md`: 주요 의존성 선택 이유와 라이선스

문서와 구현이 달라지면 같은 변경에서 문서도 갱신한다. 중요한 결정은 이유와 함께 관련 문서에 기록한다.

## 핵심 규칙

- Java 21, Spring Boot, Gradle, PostgreSQL, Flyway와 React, TypeScript, Vite를 기본 스택으로 한다.
- 단일 배포 가능한 백엔드와 단일 프론트엔드로 시작한다. 마이크로서비스, Kafka, Redis, CQRS/Event Sourcing을 선제 도입하지 않는다.
- Controller에는 요청 변환과 응답 조립만 둔다. 비즈니스 규칙은 application/service 계층에 둔다.
- JPA Entity를 API에 직접 노출하지 않고 요청/응답 DTO를 사용한다.
- 회원 탈퇴 및 중요한 이력은 물리 삭제하지 않는다. 과거 출석과 쿠폰 사용 이력의 참조 무결성을 보존한다.
- 스키마 변경은 Flyway migration으로만 관리한다. 적용된 migration을 수정하지 말고 새 파일을 추가한다.
- 통계 규칙처럼 바뀔 가능성이 큰 정책은 한 곳에 모으되, 필요 이상의 프레임워크나 추상 계층을 만들지 않는다.
- 새 의존성을 추가하기 전 필요성, 대안, 유지보수 상태, 무료 사용 가능 여부와 라이선스를 확인하고 관련 문서 또는 PR/커밋 설명에 기록한다.
- 비밀값을 커밋하지 않는다. `.env.example`에는 키 이름과 안전한 예시만 둔다.
- 기능 구현 전에 관련 open question이 결과를 크게 바꾸는지 확인한다. 그렇다면 먼저 결정하고 문서화한다.

## 권장 저장소 구조

```text
backend/                 Spring Boot 애플리케이션
frontend/                React 애플리케이션
docs/                    설계, 결정, 운영 문서
scripts/                 반복 가능한 로컬 검증 스크립트
docker-compose.yml       개발용 PostgreSQL (초기화 단계에서 추가)
```

기능별 패키지(`member`, `attendance`, `coupon`, `meetingnote`, `statistics`, `auth`)를 우선하고, 각 기능 안에서 API/application/domain/infrastructure 책임을 단순하게 분리한다.

## 빌드, 테스트, 품질 검증

프로젝트 초기화 후 저장소 루트에서 실행 가능한 단일 검증 명령을 제공한다. Windows가 주 개발 환경이므로 우선 `./scripts/verify.ps1`, CI/Linux 호환이 필요하면 동일 동작의 `./scripts/verify.sh`를 둔다.

전체 검증은 최소한 다음을 순서대로 포함해야 한다.

```text
backend:  Gradle wrapper build (컴파일, 테스트, 정적 검사 포함)
frontend: npm clean install, lint, test --run, build
repository: git diff --check, git status --short
```

- Gradle은 시스템 설치가 아닌 wrapper를 사용한다.
- Node 패키지 매니저는 초기화 시 하나로 확정하고 lockfile을 커밋한다. 기본 제안은 npm이다.
- 포맷터/린터는 자동화 가능하고 팀 부담이 낮은 구성을 택한다. 백엔드는 Checkstyle, 프론트는 ESLint와 Prettier를 사용한다.
- 기능 변경에는 정상 흐름과 핵심 실패/경계 조건 테스트를 추가한다.
- DB 의존 통합 테스트에는 필요할 때 Testcontainers PostgreSQL을 사용한다. 단순 단위 테스트까지 컨테이너를 요구하지 않는다.
- 로컬에서 실행하지 못한 검증이 있으면 완료 보고에 명시한다.

현재는 애플리케이션이 생성되지 않았으므로 위 명령과 스크립트도 아직 존재하지 않는다. 빈 스크립트를 먼저 만들지 말고 Phase 1에서 실제 프로젝트 명령과 함께 추가한다.

## Git 규칙

- 작업 시작 전 `git status --short`로 사용자 변경을 확인하고 보존한다.
- 한 변경은 한 목적에 집중하며 생성물, 비밀값, IDE 개인 설정을 커밋하지 않는다.
- 사용자가 요청하지 않은 `reset --hard`, 강제 push, 기존 변경 삭제를 하지 않는다.
- 커밋은 사용자가 요청한 경우에만 만들고, 메시지에는 변경 목적이 드러나게 한다.
- 완료 전에 전체 검증 명령과 `git diff --check`, `git diff`, `git status --short`를 확인한다.

## 자동화 도입 원칙

- CI는 Phase 1에서 GitHub Actions로 build/test/lint를 수행하도록 구성한다.
- Git hook은 모든 커밋을 느리게 하거나 개발 환경을 강제할 수 있어 초기에는 두지 않는다. 반복 실수가 확인되면 가벼운 포맷/비밀 검사만 재검토한다.
- AI/agent 프레임워크는 추가하지 않는다. 필요해지면 목적, 비용, 대안을 먼저 설명하고 승인을 받는다.
