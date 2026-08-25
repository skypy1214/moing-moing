import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import type { IDetectedBarcode, IScannerError } from '@yudiel/react-qr-scanner'
import { QRCodeSVG } from 'qrcode.react'

import type { Member } from '../../App'
import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { useFeedbackDialog } from '../../shared/feedback-dialog/useFeedbackDialog'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'
import { EmptyState } from '../../shared/ui/EmptyState'
import {
  KoreanDateInput,
  formatKoreanDate,
} from '../../shared/ui/KoreanDateInput'
import { RefreshIcon } from '../../shared/ui/RefreshIcon'
import { SelectField } from '../../shared/ui/SelectField'
import { Modal } from '../../shared/ui/Modal'
import { useEscapeKey } from '../../shared/ui/useEscapeKey'

type CouponStatus = 'ISSUED' | 'SUSPENDED' | 'EXPIRED' | 'FULLY_USED' | 'VOIDED'
type CouponType = 'MANUAL_FREE_PASS' | 'ATTENDANCE_CHAMPION'
type AwardStatus = 'GRANTED' | 'CANCELLED' | 'CALCULATED'
type CouponFilter = 'ALL' | CouponStatus

type Coupon = {
  id: string
  memberId: string
  couponType: CouponType
  couponStatus: CouponStatus
  validFrom: string
  validUntil: string
  totalUses: number
  remainingUses: number
  name: string | null
  issuedReason: string | null
  championAwardId: string | null
  hasQrCode: boolean
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
  FULLY_USED: '사용 완료',
  VOIDED: '폐기',
}

const couponTypeLabels: Record<CouponType, string> = {
  MANUAL_FREE_PASS: '수동 무료 쿠폰',
  ATTENDANCE_CHAMPION: '출석왕 쿠폰',
}

function couponValidityLabel(coupon: Coupon) {
  if (coupon.validUntil === '9999-12-31') {
    return `${formatKoreanDate(coupon.validFrom)}부터 · 무기한`
  }
  return `${formatKoreanDate(coupon.validFrom)} ~ ${formatKoreanDate(coupon.validUntil)}`
}

type CouponPageProps = {
  members: Member[]
  readOnly?: boolean
}

export function CouponPage({ members, readOnly = false }: CouponPageProps) {
  const { confirm, showFeedbackDialog } = useFeedbackDialog()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [awards, setAwards] = useState<AttendanceChampionAward[]>([])
  const [couponFilter, setCouponFilter] = useState<CouponFilter>('ALL')
  const [memberId, setMemberId] = useState('')
  const [validFrom, setValidFrom] = useState(today)
  const [validUntil, setValidUntil] = useState(today)
  const [isUnlimited, setIsUnlimited] = useState(false)
  const [totalUses, setTotalUses] = useState(1)
  const [couponName, setCouponName] = useState('')
  const [issuedReason, setIssuedReason] = useState('')
  const [awardMonth, setAwardMonth] = useState(currentMonth)
  const [isCouponIssuePage, setIsCouponIssuePage] = useState(false)
  const [isAwardIssueOpen, setIsAwardIssueOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [extensionDate, setExtensionDate] = useState(today)
  const [usageHistory, setUsageHistory] = useState<CouponUsage[]>([])
  const [usageHistoryCouponId, setUsageHistoryCouponId] = useState<
    string | null
  >(null)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
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

  const loadCoupons = useCallback(async () => {
    const response = await fetch('/api/v1/coupons', { credentials: 'include' })
    if (!response.ok) {
      setMessage('쿠폰 목록을 불러오지 못했습니다.')
      return
    }
    setCoupons((await response.json()) as Coupon[])
    setMessage('쿠폰 목록을 새로고침했습니다.')
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronous request updates server-backed state after this effect returns.
    void loadCoupons()
  }, [loadCoupons])

  const loadAwards = useCallback(async () => {
    const response = await fetch(
      `/api/v1/attendance-champion-awards?month=${encodeURIComponent(awardMonth)}`,
      { credentials: 'include' },
    )
    if (!response.ok) {
      setMessage('선택한 달의 출석왕 결과를 불러오지 못했습니다.')
      return
    }
    setAwards((await response.json()) as AttendanceChampionAward[])
  }, [awardMonth])

  useEffect(() => {
    if (isAwardIssueOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronous request updates server-backed state after this effect returns.
      void loadAwards()
    }
  }, [isAwardIssueOpen, loadAwards])

  async function issueCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!memberId) {
      setMessage('쿠폰을 발급할 회원을 선택해 주세요.')
      return
    }
    const payload = {
      memberId,
      validFrom,
      validUntil: isUnlimited ? '9999-12-31' : validUntil,
      totalUses,
      name: couponName,
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
    setMemberId('')
    setCouponName('')
    setIssuedReason('')
    setIsCouponIssuePage(false)
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
    setSelectedCoupon((previous) =>
      previous?.id === changed.id ? changed : previous,
    )
    setMessage(
      action === 'suspend' ? '쿠폰을 정지했습니다.' : '쿠폰을 폐기했습니다.',
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
    setSelectedCoupon((previous) =>
      previous?.id === changed.id ? changed : previous,
    )
    setMessage('쿠폰 사용 기간을 연장했습니다.')
  }

  async function loadUsageHistory(coupon: Coupon) {
    setUsageHistoryCouponId(coupon.id)
    setSelectedCoupon(null)
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
    setSelectedCoupon(null)
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

  async function viewQrCode(coupon: Coupon) {
    const response = await fetch(`/api/v1/coupons/${coupon.id}/qr-token/view`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      await showFeedbackDialog({
        title: 'QR 코드를 불러오지 못했습니다',
        message: 'QR 코드를 다시 발급한 뒤 확인해 주세요.',
      })
      return
    }
    const result = (await response.json()) as { token: string }
    setQrCodeCoupon(coupon)
    setQrCodeToken(result.token)
  }

  async function issueQrCode(coupon: Coupon) {
    const hasQrCode = coupon.hasQrCode
    const confirmed = await confirm({
      title: hasQrCode ? 'QR 코드 재발급' : 'QR 코드 발급',
      message: hasQrCode
        ? 'QR 코드를 재발급하면 기존 QR 코드는 즉시 사용할 수 없게 됩니다.'
        : '회원에게 보여 줄 쿠폰 QR 코드를 발급합니다.',
      confirmLabel: hasQrCode ? 'QR 코드 재발급' : 'QR 코드 발급',
      isDestructive: hasQrCode,
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
        title: hasQrCode ? 'QR 코드 재발급 실패' : 'QR 코드 발급 실패',
        message: '쿠폰 상태를 확인한 뒤 다시 시도해 주세요.',
      })
      return
    }
    const result = (await response.json()) as { token: string }
    const couponWithQrCode = { ...coupon, hasQrCode: true }
    setCoupons((currentCoupons) =>
      currentCoupons.map((currentCoupon) =>
        currentCoupon.id === coupon.id ? couponWithQrCode : currentCoupon,
      ),
    )
    setSelectedCoupon((previous) =>
      previous?.id === coupon.id ? couponWithQrCode : previous,
    )
    setQrCodeCoupon(couponWithQrCode)
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

  async function voidCoupon(coupon: Coupon) {
    const confirmed = await confirm({
      title: '쿠폰을 폐기할까요?',
      message:
        '폐기하면 목록에서 사용할 수 없게 됩니다. 필요하면 나중에 폐기를 취소할 수 있습니다.',
      confirmLabel: '쿠폰 폐기',
      isDestructive: true,
    })
    if (confirmed) {
      await changeCoupon(coupon, 'void')
      setSelectedCoupon(null)
    }
  }

  async function restoreVoidedCoupon(coupon: Coupon) {
    const confirmed = await confirm({
      title: '쿠폰 폐기를 취소할까요?',
      message: '미사용 쿠폰을 다시 사용 가능 상태로 되돌립니다.',
      confirmLabel: '폐기 취소',
    })
    if (!confirmed) return

    const response = await fetch(`/api/v1/coupons/${coupon.id}/restore`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('쿠폰 폐기를 취소하지 못했습니다.')
      return
    }
    const changed = (await response.json()) as Coupon
    setCoupons((previous) =>
      previous.map((item) => (item.id === changed.id ? changed : item)),
    )
    setSelectedCoupon(null)
    setMessage('쿠폰 폐기를 취소했습니다.')
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

  async function cancelAward(awardId: string) {
    const confirmed = await confirm({
      title: '출석왕 수상을 취소할까요?',
      message: '연결된 미사용 출석왕 쿠폰도 함께 폐기됩니다.',
      confirmLabel: '수상 취소',
      isDestructive: true,
    })
    if (!confirmed) return

    const response = await fetch(
      `/api/v1/attendance-champion-awards/${awardId}/cancel`,
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
    setSelectedCoupon(null)
    setMessage('출석왕 수상과 미사용 쿠폰을 취소했습니다.')
    await loadCoupons()
  }

  async function restoreAward(awardId: string) {
    const confirmed = await confirm({
      title: '출석왕 수상 취소를 되돌릴까요?',
      message: '연결된 미사용 출석왕 쿠폰을 다시 사용 가능 상태로 복원합니다.',
      confirmLabel: '수상 복원',
    })
    if (!confirmed) return

    const response = await fetch(
      `/api/v1/attendance-champion-awards/${awardId}/restore`,
      {
        method: 'POST',
        credentials: 'include',
      },
    )
    if (!response.ok) {
      setMessage('출석왕 수상 취소를 되돌리지 못했습니다.')
      return
    }
    const changed = (await response.json()) as AttendanceChampionAward
    setAwards((previous) =>
      previous.map((item) => (item.id === changed.id ? changed : item)),
    )
    setSelectedCoupon(null)
    setMessage('출석왕 수상과 쿠폰을 복원했습니다.')
    await loadCoupons()
  }

  useEscapeKey(closeQrUse, isQrUseOpen)
  useEscapeKey(() => setSelectedCoupon(null), selectedCoupon !== null)
  useEscapeKey(
    () => {
      setQrCodeCoupon(null)
      setQrCodeToken('')
    },
    qrCodeCoupon !== null && qrCodeToken !== '',
  )

  return (
    <section className="coupon-page">
      <div className="attendance-page-heading">
        <div>
          <p className="eyebrow">COUPONS</p>
          <h2>{isCouponIssuePage ? '쿠폰 발급' : '쿠폰 관리'}</h2>
          <p>
            {isCouponIssuePage
              ? '회원과 사용 조건을 입력해 새 쿠폰을 발급합니다.'
              : '발급과 상태 변경은 이력으로 보존됩니다.'}
          </p>
        </div>
        <div className="header-actions">
          {isCouponIssuePage ? (
            <button
              className="secondary-button"
              onClick={() => setIsCouponIssuePage(false)}
              type="button"
            >
              {'목록으로'}
            </button>
          ) : (
            <>
              {!readOnly && (
                <button
                  className="secondary-button"
                  onClick={() => setIsAwardIssueOpen(true)}
                  type="button"
                >
                  {'출석왕 자동 발급'}
                </button>
              )}
              {!readOnly && (
                <button
                  onClick={() => setIsCouponIssuePage(true)}
                  type="button"
                >
                  {'쿠폰 발급'}
                </button>
              )}
              {!readOnly && (
                <button
                  className="secondary-button"
                  onClick={() => void openQrUse()}
                  type="button"
                >
                  {'QR 토큰 사용'}
                </button>
              )}
              <button
                aria-label="목록 새로고침"
                className="secondary-button icon-button"
                onClick={() => void loadCoupons()}
                type="button"
              >
                <RefreshIcon />
              </button>
            </>
          )}
        </div>
      </div>
      {isCouponIssuePage && !readOnly && (
        <section
          aria-labelledby="coupon-issue-heading"
          className="panel coupon-issue-page"
        >
          <h2 id="coupon-issue-heading">{'새 쿠폰 발급'}</h2>
          <p className="description">
            {'발급된 쿠폰은 목록에서 QR과 사용 이력을 관리할 수 있습니다.'}
          </p>
          <form className="form" onSubmit={issueCoupon}>
            <label>
              {'쿠폰 이름'}
              <input
                maxLength={100}
                onChange={(event) => setCouponName(event.target.value)}
                required
                value={couponName}
              />
            </label>
            <SearchableMemberSelect
              label="회원"
              members={members}
              onChange={setMemberId}
              required
              value={memberId}
            />
            <fieldset className="coupon-validity-fieldset">
              <legend>{'쿠폰 기한'}</legend>
              <div className="coupon-validity-inputs">
                <KoreanDateInput
                  onChange={setValidFrom}
                  required
                  value={validFrom}
                />
                <span aria-hidden="true">~</span>
                <KoreanDateInput
                  disabled={isUnlimited}
                  onChange={setValidUntil}
                  required={!isUnlimited}
                  value={validUntil}
                />
              </div>
              <label className="coupon-unlimited-toggle">
                <input
                  checked={isUnlimited}
                  onChange={(event) => setIsUnlimited(event.target.checked)}
                  type="checkbox"
                />
                {'무기한'}
              </label>
            </fieldset>
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
              {'쿠폰 설명 '}
              <span className="optional">{'(선택)'}</span>
              <textarea
                onChange={(event) => setIssuedReason(event.target.value)}
                value={issuedReason}
              />
            </label>
            <button type="submit">{'쿠폰 발급'}</button>
          </form>
        </section>
      )}
      {!isCouponIssuePage && !readOnly && isAwardIssueOpen && (
        <Modal
          ariaLabelledBy="coupon-award-heading"
          footer={
            <button form="coupon-award-form" type="submit">
              {'출석왕 확정 및 쿠폰 발급'}
            </button>
          }
          onClose={() => setIsAwardIssueOpen(false)}
        >
          <div className="modal-heading">
            <div>
              <h2 id="coupon-award-heading">{'출석왕 자동 발급'}</h2>
              <p>{'최다 출석자를 확정해 다음 달 쿠폰을 발급합니다.'}</p>
              <p>{'※쿠폰 사용은 제외됩니다.'}</p>
            </div>
          </div>
          <form
            className="coupon-award-form"
            id="coupon-award-form"
            onSubmit={grantAwards}
          >
            <SelectField
              label="대상 연도"
              onChange={(year) =>
                setAwardMonth(`${year}-${awardMonth.slice(5)}`)
              }
              options={Array.from({ length: 5 }, (_, index) => {
                const year = new Date().getFullYear() - 3 + index
                return { value: String(year), label: `${year}년` }
              })}
              value={awardMonth.slice(0, 4)}
            />
            <SelectField
              label="대상 월"
              onChange={(month) =>
                setAwardMonth(`${awardMonth.slice(0, 4)}-${month}`)
              }
              options={Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, '0')
                return { value: month, label: `${index + 1}월` }
              })}
              value={awardMonth.slice(5)}
            />
          </form>
          {awards.length > 0 && (
            <ul className="coupon-list coupon-award-list">
              {awards.map((award) => (
                <li key={award.id}>
                  <div>
                    <strong>{memberName(award.memberId)}</strong>
                    <span>
                      {`${award.qualifyingAttendanceCount}회 출석 · ${award.rewardUses}회 쿠폰`}
                    </span>
                  </div>
                  <div>
                    {award.awardStatus === 'GRANTED' && (
                      <button
                        className="danger-button"
                        onClick={() => void cancelAward(award.id)}
                        type="button"
                      >
                        {'수상 취소'}
                      </button>
                    )}
                    {award.awardStatus === 'CANCELLED' && (
                      <button
                        className="secondary-button"
                        onClick={() => void restoreAward(award.id)}
                        type="button"
                      >
                        {'수상 복원'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {!isCouponIssuePage && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{'쿠폰 목록'}</h2>
              <p>{'출석왕 쿠폰은 수상 취소로만 폐기할 수 있습니다.'}</p>
            </div>
          </div>
          <div className="list-filter-buttons" aria-label="쿠폰 상태 필터">
            {(
              [
                ['ALL', '전체'],
                ['ISSUED', '사용 가능'],
                ['SUSPENDED', '정지'],
                ['FULLY_USED', '사용 완료'],
                ['EXPIRED', '만료'],
                ['VOIDED', '폐기'],
              ] as const
            ).map(([value, label]) => (
              <button
                className={
                  couponFilter === value ? 'is-active' : 'secondary-button'
                }
                key={value}
                onClick={() => setCouponFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {coupons.filter(
            (coupon) =>
              couponFilter === 'ALL' || coupon.couponStatus === couponFilter,
          ).length === 0 ? (
            <EmptyState
              description="선택한 상태의 쿠폰이 없습니다."
              icon="◇"
              title={
                coupons.length === 0
                  ? '표시할 쿠폰이 없습니다'
                  : '조건에 맞는 쿠폰이 없습니다'
              }
            />
          ) : (
            <ul className="coupon-list">
              {coupons
                .filter(
                  (coupon) =>
                    couponFilter === 'ALL' ||
                    coupon.couponStatus === couponFilter,
                )
                .map((coupon) => (
                  <li key={coupon.id}>
                    <div>
                      <strong>
                        {coupon.name ?? couponTypeLabels[coupon.couponType]}
                      </strong>
                      <span>{`${memberName(coupon.memberId)} · 잔여 ${coupon.remainingUses}회`}</span>
                      <span>{couponValidityLabel(coupon)}</span>
                    </div>
                    <div className="coupon-actions">
                      <span
                        className={`status status-coupon status-coupon-${coupon.couponStatus.toLowerCase()}`}
                      >
                        {couponStatusLabels[coupon.couponStatus]}
                      </span>
                      {coupon.couponStatus === 'ISSUED' && !readOnly && (
                        <>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              void (coupon.hasQrCode
                                ? viewQrCode(coupon)
                                : issueQrCode(coupon))
                            }
                            type="button"
                          >
                            {coupon.hasQrCode ? 'QR 보기' : 'QR 발급'}
                          </button>
                          <button
                            onClick={() => void openCouponUse(coupon)}
                            type="button"
                          >
                            {'쿠폰 사용'}
                          </button>
                        </>
                      )}
                      {coupon.couponStatus === 'FULLY_USED' && (
                        <button
                          className="secondary-button"
                          onClick={() => void loadUsageHistory(coupon)}
                          type="button"
                        >
                          {'사용 이력'}
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          aria-label={`${coupon.name ?? '쿠폰'} 관리`}
                          className="secondary-button coupon-more-button"
                          onClick={() => setSelectedCoupon(coupon)}
                          type="button"
                        >
                          ⋮
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
      {selectedCoupon !== null && (
        <div
          className="bottom-sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCoupon(null)
          }}
        >
          <section
            aria-modal="true"
            className="bottom-sheet coupon-action-sheet"
            role="dialog"
          >
            <div className="bottom-sheet-handle" />
            <div className="panel-heading">
              <div>
                <h3>
                  {selectedCoupon.name ??
                    couponTypeLabels[selectedCoupon.couponType]}
                </h3>
                <p>{`${couponStatusLabels[selectedCoupon.couponStatus]} · ${couponValidityLabel(selectedCoupon)}`}</p>
                {selectedCoupon.issuedReason && (
                  <p>{selectedCoupon.issuedReason}</p>
                )}
              </div>
              <button
                className="modal-close-button"
                onClick={() => setSelectedCoupon(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="coupon-sheet-actions">
              {message && (
                <p className="message coupon-sheet-message" role="status">
                  {message}
                </p>
              )}
              <button
                onClick={() => void loadUsageHistory(selectedCoupon)}
                type="button"
              >
                사용 이력
              </button>
              {selectedCoupon.couponStatus === 'ISSUED' && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => void issueQrCode(selectedCoupon)}
                    type="button"
                  >
                    {selectedCoupon.hasQrCode ? 'QR 재발급' : 'QR 발급'}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void changeCoupon(selectedCoupon, 'suspend')}
                    type="button"
                  >
                    정지
                  </button>
                </>
              )}
              {selectedCoupon.couponStatus !== 'VOIDED' &&
                selectedCoupon.couponStatus !== 'FULLY_USED' &&
                selectedCoupon.validUntil !== '9999-12-31' && (
                  <label className="coupon-extension-field">
                    기간 연장 종료일
                    <KoreanDateInput
                      onChange={setExtensionDate}
                      value={extensionDate}
                    />
                    <button
                      className="secondary-button"
                      onClick={() => void extendCoupon(selectedCoupon)}
                      type="button"
                    >
                      기간 연장
                    </button>
                  </label>
                )}
              {selectedCoupon.couponStatus === 'ISSUED' &&
                selectedCoupon.couponType === 'MANUAL_FREE_PASS' && (
                  <button
                    className="danger-button"
                    onClick={() => void voidCoupon(selectedCoupon)}
                    type="button"
                  >
                    쿠폰 폐기
                  </button>
                )}
              {selectedCoupon.couponStatus === 'ISSUED' &&
                selectedCoupon.couponType === 'ATTENDANCE_CHAMPION' &&
                selectedCoupon.championAwardId && (
                  <button
                    className="danger-button"
                    onClick={() =>
                      void cancelAward(selectedCoupon.championAwardId!)
                    }
                    type="button"
                  >
                    {'수상 취소'}
                  </button>
                )}
              {selectedCoupon.couponStatus === 'VOIDED' &&
                selectedCoupon.couponType === 'MANUAL_FREE_PASS' && (
                  <button
                    className="secondary-button"
                    onClick={() => void restoreVoidedCoupon(selectedCoupon)}
                    type="button"
                  >
                    폐기 취소
                  </button>
                )}
              {selectedCoupon.couponStatus === 'VOIDED' &&
                selectedCoupon.couponType === 'ATTENDANCE_CHAMPION' &&
                selectedCoupon.championAwardId && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void restoreAward(selectedCoupon.championAwardId!)
                    }
                    type="button"
                  >
                    {'수상 복원'}
                  </button>
                )}
            </div>
          </section>
        </div>
      )}
      {usageHistoryCouponId !== null && (
        <Modal onClose={() => setUsageHistoryCouponId(null)}>
          <div className="modal-heading">
            <h2>쿠폰 사용 이력</h2>
          </div>
          {usageHistory.length === 0 ? (
            <EmptyState
              description="쿠폰을 사용하면 처리 이력이 여기에 표시됩니다."
              icon="◇"
              title="사용 이력이 없습니다"
            />
          ) : (
            <ul className="coupon-list">
              {usageHistory.map((usage) => (
                <li key={usage.id}>
                  <span>
                    {usage.usageStatus === 'USED' ? '사용됨' : '사용 취소됨'}
                  </span>
                  {!readOnly && usage.usageStatus === 'USED' && (
                    <button
                      className="danger-button"
                      onClick={() => void reverseUsage(usage)}
                      type="button"
                    >
                      사용 취소
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!readOnly && (
            <label>
              <input
                onChange={(event) => setReversalReason(event.target.value)}
                placeholder="사용 취소 사유"
                value={reversalReason}
              />
            </label>
          )}
        </Modal>
      )}
      {!readOnly && couponToUse !== null && (
        <Modal
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setCouponToUse(null)}
                type="button"
              >
                {'취소'}
              </button>
              <button form="coupon-use-form" type="submit">
                {'쿠폰 사용 및 출석 기록'}
              </button>
            </>
          }
          onClose={() => setCouponToUse(null)}
        >
          <div className="modal-heading">
            <h2>{'쿠폰 사용 처리'}</h2>
          </div>
          <form className="form" id="coupon-use-form" onSubmit={useCoupon}>
            <SelectField
              label="열린 모임"
              onChange={setGatheringId}
              options={gatherings.map((gathering) => ({
                value: gathering.id,
                label: `${gathering.heldOn} · ${gathering.title ?? '제목 없는 모임'}`,
              }))}
              placeholder="선택"
              value={gatheringId}
            />
          </form>
        </Modal>
      )}
      {!readOnly && isQrUseOpen && (
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
                <span>{`잔여 ${qrValidatedCoupon.remainingUses}회 · ${couponValidityLabel(qrValidatedCoupon)}`}</span>
              </div>
            )}
            <SelectField
              label="열린 모임"
              onChange={setGatheringId}
              options={gatherings.map((gathering) => ({
                value: gathering.id,
                label: `${gathering.heldOn} · ${gathering.title ?? '제목 없는 모임'}`,
              }))}
              placeholder="선택"
              value={gatheringId}
            />
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
    </section>
  )
}
