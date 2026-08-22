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

PostgreSQL이 healthy가 된 뒤 백엔드를 실행한다. `run-backend.ps1`은 저장소 루트의 `.env`를 현재 실행 프로세스 환경변수로만 불러오므로, 비밀값을 Git이나 Windows 사용자 환경변수에 저장하지 않는다.

```powershell
.\scripts\run-backend.ps1
```

### 공유 Neon 개발 DB

집과 회사에서 같은 개발 데이터를 사용하려면 Neon 접속 정보를 각 PC의 `.env`에 직접 설정한다. `.env`는 Git에 포함하지 않으며, 비밀번호 관리 도구 같은 안전한 경로로만 전달한다.

```dotenv
DB_URL=jdbc:postgresql://<Neon host>/<database>?sslmode=require
DB_USERNAME=<Neon role>
DB_PASSWORD=<Neon password>
INITIAL_ADMIN_LOGIN=<administrator login>
INITIAL_ADMIN_PASSWORD=<administrator password>
```

각 PC에서 다음 명령으로 실행한다. Flyway는 이미 적용된 migration을 다시 실행하지 않고 현재 버전만 검증한다.

```powershell
.\scripts\run-backend.ps1
```

회사 네트워크에서 직접 연결이 가능한지는 먼저 확인한다.

```powershell
Test-NetConnection <Neon host> -Port 5432
```

`TcpTestSucceeded`가 `False`면 Docker 설치 여부와 무관하게 회사 네트워크가 PostgreSQL 연결을 차단한 것이다. 이 경우 백엔드를 HTTPS로 배포한 뒤 API로 접근하는 방식으로 전환한다.

다른 터미널에서 프론트엔드를 실행한다.

```powershell
Set-Location frontend
npm ci
npm run dev
```

기본 주소는 프론트 `http://localhost:5173`, 백엔드 `http://localhost:8080`이다. API 프록시와 CORS 정책은 실제 API가 추가되는 Phase 2에서 확정한다.

Windows PowerShell 실행 정책에서 `npm.ps1` 또는 프로젝트의 `.ps1` 스크립트가 차단될 수 있다. 이 경우 프로젝트 명령은 `npm.cmd`로 실행하고, 전체 검증은 시스템 정책을 바꾸지 않는 다음 명령으로 실행한다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify.ps1
```

### 프론트 개발 서버

프론트 로그인과 회원 관리 화면은 항상 백엔드 API를 사용한다. 먼저 `run-backend.ps1`으로 백엔드를 실행한 뒤 프론트 개발 서버를 시작한다. API 프록시를 통해 인증 쿠키를 포함한 요청이 백엔드로 전달된다.

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
| `PORT` | 배포 플랫폼 값 | Render가 주입하는 HTTP 포트. 설정 시 `SERVER_PORT`보다 우선한다. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` (local/dev) | 쉼표로 구분한 프론트 origin 목록. production에서는 Cloudflare Pages 운영 URL을 정확히 입력한다. |
| `QR_TOKEN_ENCRYPTION_KEY` | 없음 | 기존 쿠폰 QR을 재발급 없이 다시 표시하는 Base64 형식 32바이트 AES 키. 새 키는 PowerShell에서 `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`로 생성한다. |
| `INITIAL_ADMIN_LOGIN` | `admin` | 최초 로컬 관리자 로그인 ID |
| `INITIAL_ADMIN_PASSWORD` | 예시값 | 최초 로컬 관리자 비밀번호. 운영에서는 안전한 secret으로 설정 |

운영 비밀값은 저장소 파일이 아니라 배포 환경의 secret 기능으로 주입한다.

공유 Neon 개발 DB를 사용할 때는 `-SpringProfile dev`를 사용한다. `dev`와 `prod` 프로필은 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`가 없으면 시작하지 않는다.

```powershell
.\scripts\run-backend.ps1 -SpringProfile dev
```

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

회사 PC처럼 Docker/WSL2 실행이 제한된 환경에서는 Docker 없이 가능한 compile, unit test, Checkstyle, ESLint, Prettier, Vitest, frontend build만 실행한다. Neon 공유 개발 DB를 사용하면 `run-backend.ps1`으로 Flyway와 실제 DB 연결을 검증할 수 있다. Testcontainers 검증은 Docker가 가능한 환경에서만 실행한다. 제한을 우회하기 위한 별도 로컬 DB, VM, dependency는 도입하지 않는다.

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
