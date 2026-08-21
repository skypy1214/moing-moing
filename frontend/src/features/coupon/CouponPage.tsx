import { useState } from 'react'
import type { FormEvent } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import type { IDetectedBarcode, IScannerError } from '@yudiel/react-qr-scanner'
import { QRCodeSVG } from 'qrcode.react'

import type { Member } from '../../App'
import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { useFeedbackDialog } from '../../shared/feedback-dialog/useFeedbackDialog'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'

type CouponStatus = 'ISSUED' | 'SUSPENDED' | 'EXPIRED' | 'FULLY_USED' | 'VOIDED'
type CouponType = 'MANUAL_FREE_PASS' | 'ATTENDANCE_CHAMPION'
type AwardStatus = 'GRANTED' | 'CANCELLED' | 'CALCULATED'

type Coupon = {
  id: string
  memberId: string
  couponType: CouponType
  couponStatus: CouponStatus
  validFrom: string
  validUntil: string
  totalUses: number
  remainingUses: number
  issuedReason: string | null
}

type AttendanceChampionAward = {
  id: string
  month: string
  memberId: string
  qualifyingAttendanceCount: number
  rewardUses: number
  policyVersion: string
  awardStatus: AwardStatus
}

type CouponUsage = {
  id: string
  couponId: string
  attendanceId: string
  usageStatus: 'USED' | 'REVERSED'
}

type Gathering = {
  id: string
  heldOn: string
  title: string | null
  gatheringStatus: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
}

const today = new Date().toISOString().slice(0, 10)
const currentMonth = today.slice(0, 7)

const couponStatusLabels: Record<CouponStatus, string> = {
  ISSUED: '사용 가능',
  SUSPENDED: '정지',
  EXPIRED: '만료',
  FULLY_USED: '모두 사용',
  VOIDED: '폐기',
}

const couponTypeLabels: Record<CouponType, string> = {
  MANUAL_FREE_PASS: '수동 무료 쿠폰',
  ATTENDANCE_CHAMPION: '출석왕 쿠폰',
}

type CouponPageProps = {
  members: Member[]
}

export function CouponPage({ members }: CouponPageProps) {
  const { confirm, showFeedbackDialog } = useFeedbackDialog()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [awards, setAwards] = useState<AttendanceChampionAward[]>([])
  const [memberId, setMemberId] = useState('')
  const [validFrom, setValidFrom] = useState(today)
  const [validUntil, setValidUntil] = useState(today)
  const [totalUses, setTotalUses] = useState(1)
  const [issuedReason, setIssuedReason] = useState('')
  const [awardMonth, setAwardMonth] = useState(currentMonth)
  const [message, setMessage] = useState('')
  const [extensionDate, setExtensionDate] = useState(today)
  const [usageHistory, setUsageHistory] = useState<CouponUsage[]>([])
  const [usageHistoryCouponId, setUsageHistoryCouponId] = useState<
    string | null
  >(null)
  const [couponToUse, setCouponToUse] = useState<Coupon | null>(null)
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [gatheringId, setGatheringId] = useState('')
  const [reversalReason, setReversalReason] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [isQrUseOpen, setIsQrUseOpen] = useState(false)
  const [qrValidatedCoupon, setQrValidatedCoupon] = useState<Coupon | null>(
    null,
  )
  const [qrScannerError, setQrScannerError] = useState('')
  const [qrCodeCoupon, setQrCodeCoupon] = useState<Coupon | null>(null)
  const [qrCodeToken, setQrCodeToken] = useState('')

  const memberName = (id: string) =>
    members.find((member) => member.id === id)?.displayName ?? '알 수 없는 회원'

  async function loadCoupons() {
    const response = await fetch('/api/v1/coupons', { credentials: 'include' })
    if (!response.ok) {
      setMessage('쿠폰 목록을 불러오지 못했습니다.')
      return
    }
    setCoupons((await response.json()) as Coupon[])
    setMessage('쿠폰 목록을 새로고침했습니다.')
  }

  async function issueCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!memberId) {
      setMessage('쿠폰을 발급할 회원을 선택해 주세요.')
      return
    }
    const payload = {
      memberId,
      validFrom,
      validUntil,
      totalUses,
      issuedReason: issuedReason || null,
    }
    const response = await fetch('/api/v1/coupons', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setMessage('쿠폰 발급에 실패했습니다. 입력값을 확인해 주세요.')
      return
    }
    const issuedCoupon = (await response.json()) as Coupon
    setCoupons((previous) => [issuedCoupon, ...previous])
    setIssuedReason('')
    setMessage('쿠폰을 발급했습니다.')
  }

  async function changeCoupon(coupon: Coupon, action: 'suspend' | 'void') {
    const response = await fetch(`/api/v1/coupons/${coupon.id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('쿠폰 상태를 변경하지 못했습니다.')
      return
    }
    const changed = (await response.json()) as Coupon
    setCoupons((previous) =>
      previous.map((item) => (item.id === changed.id ? changed : item)),
    )
  }

  async function extendCoupon(coupon: Coupon) {
    if (extensionDate <= coupon.validUntil) {
      setMessage('연장일은 현재 종료일보다 뒤여야 합니다.')
      return
    }
    const response = await fetch(`/api/v1/coupons/${coupon.id}/valid-until`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validUntil: extensionDate }),
    })
    if (!response.ok) {
      setMessage('쿠폰 사용 기간을 연장하지 못했습니다.')
      return
    }
    const changed = (await response.json()) as Coupon
    setCoupons((previous) =>
      previous.map((item) => (item.id === changed.id ? changed : item)),
    )
    setMessage('쿠폰 사용 기간을 연장했습니다.')
  }

  async function loadUsageHistory(coupon: Coupon) {
    setUsageHistoryCouponId(coupon.id)
    const response = await fetch(`/api/v1/coupons/${coupon.id}/usages`, {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('쿠폰 사용 이력을 불러오지 못했습니다.')
      return
    }
    setUsageHistory((await response.json()) as CouponUsage[])
  }

  async function openCouponUse(coupon: Coupon) {
    setCouponToUse(coupon)
    setGatheringId('')
    const response = await fetch('/api/v1/gatherings', {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('열린 출석부를 불러오지 못했습니다.')
      return
    }
    setGatherings(
      ((await response.json()) as Gathering[]).filter(
        (item) => item.gatheringStatus === 'OPEN',
      ),
    )
  }

  async function openQrUse() {
    setIsQrUseOpen(true)
    setGatheringId('')
    setQrToken('')
    setQrValidatedCoupon(null)
    setQrScannerError('')
    const response = await fetch('/api/v1/gatherings', {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('열린 출석부를 불러오지 못했습니다.')
      return
    }
    setGatherings(
      ((await response.json()) as Gathering[]).filter(
        (item) => item.gatheringStatus === 'OPEN',
      ),
    )
  }

  function closeQrUse() {
    setIsQrUseOpen(false)
    setQrToken('')
    setQrValidatedCoupon(null)
    setQrScannerError('')
  }

  async function validateQrToken(token: string) {
    if (token.trim() === '') {
      setQrValidatedCoupon(null)
      return null
    }
    const response = await fetch('/api/v1/coupons/qr/validate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim() }),
    })
    if (!response.ok) {
      setQrValidatedCoupon(null)
      await showFeedbackDialog({
        title: 'QR 코드를 확인할 수 없습니다',
        message: '유효하지 않거나 이미 교체된 QR 코드입니다.',
      })
      return null
    }
    const coupon = (await response.json()) as Coupon
    if (coupon.couponStatus !== 'ISSUED' || coupon.remainingUses === 0) {
      setQrValidatedCoupon(null)
      await showFeedbackDialog({
        title: '사용할 수 없는 쿠폰입니다',
        message: '정지·만료·폐기되었거나 잔여 사용 횟수가 없는 쿠폰입니다.',
      })
      return null
    }
    setQrValidatedCoupon(coupon)
    return coupon
  }

  function handleQrScan(detectedCodes: IDetectedBarcode[]) {
    const token = detectedCodes[0]?.rawValue?.trim()
    if (!token || qrToken !== '') {
      return
    }
    setQrToken(token)
    setQrScannerError('')
    void validateQrToken(token)
  }

  function handleQrScannerError(error: IScannerError) {
    setQrScannerError(error.message)
  }

  async function issueQrCode(coupon: Coupon) {
    const confirmed = await confirm({
      title: '새 QR 코드 발급',
      message:
        '새 QR 코드를 발급하면 기존 QR 코드는 즉시 사용할 수 없게 됩니다.',
      confirmLabel: '새 QR 코드 발급',
      isDestructive: true,
    })
    if (!confirmed) {
      return
    }
    const response = await fetch(`/api/v1/coupons/${coupon.id}/qr-token`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      await showFeedbackDialog({
        title: 'QR 코드 발급 실패',
        message: '쿠폰 상태를 확인한 뒤 다시 시도해 주세요.',
      })
      return
    }
    const result = (await response.json()) as { token: string }
    setQrCodeCoupon(coupon)
    setQrCodeToken(result.token)
  }

  async function useQrToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (qrToken.trim() === '' || gatheringId === '') {
      setMessage('QR 토큰과 열린 모임을 입력해 주세요.')
      return
    }
    const coupon = qrValidatedCoupon ?? (await validateQrToken(qrToken))
    if (coupon === null) {
      return
    }
    const confirmed = await confirm({
      title: '쿠폰 사용 처리',
      message: `${memberName(coupon.memberId)}님의 쿠폰 ${coupon.remainingUses}회 중 1회를 사용하고 출석을 기록합니다.`,
      confirmLabel: '쿠폰 사용 및 출석 기록',
      isDestructive: true,
    })
    if (!confirmed) {
      return
    }
    const response = await fetch('/api/v1/coupons/qr/use', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrToken.trim(), gatheringId }),
    })
    if (!response.ok) {
      setMessage(
        'QR 쿠폰을 사용하지 못했습니다. 토큰과 쿠폰 상태를 확인해 주세요.',
      )
      return
    }
    closeQrUse()
    await loadCoupons()
    setMessage('QR 쿠폰 사용과 출석 기록을 처리했습니다.')
  }

  async function useCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (couponToUse === null || gatheringId === '') {
      setMessage('열린 모임을 선택해 주세요.')
      return
    }
    const response = await fetch(`/api/v1/coupons/${couponToUse.id}/use`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gatheringId }),
    })
    if (!response.ok) {
      setMessage('쿠폰을 사용하지 못했습니다.')
      return
    }
    const usedCoupon = couponToUse
    setCouponToUse(null)
    await loadCoupons()
    await loadUsageHistory(usedCoupon)
    setMessage('쿠폰 사용과 출석 기록을 처리했습니다.')
  }

  async function reverseUsage(usage: CouponUsage) {
    if (usageHistoryCouponId === null || reversalReason.trim() === '') {
      setMessage('사용 취소 사유를 입력해 주세요.')
      return
    }
    const response = await fetch(
      `/api/v1/coupons/${usageHistoryCouponId}/usages/${usage.id}/reverse`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reversalReason }),
      },
    )
    if (!response.ok) {
      setMessage('쿠폰 사용을 취소하지 못했습니다.')
      return
    }
    const coupon = coupons.find((item) => item.id === usageHistoryCouponId)
    if (coupon) await loadUsageHistory(coupon)
    await loadCoupons()
    setMessage('쿠폰 사용과 출석 기록을 취소했습니다.')
  }

  async function grantAwards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/v1/attendance-champion-awards', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: awardMonth }),
    })
    if (!response.ok) {
      setMessage('출석왕 쿠폰을 발급하지 못했습니다.')
      return
    }
    setAwards((await response.json()) as AttendanceChampionAward[])
    setMessage('출석왕 결과를 확정하고 다음 달 쿠폰을 발급했습니다.')
    await loadCoupons()
  }

  async function cancelAward(award: AttendanceChampionAward) {
    const response = await fetch(
      `/api/v1/attendance-champion-awards/${award.id}/cancel`,
      {
        method: 'POST',
        credentials: 'include',
      },
    )
    if (!response.ok) {
      setMessage(
        '수상을 취소하지 못했습니다. 쿠폰을 이미 사용했다면 먼저 사용을 취소해 주세요.',
      )
      return
    }
    const changed = (await response.json()) as AttendanceChampionAward
    setAwards((previous) =>
      previous.map((item) => (item.id === changed.id ? changed : item)),
    )
    setMessage('출석왕 수상과 미사용 쿠폰을 취소했습니다.')
    await loadCoupons()
  }

  return (
    <section className="coupon-page">
      <div className="attendance-page-heading">
        <div>
          <p className="eyebrow">COUPONS</p>
          <h2>{'쿠폰 관리'}</h2>
          <p>{'발급과 상태 변경은 이력으로 보존됩니다.'}</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => void loadCoupons()}
          type="button"
        >
          {'목록 새로고침'}
        </button>
        <button
          className="secondary-button"
          onClick={() => void openQrUse()}
          type="button"
        >
          {'QR 토큰 사용'}
        </button>
      </div>
      <div className="attendance-grid">
        <section className="panel">
          <h2>{'수동 쿠폰 발급'}</h2>
          <form className="form" onSubmit={issueCoupon}>
            <SearchableMemberSelect
              label="회원"
              members={members}
              onChange={setMemberId}
              required
              value={memberId}
            />
            <label>
              {'사용 시작일'}
              <input
                onChange={(event) => setValidFrom(event.target.value)}
                required
                type="date"
                value={validFrom}
              />
            </label>
            <label>
              {'사용 종료일'}
              <input
                onChange={(event) => setValidUntil(event.target.value)}
                required
                type="date"
                value={validUntil}
              />
            </label>
            <label>
              {'사용 가능 횟수'}
              <input
                min="1"
                onChange={(event) => setTotalUses(Number(event.target.value))}
                required
                type="number"
                value={totalUses}
              />
            </label>
            <label>
              {'발급 사유 '}
              <span className="optional">{'(선택)'}</span>
              <textarea
                onChange={(event) => setIssuedReason(event.target.value)}
                value={issuedReason}
              />
            </label>
            <button type="submit">{'쿠폰 발급'}</button>
          </form>
        </section>
        <section className="panel">
          <h2>{'출석왕 자동 발급'}</h2>
          <p className="description">
            {
              'NORMAL 출석 최다자를 확정하고 다음 달 쿠폰을 발급합니다. 동일 월 재실행은 중복 발급하지 않습니다.'
            }
          </p>
          <form className="form" onSubmit={grantAwards}>
            <label>
              {'대상 월'}
              <input
                onChange={(event) => setAwardMonth(event.target.value)}
                required
                type="month"
                value={awardMonth}
              />
            </label>
            <button type="submit">{'출석왕 확정 및 쿠폰 발급'}</button>
          </form>
          {awards.length > 0 && (
            <ul className="coupon-list">
              {awards.map((award) => (
                <li key={award.id}>
                  <div>
                    <strong>{memberName(award.memberId)}</strong>
                    <span>
                      {award.qualifyingAttendanceCount}
                      {'회 · '}
                      {award.rewardUses}
                      {'회 쿠폰 · '}
                      {award.policyVersion}
                    </span>
                  </div>
                  <div>
                    {award.awardStatus === 'GRANTED' && (
                      <button
                        className="danger-button"
                        onClick={() => void cancelAward(award)}
                        type="button"
                      >
                        {'수상 취소'}
                      </button>
                    )}
                    {award.awardStatus === 'CANCELLED' && (
                      <span className="status status-withdrawn">
                        {'취소됨'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{'쿠폰 목록'}</h2>
            <p>{'출석왕 쿠폰은 수상 취소로만 폐기할 수 있습니다.'}</p>
          </div>
        </div>
        {coupons.length === 0 ? (
          <p className="empty-state">{'표시할 쿠폰이 없습니다.'}</p>
        ) : (
          <ul className="coupon-list">
            {coupons.map((coupon) => (
              <li key={coupon.id}>
                <div>
                  <strong>
                    {memberName(coupon.memberId)}
                    {' · '}
                    {couponTypeLabels[coupon.couponType]}
                  </strong>
                  <span>
                    {coupon.remainingUses}
                    {'/'}
                    {coupon.totalUses}
                    {'회 · '}
                    {coupon.validFrom}
                    {' ~ '}
                    {coupon.validUntil}
                  </span>
                  {coupon.issuedReason && <span>{coupon.issuedReason}</span>}
                </div>
                <div className="coupon-actions">
                  <span className="status status-coupon">
                    {couponStatusLabels[coupon.couponStatus]}
                  </span>
                  {coupon.couponStatus === 'ISSUED' && (
                    <button
                      className="secondary-button"
                      onClick={() => void issueQrCode(coupon)}
                      type="button"
                    >
                      {'QR 코드 발급'}
                    </button>
                  )}
                  {coupon.couponStatus === 'ISSUED' && (
                    <button
                      className="secondary-button"
                      onClick={() => void changeCoupon(coupon, 'suspend')}
                      type="button"
                    >
                      {'정지'}
                    </button>
                  )}
                  {coupon.couponStatus !== 'VOIDED' &&
                    coupon.couponStatus !== 'FULLY_USED' && (
                      <button
                        className="secondary-button"
                        onClick={() => void extendCoupon(coupon)}
                        type="button"
                      >
                        {'기간 연장'}
                      </button>
                    )}
                  <button
                    className="secondary-button"
                    onClick={() => void loadUsageHistory(coupon)}
                    type="button"
                  >
                    {'사용 이력'}
                  </button>
                  {coupon.couponStatus === 'ISSUED' && (
                    <button
                      className="secondary-button"
                      onClick={() => void openCouponUse(coupon)}
                      type="button"
                    >
                      {'쿠폰 사용'}
                    </button>
                  )}
                  {coupon.couponStatus === 'ISSUED' &&
                    coupon.couponType === 'MANUAL_FREE_PASS' && (
                      <button
                        className="danger-button"
                        onClick={() => void changeCoupon(coupon, 'void')}
                        type="button"
                      >
                        {'폐기'}
                      </button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className="coupon-extension-field">
          {'기간 연장 종료일'}
          <input
            onChange={(event) => setExtensionDate(event.target.value)}
            type="date"
            value={extensionDate}
          />
        </label>
        {usageHistoryCouponId !== null && (
          <section className="subsection">
            <h3>{'쿠폰 사용 이력'}</h3>
            {usageHistory.length === 0 ? (
              <p className="empty-state">{'사용 이력이 없습니다.'}</p>
            ) : (
              <ul className="coupon-list">
                {usageHistory.map((usage) => (
                  <li key={usage.id}>
                    <span>
                      {usage.usageStatus === 'USED' ? '사용됨' : '사용 취소됨'}
                    </span>
                    <span>{usage.attendanceId}</span>
                    {usage.usageStatus === 'USED' && (
                      <button
                        className="danger-button"
                        onClick={() => void reverseUsage(usage)}
                        type="button"
                      >
                        {'사용 취소'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <label className="coupon-extension-field">
              <input
                onChange={(event) => setReversalReason(event.target.value)}
                placeholder="사용 취소 사유"
                value={reversalReason}
              />
            </label>
          </section>
        )}
      </section>
      {couponToUse !== null && (
        <section className="panel">
          <h2>{'쿠폰 사용 처리'}</h2>
          <form className="form" onSubmit={useCoupon}>
            <label>
              {'열린 모임'}
              <select
                onChange={(event) => setGatheringId(event.target.value)}
                required
                value={gatheringId}
              >
                <option value="">{'선택'}</option>
                {gatherings.map((gathering) => (
                  <option key={gathering.id} value={gathering.id}>
                    {gathering.heldOn}
                    {' · '}
                    {gathering.title ?? '제목 없는 모임'}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="submit">{'쿠폰 사용 및 출석 기록'}</button>
              <button
                className="secondary-button"
                onClick={() => setCouponToUse(null)}
                type="button"
              >
                {'취소'}
              </button>
            </div>
          </form>
        </section>
      )}
      {isQrUseOpen && (
        <section
          aria-labelledby="qr-scanner-heading"
          aria-modal="true"
          className="qr-fullscreen"
          role="dialog"
        >
          <header className="qr-fullscreen-header">
            <div>
              <p className="eyebrow">QR SCANNER</p>
              <h2 id="qr-scanner-heading">{'쿠폰 QR 스캔'}</h2>
            </div>
            <button
              aria-label="QR 스캔 닫기"
              className="modal-close-button"
              onClick={closeQrUse}
              type="button"
            >
              ×
            </button>
          </header>
          <p className="description">
            {
              'QR 코드를 카메라 중앙에 맞춰 주세요. 스캔 후 사용 여부를 확인합니다.'
            }
          </p>
          {qrToken === '' && (
            <div className="qr-scanner-viewfinder">
              <Scanner
                constraints={{ facingMode: 'environment' }}
                formats={['qr_code']}
                onError={handleQrScannerError}
                onScan={handleQrScan}
              />
            </div>
          )}
          {qrScannerError && (
            <p className="message" role="alert">
              {`카메라를 시작하지 못했습니다: ${qrScannerError}`}
            </p>
          )}
          <form className="form qr-use-form" onSubmit={useQrToken}>
            <label>
              {'QR 토큰 (카메라 사용이 어려운 경우 직접 입력)'}
              <textarea
                onChange={(event) => {
                  setQrToken(event.target.value)
                  setQrValidatedCoupon(null)
                }}
                required
                value={qrToken}
              />
            </label>
            {qrToken !== '' && qrValidatedCoupon === null && (
              <button
                className="secondary-button"
                onClick={() => void validateQrToken(qrToken)}
                type="button"
              >
                {'QR 코드 확인'}
              </button>
            )}
            {qrValidatedCoupon && (
              <div className="qr-validated-coupon">
                <strong>{`${memberName(qrValidatedCoupon.memberId)}님의 쿠폰`}</strong>
                <span>{`${qrValidatedCoupon.remainingUses}/${qrValidatedCoupon.totalUses}회 · ${qrValidatedCoupon.validUntil}까지`}</span>
              </div>
            )}
            <label>
              {'열린 모임'}
              <select
                onChange={(event) => setGatheringId(event.target.value)}
                required
                value={gatheringId}
              >
                <option value="">{'선택'}</option>
                {gatherings.map((gathering) => (
                  <option key={gathering.id} value={gathering.id}>
                    {gathering.heldOn}
                    {' · '}
                    {gathering.title ?? '제목 없는 모임'}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button disabled={qrValidatedCoupon === null} type="submit">
                {'QR 쿠폰 사용 및 출석 기록'}
              </button>
              <button
                className="secondary-button"
                onClick={closeQrUse}
                type="button"
              >
                {'취소'}
              </button>
            </div>
          </form>
        </section>
      )}
      {qrCodeCoupon !== null && qrCodeToken !== '' && (
        <section
          aria-labelledby="qr-code-heading"
          aria-modal="true"
          className="qr-fullscreen"
          role="dialog"
        >
          <header className="qr-fullscreen-header">
            <div>
              <p className="eyebrow">COUPON QR</p>
              <h2 id="qr-code-heading">{'쿠폰 QR 코드'}</h2>
            </div>
            <button
              aria-label="QR 코드 닫기"
              className="modal-close-button"
              onClick={() => {
                setQrCodeCoupon(null)
                setQrCodeToken('')
              }}
              type="button"
            >
              ×
            </button>
          </header>
          <div className="qr-code-display">
            <QRCodeSVG
              level="M"
              marginSize={4}
              size={280}
              title={`${memberName(qrCodeCoupon.memberId)}님의 쿠폰 QR 코드`}
              value={qrCodeToken}
            />
            <strong>{`${memberName(qrCodeCoupon.memberId)}님의 쿠폰`}</strong>
            <span>{`${qrCodeCoupon.remainingUses}/${qrCodeCoupon.totalUses}회 사용 가능`}</span>
            <p>{'이 QR 코드는 운영진의 스캔·확인 후에만 사용 처리됩니다.'}</p>
          </div>
        </section>
      )}
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
