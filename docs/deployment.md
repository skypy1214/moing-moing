# Cloudflare Pages + Render + Neon 배포

## 구성

```text
Cloudflare Pages (React/Vite)
  -- HTTPS API 요청 --> Render Web Service (Spring Boot)
  -- JDBC TLS 연결 --> Neon PostgreSQL
```

Neon은 PostgreSQL 서비스이며 Spring Boot 또는 정적 React 파일을 실행하지 않는다. DB 비밀번호는 Cloudflare Pages에 넣지 않고 Render에만 설정한다.

## Render 백엔드

저장소 루트의 `render.yaml`을 Blueprint로 연결하거나 Render Dashboard에서 같은 값을 입력한다.

- Root Directory: `backend`
- Runtime: Docker
- Health Check Path: `/api/v1/health`
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

Production 환경변수에 다음을 설정하고 재배포한다.

| 변수 | 값 |
| --- | --- |
| `VITE_API_BASE_URL` | `https://<render-service>.onrender.com` |

`VITE_`로 시작하는 값은 브라우저에 포함된다. API URL만 넣고 DB URL, DB password, 관리자 비밀번호 같은 secret은 절대로 넣지 않는다.

Pages Preview URL도 사용할 경우 해당 URL을 `CORS_ALLOWED_ORIGINS`에 쉼표로 추가한다. 배포 URL은 끝의 `/` 없이 입력한다.

## 운영 확인

1. `https://<render-service>.onrender.com/api/v1/health`가 `{"status":"UP"}`을 반환하는지 확인한다.
2. Pages에서 로그인, 새로고침 후 세션 유지, 회원 조회/수정을 확인한다.
3. Cloudflare 운영 URL만 CORS가 허용되고 다른 origin은 차단되는지 확인한다.
4. Neon에서 Flyway migration과 초기 관리자 계정을 확인한다.
5. 실제 휴대폰 HTTPS 환경에서 QR 카메라 권한과 쿠폰 사용을 확인한다.

Render Free는 휴면·월간 사용량 등의 제한이 있어 상시 운영 보장은 하지 않는다. 운영 데이터를 사용하기 전에 Neon 백업·복구 절차와 서비스 제한을 확인한다.
