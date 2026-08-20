# 초기 의존성과 라이선스 결정

Phase 1에서 직접 선택한 런타임 및 품질 도구를 기록한다. 전이 의존성 전체 목록은 각 lockfile과 Gradle dependency report가 기준이다.

| 항목 | 선택 | 라이선스 | 도입 이유 |
| --- | --- | --- | --- |
| Spring Boot | 4.1.0 | Apache-2.0 | Java 21 호환, Web/JPA/Validation/Flyway 구성과 테스트 지원 |
| PostgreSQL image | 18.4-bookworm | PostgreSQL License | 운영 DB와 같은 엔진의 재현 가능한 로컬 환경 |
| PostgreSQL JDBC | Spring Boot 관리 버전 | BSD-2-Clause | PostgreSQL 연결 |
| Flyway Community | Spring Boot 관리 버전 | Apache-2.0 | 재현 가능한 스키마 migration |
| Spring Security | Spring Boot 관리 버전 | Apache-2.0 | 로컬 계정, 세션 로그인, 비밀번호 해시와 역할 기반 권한 검증 |
| Testcontainers | 2.0.5 BOM | MIT | 실제 PostgreSQL migration 통합 테스트 |
| Checkstyle | 13.9.0 | LGPL-2.1-or-later | Gradle `check`에 통합되는 Java 정적 스타일 검사 |
| React | lockfile 기준 | MIT | 관리자 SPA UI |
| Vite | lockfile 기준 | MIT | React/TypeScript 개발 서버와 빌드 |
| ESLint 및 TypeScript ESLint | lockfile 기준 | MIT/BSD-2-Clause | TypeScript 정적 검사 |
| Prettier | lockfile 기준 | MIT | 일관된 프론트엔드 포맷 검사 |
| Vitest, Testing Library, jsdom | lockfile 기준 | MIT | 사용자 동작 중심 프론트 단위 테스트 |
| react-markdown | lockfile 기준 | MIT | raw HTML을 렌더링하지 않는 React Markdown 표시 |
| remark-gfm | lockfile 기준 | MIT | 표와 체크박스를 포함한 GitHub Flavored Markdown 지원 |

모두 무료 오픈소스로 사용할 수 있는 라이선스다. `react-markdown`은 `skipHtml` 설정을 사용하고, `remark-gfm`만 연결해 MVP에서 raw HTML과 임의 스크립트를 렌더링하지 않는다. 배포 전에는 자동화된 라이선스/취약점 보고서 도입 여부를 다시 검토한다.
