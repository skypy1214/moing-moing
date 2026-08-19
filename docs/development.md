# 로컬 개발 환경

## 필수 도구

- JDK 21
- Node.js 24 LTS와 npm
- Git
- Docker Desktop 또는 Docker Engine + Compose plugin

Gradle은 저장소의 wrapper를 사용하므로 별도 설치하지 않는다. 현재 고정 버전과 선택 근거는 `docs/dependencies.md`를 참고한다.

## 최초 설정

저장소 루트에서 필요하면 `.env.example`을 `.env`로 복사한다. 기본값은 로컬 개발 전용이며 운영 환경에서 사용하면 안 된다.

```powershell
Copy-Item .env.example .env
docker compose up -d
docker compose ps
```

PostgreSQL이 healthy가 된 뒤 백엔드를 실행한다.

```powershell
Set-Location backend
$env:SPRING_PROFILES_ACTIVE = 'local'
.\gradlew.bat bootRun
```

다른 터미널에서 프론트엔드를 실행한다.

```powershell
Set-Location frontend
npm ci
npm run dev
```

기본 주소는 프론트 `http://localhost:5173`, 백엔드 `http://localhost:8080`이다. API 프록시와 CORS 정책은 실제 API가 추가되는 Phase 2에서 확정한다.

## 환경변수

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `POSTGRES_DB` | `moing_moing` | Compose DB 이름 |
| `POSTGRES_USER` | `moing_moing` | Compose DB 사용자 |
| `POSTGRES_PASSWORD` | `local_dev_only` | 로컬 DB 비밀번호 |
| `POSTGRES_PORT` | `5432` | 호스트 공개 포트 |
| `DB_URL` | `jdbc:postgresql://localhost:5432/moing_moing` | 백엔드 JDBC URL |
| `DB_USERNAME` | `moing_moing` | 백엔드 DB 사용자 |
| `DB_PASSWORD` | `local_dev_only` | 백엔드 DB 비밀번호 |
| `SERVER_PORT` | `8080` | 백엔드 HTTP 포트 |

운영 비밀값은 저장소 파일이 아니라 배포 환경의 secret 기능으로 주입한다.

## 검증 명령

전체 검증:

```powershell
.\scripts\verify.ps1
```

이미 `npm ci`를 실행했고 빠르게 다시 검사할 때만 다음을 사용할 수 있다.

```powershell
.\scripts\verify.ps1 -SkipInstall
```

전체 검증은 백엔드 clean build/test/Checkstyle, 프론트 npm clean install/ESLint/Prettier/Vitest/build, `git diff --check`, `git status --short`를 실행한다. Docker가 없으면 Testcontainers migration 테스트는 skip된다. CI에는 Docker가 있으므로 해당 테스트가 실행되어야 한다.

개별 명령:

```powershell
Set-Location backend
.\gradlew.bat build
.\gradlew.bat test

Set-Location ..\frontend
npm run lint
npm test
npm run build
```

## DB 종료와 초기화

데이터를 보존하며 종료:

```powershell
docker compose down
```

개발 데이터를 모두 삭제하는 `docker compose down --volumes`는 복구할 수 없으므로, 대상이 로컬 개발 DB인지 확인하고 명시적으로 필요할 때만 실행한다.

## Git hook

현재 Git hook은 사용하지 않는다. 커밋마다 전체 검증을 강제하는 대신 루트 검증 스크립트와 CI를 기준으로 삼는다. 반복되는 가벼운 실수가 확인될 때만 도입을 재검토한다.

