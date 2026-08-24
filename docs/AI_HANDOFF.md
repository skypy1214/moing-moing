# AI Handoff: Moing Moing

## Operating rules

- Repository root: `C:\dev\moing-moing`.
- Read `AGENTS.md`, then the docs listed there before changing scope.
- User prefers Korean conversation.
- Do not run tests/builds by default. The user asked to batch verification and ask first, except when they explicitly request a focused test.
- Use `apply_patch` for edits. Preserve existing worktree changes.
- Never stage or commit `.env`, `.gradle-agent/`, or `docs/참고용UI (*.png)`.
- Commit/push only when the user explicitly asks.
- `git diff --check` is safe and should be run before handoff/commit.

## Current repository / deployment

- Frontend: React + TypeScript + Vite, deployed on Cloudflare Workers Static Assets.
- Backend: Java 21 + Spring Boot + Gradle, deployed on Render.
- Database: Neon PostgreSQL. Flyway runs on backend startup.
- Local environment values are in `.env` and must never be printed or committed.
- `apiFetch` handles API base URL and emits a global unauthorized event so stale sessions after backend restart log out automatically.

## Worktree state at handoff

The worktree contains a large, uncommitted feature batch across attendance, coupon, shared UI, deployment docs, and migrations. This is intentional and should be committed as one handoff batch only after reviewing `git diff`.

Untracked files that belong to the feature batch:

- `backend/src/main/java/com/moingmoing/coupon/application/CouponQrTokenCipher.java`
- `backend/src/main/resources/db/migration/V8__add_coupon_qr_token_ciphertext.sql`
- `backend/src/main/resources/db/migration/V9__add_coupon_name.sql`
- `backend/src/main/resources/db/migration/V10__allow_host_attendance_participation.sql`
- This handoff file.

Untracked files that are NOT source changes and must not be staged:

- `.gradle-agent/`
- `docs/참고용UI (1).png` through `(5).png`

## Migrations and required deployment order

1. `V8__add_coupon_qr_token_ciphertext.sql`
   - Stores an encrypted current QR token so `QR 보기` does not rotate/revoke an existing QR.
   - Requires `QR_TOKEN_ENCRYPTION_KEY` in backend local/Render environment. Existing old QR records without ciphertext intentionally show `QR 발급` instead of `QR 보기`.
2. `V9__add_coupon_name.sql`
   - Adds nullable `coupons.name` for manual coupon names. Old coupons fall back to the type label.
3. `V10__allow_host_attendance_participation.sql`
   - Recreates `chk_attendances_participation_type` to allow `HOST` in addition to `NORMAL` and `COUPON`.
   - This fixes PostgreSQL error: `violates check constraint chk_attendances_participation_type` when changing attendance to host.

Backend must be restarted/redeployed after these migrations are pushed. Confirm Flyway applies V8–V10 before testing the related flows.

## Coupon behavior implemented

- Coupon list loads on entry and supports status pill filters.
- List order: coupon name, `member name · remaining uses`, validity date.
- Manual issue accepts `name`, description, validity period, unlimited (`9999-12-31`) option, and uses Korean date input.
- Status display is derived in `CouponResponse`:
  - persisted `ISSUED` + `validUntil < LocalDate.now()` => API response status `EXPIRED`;
  - persisted `SUSPENDED`, `FULLY_USED`, `VOIDED` take priority.
- List actions:
  - issued with persisted QR: `QR 보기`, `쿠폰 사용`;
  - issued without viewable QR: `QR 발급`, `쿠폰 사용`;
  - fully used: usage history;
  - other management actions: `⋮` Bottom Sheet.
- Manual coupon void can be restored only while unused.
- Coupon attendance cancellation from AttendancePage calls `POST /api/v1/coupons/usages/attendance/{attendanceId}/reverse`, which reverses both `CouponUsage` and `Attendance` in one transaction.
- Attendance champion awards:
  - month list API: `GET /api/v1/attendance-champion-awards?month=YYYY-MM`;
  - cancel: `POST /{id}/cancel` voids linked unused coupons;
  - restore: `POST /{id}/restore` restores only cancelled awards whose linked coupons are all unused and `VOIDED`;
  - the coupon `⋮` sheet exposes cancel/restore for champion coupons through `championAwardId` in `CouponResponse`.

## Attendance behavior implemented

- Participation values: `NORMAL`, `COUPON`, `HOST`.
- `AttendanceService.recordAttendance` is now an upsert by `(gatheringId, memberId)`:
  - existing `RECORDED`: change participation type in place;
  - existing `CANCELLED`: record again with the selected participation type;
  - absent: create a new record.
- Frontend asks confirmation before changing a member already on the attendance list.
- Cancelled attendance is rendered as red plain text `취소`, not a button-like badge.
- Coupon attendance must be cancelled by coupon-usage reversal; normal/host uses regular attendance cancellation.
- Gathering detail supports `정모 정보 수정` for non-cancelled gatherings (date, title, location) through `PUT /api/v1/gatherings/{id}`.

## Shared UI behavior

- Mobile rules: quick information/actions Bottom Sheet; complex details Page; create/edit Page or focused Dialog; destructive actions confirmation Dialog; QR scan Full Screen.
- `FeedbackDialogProvider` is the common confirmation/feedback mechanism.
- Confirmation actions have 12px gap; cancel is neutral outlined; confirm is primary; destructive confirm is danger red.
- Dialogs close on Escape. Do not reintroduce inline history panels below lists.
- Guest-login link has no shadow in normal/hover/focus states.

## Verification status

- `git diff --check` has passed after changes.
- Focused actual test run completed successfully:
  - `backend`: `gradlew.bat test --tests com.moingmoing.attendance.application.AttendanceServiceTest --rerun-tasks`
- Full backend/frontend test, lint, and build have NOT been run in this batch; ask user before doing them.

## Pending database cleanup requested by user

The user requested deletion of all issued test coupons. This environment has no `psql` and no direct Neon console connector, so deletion was NOT executed here.

Execute in Neon SQL Editor after taking a backup if coupon history matters:

```sql
begin;

delete from coupon_usages;
delete from coupons;

commit;
```

Do NOT delete `attendances` automatically: coupon attendance records are operational attendance data and are not foreign-key-owned by `coupons`. If the user explicitly wants all coupon-created attendance test records removed too, first inspect `coupon_usages` before deleting, or use a purpose-built cleanup query that preserves non-coupon attendance.

## Next-agent checklist

1. Ensure the DB cleanup is performed in Neon if still desired.
2. Review `git diff --stat`, `git diff`, and `git status --short`.
3. Stage only feature source/docs/migrations; exclude `.gradle-agent/`, reference PNGs, `.env`.
4. Commit and push only because the user explicitly requested it in this handoff turn.
5. After deploy, confirm Flyway V8–V10 and manually test: host participation update, coupon cancellation/reversal, expired coupon badge, award cancel/restore, gathering edit.
