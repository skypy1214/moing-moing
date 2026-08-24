# Cloudflare Workers + Render + Neon 배포

## 구성

```text
Cloudflare Workers Static Assets (React/Vite + /api/* Worker proxy)
  -- HTTPS 서버 간 API 프록시 --> Render Web Service (Spring Boot)
  -- JDBC TLS 연결 --> Neon PostgreSQL
```

> 2026-08-25 정정: 실제 프론트 배포 주소가 `workers.dev`이므로 Cloudflare Pages Function은 실행되지 않는다. `frontend/wrangler.jsonc`와 `frontend/worker/index.ts`가 `/api/*`를 처리하는 Cloudflare Worker의 기준이다. Worker Dashboard에서 `API_ORIGIN=https://moing-moing-api.onrender.com`을 production 변수로 설정한 뒤 `npm run deploy:worker`로 배포한다.

Neon은 PostgreSQL 서비스이며 Spring Boot 또는 정적 React 파일을 실행하지 않는다. DB 비밀번호는 Cloudflare Pages에 넣지 않고 Render에만 설정한다.

## Render 백엔드

저장소 루트의 `render.yaml`을 Blueprint로 연결하거나 Render Dashboard에서 같은 값을 입력한다.

- Root Directory: `backend`
- Runtime: Docker
- Health Check Path: `/api/v1/ready`
- Plan: Free

Render 환경변수/secret에 다음 값을 설정한다. `DB_*`, 초기 관리자 비밀번호는 secret으로 취급하며 Git에 넣지 않는다.

| 변수 | 값 |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DB_URL` | Neon JDBC URL (`jdbc:postgresql://...?...sslmode=require`) |
| `DB_USERNAME` | Neon role |
| `DB_PASSWORD` | Neon password |
| `CORS_ALLOWED_ORIGINS` | Cloudflare Pages 운영 URL. 예: `https://admin.example.pages.dev` |
| `QR_TOKEN_ENCRYPTION_KEY` | 기존 쿠폰 QR을 다시 보기 위한 Base64 형식 32바이트 AES 키. PowerShell에서 `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`로 한 번 생성해 Render secret으로 저장한다. |
| `INITIAL_ADMIN_LOGIN` | 최초 배포 때만 필요한 관리자 ID |
| `INITIAL_ADMIN_PASSWORD` | 최초 배포 때만 필요한 관리자 비밀번호 |

Render가 `PORT`를 자동 주입하며 Spring Boot는 이를 우선 사용한다. 배포 시 Flyway가 migration을 적용한다. 동시에 여러 인스턴스를 배포하지 않는다.

## Cloudflare Pages 프론트엔드

Git 연동으로 Pages 프로젝트를 만들고 monorepo root directory를 `frontend`로 지정한다.

- Framework preset: React (Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: `24`

Production 환경변수/secret에 다음을 설정하고 재배포한다.

| 변수 | 값 |
| --- | --- |
| `API_ORIGIN` | `https://<render-service>.onrender.com` |

`API_ORIGIN`은 Pages Function에서만 읽는 서버 측 환경변수다. `VITE_API_BASE_URL`은 설정하거나 유지하지 않는다. 브라우저는 상대 경로 `/api/*`만 호출하므로 Render API 주소·DB URL·DB password·관리자 비밀번호는 브라우저 번들에 포함되지 않는다.

Pages Preview URL도 사용할 경우 해당 URL을 `CORS_ALLOWED_ORIGINS`에 쉼표로 추가한다. 배포 URL은 끝의 `/` 없이 입력한다.

### iPhone Safari 로그인 장애 대응

Cloudflare Pages 기본 도메인과 Render 기본 도메인은 서로 다른 등록 도메인이다. 브라우저에서 Render를 직접 호출하면서 세션 쿠키를 사용하면 Safari의 제3자 쿠키 차단으로 로그인 직후 회원 목록 요청이 `401`이 될 수 있다.

- 증상: iPhone에서만 로그인 실패 안내가 보이거나, 로그인 직후 자동 로그아웃된다.
- 원인: 로그인 응답의 Render 세션 쿠키가 Safari에 저장·전송되지 않는다.
- 해결 구조: 브라우저 → Pages의 동일 origin `/api/*` → Pages Function → Render API. 쿠키는 Pages origin의 first-party `Secure; SameSite=Lax` 쿠키로 저장된다.
- 점검 순서: Pages의 `API_ORIGIN` 값, 기존 `VITE_API_BASE_URL` 제거 여부, Pages 재배포 여부, Render의 `SPRING_PROFILES_ACTIVE=prod`와 `CORS_ALLOWED_ORIGINS`를 확인한다.
- 이 구조에서 프론트 코드가 Render URL을 직접 호출하도록 되돌리지 않는다. 자체 도메인을 도입하더라도 같은 등록 도메인의 하위 도메인 또는 이 프록시 구조를 유지한다.

### Render cold start 계측

서버 기동 때 Render 로그에 `startup-profile`을 남긴다. `application-ready durationMs`는 Java `main` 진입부터 모든 Spring 초기화·Flyway·JPA·초기 관리자 확인이 끝날 때까지의 시간이며, 이어지는 최대 12개 `step`은 가장 오래 걸린 Spring 초기화 단계다.

- Render 로그에서 컨테이너 할당/이미지 준비 시각부터 애플리케이션 첫 로그까지가 길면 플랫폼 기동 구간이라 애플리케이션 코드 튜닝 효과가 제한적이다.
- `application-ready durationMs`가 길면 `step`의 상위 항목을 기준으로 Spring bean, JPA/Flyway, 데이터베이스 연결 중 어떤 부분을 최적화할지 결정한다.
- 계측은 로그만 남기며 요청 처리, DB migration, 스키마 검증 설정은 바꾸지 않는다. 분석 후 불필요해지면 제거한다.

## 운영 확인

1. `https://<render-service>.onrender.com/api/v1/ready`가 `{"status":"UP"}`을 반환하는지 확인한다. `/api/v1/health`는 포트가 열렸는지 확인하는 liveness endpoint이고, `/api/v1/ready`는 DB 연결까지 확인하는 readiness endpoint다.
2. Pages 환경변수에 `API_ORIGIN`을 설정한 뒤 Pages를 재배포한다. 로그인, 새로고침 후 세션 유지, 회원 조회/수정을 확인한다.
3. iPhone Safari에서도 로그인 뒤 `/api/v1/members` 요청이 401 없이 유지되는지 확인한다.
4. Cloudflare 운영 URL만 CORS가 허용되고 다른 origin은 차단되는지 확인한다.
5. Neon에서 Flyway migration과 초기 관리자 계정을 확인한다.
6. 실제 휴대폰 HTTPS 환경에서 QR 카메라 권한과 쿠폰 사용을 확인한다.

Render Free는 휴면·월간 사용량 등의 제한이 있어 상시 운영 보장은 하지 않는다. 운영 데이터를 사용하기 전에 Neon 백업·복구 절차와 서비스 제한을 확인한다.
