# 집 PC 개발 환경 설정 가이드

이 문서는 Windows 집 PC에서 Moing Moing 프로젝트를 동일한 상태로 이어서 개발하기 위한 1회성 체크리스트다. 명령어는 기본적으로 `cmd` 기준이며 PowerShell에서도 대부분 그대로 실행된다.

## 1. 준비할 계정과 설치 프로그램

- GitHub 계정: 이 프로젝트 저장소에 접근 가능한 동일 계정으로 로그인한다.
- OpenAI/ChatGPT 계정: Codex에서 사용할 계정으로 로그인한다.
- [Git for Windows](https://git-scm.com/download/win)
- JDK 21 (Temurin 등 LTS 배포판)
- Node.js 24 LTS
- Docker Desktop: PostgreSQL 개발 DB 실행에 필요하다. WSL 2 backend 사용을 권장한다.
- [Cursor](https://www.cursor.com/): 코드 열람, 터미널, Git 작업용 편집기.
- Codex CLI: 설치와 로그인은 [공식 Codex CLI 문서](https://learn.chatgpt.com/docs/codex/cli)를 따른다.

설치 후 새 터미널을 열고 다음으로 확인한다.

```cmd
git --version
java -version
javac -version
node --version
npm --version
docker --version
docker compose version
codex --version
```

`codex`를 찾지 못하면 공식 문서의 Windows 탭에서 안내하는 설치 방법으로 설치한 뒤 터미널을 다시 연다. Codex는 프로젝트 디렉터리에서 처음 실행할 때 ChatGPT 로그인 또는 제공되는 다른 로그인 방식을 선택한다.

## 2. Git과 GitHub 설정

Git의 작성자 정보는 GitHub/GitLab 원격 저장소와 별개다. 기존 GitLab 프로젝트에 영향을 주지 않도록, clone한 뒤 이 프로젝트에만 local 설정을 둔다.

```cmd
cd C:\dev\moing-moing
git config --local user.name "박성진"
git config --local user.email "GitHub에-등록한-이메일"
```

GitHub 이메일 공개를 원하지 않으면 GitHub Settings > Emails의 noreply 주소를 `user.email`에 사용한다. `safe.directory`는 Codex 등의 도구가 만든 Git 메타데이터를 Git이 안전하게 신뢰하도록 이 프로젝트 경로만 예외로 등록하는 설정이며, 집 PC에서 직접 clone했다면 보통 필요하지 않다.

저장소를 받은 뒤 작성자 정보를 확인/변경할 수 있다.

```cmd
git config --get user.name
git config --get user.email
git remote -v
```

`origin`의 fetch/push 주소가 `https://github.com/<GitHub-아이디>/moing-moing.git`이면 GitHub 원격에 연결된 것이다. push 시 GitHub 로그인이 요구되면 브라우저 인증 또는 Git Credential Manager를 사용한다. 비밀번호를 명령행이나 저장소 파일에 기록하지 않는다.

## 3. 프로젝트 가져오기

원하는 상위 폴더에서 clone한다.

```cmd
cd C:\dev
git clone https://github.com/<GitHub-아이디>/moing-moing.git
cd moing-moing
git status
git log --oneline -1
```

정상이라면 `working tree clean`이 보인다. 이미 clone한 뒤 최신 상태만 가져올 때는 다음을 사용한다.

```cmd
git pull --ff-only
```

`git pull` 전에 로컬 수정이 있다면 먼저 `git status`를 확인한다. 의도하지 않은 변경을 덮어쓰지 않는다.

## 4. Cursor 설정

1. Cursor에서 `C:\dev\moing-moing` 폴더를 연다.
2. 통합 터미널을 열어 현재 경로가 프로젝트 루트인지 확인한다.
3. Cursor가 Java/TypeScript 지원 확장을 제안하면 설치한다. 최소 권장 항목은 Java Extension Pack, ESLint, Prettier, Docker이다.
4. 프로젝트의 `.editorconfig`를 따르도록 EditorConfig 지원을 켠다. 기본 소스/문서 줄바꿈은 LF이며 PowerShell/배치 파일만 CRLF다.
5. Cursor AI에 변경을 요청하더라도 `AGENTS.md`, `REQUIREMENTS.md`, 관련 `docs/`를 먼저 읽도록 요청한다.

Cursor 전용 설정 파일이나 AI 규칙 파일은 아직 추가하지 않는다. 프로젝트의 공통 개발 규칙은 `AGENTS.md`가 기준이다.

## 5. Codex CLI 설정과 사용

프로젝트 루트에서 Codex를 실행한다.

```cmd
cd C:\dev\moing-moing
codex
```

처음 실행하면 ChatGPT 계정으로 로그인한다. 실행 후 다음을 확인한다.

- `/status`: 현재 모델, 작업 디렉터리, 세션 설정 확인
- `/permissions`: 파일 변경·명령 실행 권한 확인
- `/model`: 필요할 때 모델과 reasoning effort 변경

Codex는 저장소 루트의 `AGENTS.md`와 문서 구조를 읽고 작업해야 한다. 새 세션에서 사용할 시작 요청 예시는 다음과 같다.

```text
이 저장소의 AGENTS.md, REQUIREMENTS.md, docs/architecture.md,
docs/domain-model.md, docs/open-questions.md, docs/todo.md를 먼저 읽어.
현재 Phase와 미결정 사항을 요약하고, Phase 2 회원 관리 구현을 시작하기 전에
필요한 결정만 알려줘. 아직 코드를 변경하지 마.
```

Codex에는 API key를 프로젝트 `.env`에 넣을 필요가 없다. Codex 로그인 정보와 프로젝트의 애플리케이션 환경변수는 분리해서 관리한다.

## 6. 애플리케이션 의존성 및 개발 DB 준비

프로젝트 루트에서 로컬 환경변수 파일을 만든다. 이 파일은 Git에 올라가지 않는다.

```cmd
copy .env.example .env
docker compose up -d
docker compose ps
```

PostgreSQL 상태가 healthy인지 확인한 후 각각 다른 터미널에서 실행한다.

백엔드:

```cmd
cd C:\dev\moing-moing\backend
set SPRING_PROFILES_ACTIVE=local
gradlew.bat bootRun
```

프론트엔드:

```cmd
cd C:\dev\moing-moing\frontend
npm ci
npm run dev
```

기본 주소는 프론트엔드 `http://localhost:5173`, 백엔드 `http://localhost:8080`이다. 자세한 실행/DB 중지 규칙은 `docs/development.md`를 기준으로 한다.

## 7. 작업 시작·완료 루틴

작업 시작:

```cmd
cd C:\dev\moing-moing
git status
git pull --ff-only
```

작업 완료 전 전체 검증:

```powershell
.\scripts\verify.ps1
```

이미 의존성을 설치했고 빠른 재검증만 할 때:

```powershell
.\scripts\verify.ps1 -SkipInstall
```

검증 후 변경을 확인하고 업로드한다.

```cmd
git diff --check
git diff
git status
git add .
git commit -m "feat: 변경 목적"
git push
```

`.env`, `node_modules`, 빌드 결과물은 커밋하지 않는다. 중요한 도메인/설계 결정을 바꾸면 같은 작업에서 `REQUIREMENTS.md` 또는 관련 `docs/`도 갱신한다.

## 8. 현재 프로젝트 상태와 다음 작업

- Phase 1 프로젝트 초기화는 완료됐다.
- 백엔드(Spring Boot), 프론트(React/Vite), PostgreSQL Compose, Flyway, 테스트·lint·CI가 준비되어 있다.
- `docs/open-questions.md`의 OQ-01(인증 방식), OQ-02(탈퇴 후 재가입), OQ-03(활동 제외 기간의 월 일부 계산)이 Phase 2 구현 전에 특히 중요하다.
- 무기한 활동 중단은 `MemberActivityExclusion.endDate = null`로 설계 확정됐다. 복귀하면 종료일을 기록하며 기간 중첩은 허용하지 않는다.
- Phase 2는 인증 결정 후 Member와 MemberActivityExclusion의 migration 및 회원 관리 API/UI를 구현하는 단계다.

## 9. 문제 해결

### Git이 `dubious ownership` 오류를 낼 때

현재 프로젝트만 safe directory로 등록한다.

```cmd
git config --global --add safe.directory C:/dev/moing-moing
```

### `LF will be replaced by CRLF` 경고가 나올 때

Windows Git의 줄바꿈 안내 경고이며 보통 커밋을 막지 않는다. 프로젝트의 `.editorconfig` 규칙을 지키고, 파일 전체를 의도 없이 줄바꿈만 바꾸지 않는다.

### Docker를 찾지 못할 때

Docker Desktop을 설치·실행하고 WSL 2 설정을 완료한 뒤 새 터미널에서 `docker version`을 실행한다. Docker 없이도 일부 단위 테스트는 가능하지만 PostgreSQL과 Testcontainers migration 테스트는 실행되지 않는다.
