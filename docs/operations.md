# 운영 로그와 오류 추적

## 운영 인프라와 배포 경로

```text
사용자 브라우저
  -> Cloudflare Worker (https://moing-moing.ddrd.workers.dev)
     - React/Vite 정적 파일 제공
     - /api/* 요청을 Render로 프록시
     - Cron 및 KV로 Render warm-up 상태 관리
  -> Render Web Service (moing-moing-api, Spring Boot)
  -> Neon PostgreSQL (moing-moing-dev)
```

- 프런트엔드는 Cloudflare Workers Static Assets로 제공한다. `frontend/worker/index.ts`가 Worker 진입점이고, `frontend/wrangler.jsonc`가 Worker·KV·Cron 설정의 기준이다.
- 백엔드는 Render의 `moing-moing-api` 서비스에서 동작한다. `main` 브랜치의 백엔드 변경은 Render의 자동 배포 설정에 따라 반영한다.
- DB는 Neon PostgreSQL이며, Spring Boot가 JDBC로 연결하고 시작 시 Flyway migration을 적용한다.
- 현재 GitHub Actions(`.github/workflows/ci.yml`)는 `main` 푸시 시 검증만 수행한다. Cloudflare Worker를 배포하지 않으므로, Worker 변경은 `frontend`에서 `npm run deploy:worker`를 실행해야 한다.
- Worker 배포 후에는 `https://moing-moing.ddrd.workers.dev`와 필요한 제어 API를 실제 HTTP 요청으로 확인한다. 단순 GitHub 푸시만으로 Worker가 바뀌었다고 가정하지 않는다.

## 환경변수·외부 서비스 설정 작업 원칙

- 비밀값은 채팅, Git, 문서, 로그에 저장하지 않는다. 값이 대화에 노출되었으면 작업 완료 후 새 값으로 교체한다.
- Cloudflare·Render·Neon 설정이 필요하면, 소유자가 최소 권한의 단기 토큰 또는 OAuth 로그인을 제공하고 에이전트가 직접 등록·배포·운영 URL 검증까지 수행한다.
- Cloudflare Worker의 민감한 값은 일반 Variable이 아니라 Worker Secret으로 등록한다. 예: `npx wrangler secret put WARMUP_CONTROL_TOKEN`.
- Render와 Worker가 공유하는 값은 이름과 값이 완전히 같아야 한다. 현재 warm-up 제어에는 다음 쌍이 필요하다.
  - Render `WARMUP_CONTROL_WORKER_URL`: Worker의 `/_internal/warmup-control` URL
  - Render `WARMUP_CONTROL_TOKEN` = Cloudflare Worker Secret `WARMUP_CONTROL_TOKEN`
- `WARMUP_STATE` KV 값이 없거나 `false`면 warm-up Cron은 Render와 Neon을 호출하지 않는다. 기본값은 꺼짐이다.
- 환경변수 변경 뒤에는 해당 플랫폼의 배포를 완료하고 실제 요청으로 검증한다. Render는 **Save, rebuild, and deploy**, Cloudflare Worker는 `wrangler deploy` 또는 Dashboard Deploy가 필요하다.

## 요청 로그

백엔드는 `/api/v1/health`, `/api/v1/ready`를 제외한 모든 API 요청에 대해 다음 정보만 로그로 남긴다.

- `requestId`, HTTP 메서드, 경로(쿼리 문자열 제외), 상태 코드, 처리 시간
- 2xx~3xx는 `INFO`, 4xx는 `WARN`, 5xx는 `ERROR`

비밀번호, 세션 쿠키, Authorization 헤더, 요청·응답 본문, 회원 개인정보는 로그에 남기지 않는다. `X-Request-Id` 응답 헤더를 통해 브라우저, Cloudflare Worker, Render 백엔드의 같은 요청을 연결한다.

예상하지 못한 서버 오류는 `INTERNAL_ERROR`와 요청 ID만 클라이언트에 반환하고, Render에는 요청 ID와 예외 stack trace를 `ERROR`로 남긴다. 사용자가 오류를 제보하면 요청 ID와 발생 시각을 함께 받아 Render Logs에서 검색한다.

## 플랫폼별 확인 위치

- Render: `moing-moing-api` 서비스의 **Logs**에서 `requestId=<값>` 또는 `api-request`를 검색한다.
- Cloudflare: `Workers & Pages` > `moing-moing` > **Observability**에서 `api-proxy` 또는 요청 ID를 검색한다. Worker observability는 모든 요청을 표본으로 남긴다.
- Neon: **Monitoring**에서 활성 쿼리와 쿼리 이력을 확인한다. 애플리케이션 예외의 기준 로그는 Render다.

로그에는 비밀값이나 개인정보를 추가하지 않는다. 장기 보관이나 자동 알림이 필요해질 때만 외부 로그 저장소 또는 모니터링을 검토한다.

## 운영 계정과 작업 이력

`ADMIN` 계정만 운영 관리 화면에서 계정을 발급하고 권한을 수정하거나 비밀번호를 초기화할 수 있다. 최초 관리자 외에 발급 가능한 로그인 역할은 모임장, 운영진, 회원이며, 관리자 외 계정은 읽기와 톱니바퀴 메뉴의 본인 표시 이름·비밀번호 변경만 가능하다.

운영 계정 로그인 ID는 영문 대·소문자, 숫자, 점(`.`), 밑줄(`_`), 하이픈(`-`)만 사용해 2~20자로 발급한다. 공백과 한글은 사용할 수 없으며, 이미 사용 중인 ID는 발급할 수 없다.

관리자가 비밀번호를 초기화하면 서버가 임시 비밀번호를 생성해 한 번만 화면에 표시한다. 변경 요청은 DB의 `ActivityLog`에도 작업자, 대상, 결과와 시각을 남긴다. 관리자는 운영 관리 화면에서 최근 이력을 확인한다. 비밀번호 원문은 어떤 로그나 이력에도 저장하지 않는다.
