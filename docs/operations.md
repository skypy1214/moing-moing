# 운영 로그와 오류 추적

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

`ADMIN` 계정만 운영 관리 화면에서 계정을 발급하고 권한을 수정하거나 비밀번호를 초기화할 수 있다. 발급 가능한 로그인 역할은 관리자, 모임장, 운영진, 회원이며, 관리자 외 계정은 읽기와 톱니바퀴 메뉴의 본인 표시 이름·비밀번호 변경만 가능하다.

관리자가 비밀번호를 초기화하면 서버가 임시 비밀번호를 생성해 한 번만 화면에 표시한다. 변경 요청은 DB의 `ActivityLog`에도 작업자, 대상, 결과와 시각을 남긴다. 관리자는 운영 관리 화면에서 최근 이력을 확인한다. 비밀번호 원문은 어떤 로그나 이력에도 저장하지 않는다.
