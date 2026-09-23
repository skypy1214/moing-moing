import type { FormEvent } from 'react'

import type { Member } from '../../App'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'
import { KoreanDateInput } from '../../shared/ui/KoreanDateInput'

export type GatheringType = 'CLASS' | 'EVENT'

type GatheringFormProps = {
  endsOn: string
  error?: string
  formId?: string
  defaultParticipationFee: string
  gatheringType: GatheringType
  heldOn: string
  hostMemberId?: string
  hostMembers?: Member[]
  isSubmitting?: boolean
  location: string
  onCancel: () => void
  onEndsOnChange: (value: string) => void
  onDefaultParticipationFeeChange: (value: string) => void
  onGatheringTypeChange: (value: GatheringType) => void
  onHostMemberIdChange?: (value: string) => void
  onHeldOnChange: (value: string) => void
  onLocationChange: (value: string) => void
  isRecurringClass?: boolean
  onRecurringClassChange?: (value: boolean) => void
  recurringWeeks?: string
  onRecurringWeeksChange?: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTitleChange: (value: string) => void
  submitLabel: string
  submittingLabel?: string
  showHostSelection?: boolean
  showActions?: boolean
  title: string
}

export function GatheringForm({
  endsOn,
  defaultParticipationFee,
  error,
  formId,
  gatheringType,
  heldOn,
  hostMemberId = '',
  hostMembers = [],
  isSubmitting = false,
  location,
  onCancel,
  onEndsOnChange,
  onDefaultParticipationFeeChange,
  onGatheringTypeChange,
  onHostMemberIdChange,
  onHeldOnChange,
  onLocationChange,
  isRecurringClass = false,
  onRecurringClassChange,
  recurringWeeks = '3',
  onRecurringWeeksChange,
  onSubmit,
  onTitleChange,
  submitLabel,
  submittingLabel,
  showHostSelection = false,
  showActions = true,
  title,
}: GatheringFormProps) {
  return (
    <form className="form" id={formId} onSubmit={onSubmit}>
      <fieldset className="gathering-type-field">
        <legend>정모 구분</legend>
        <div className="gathering-type-options">
          <label className={gatheringType === 'CLASS' ? 'is-selected' : ''}>
            <input
              checked={gatheringType === 'CLASS'}
              name="gathering-type"
              onChange={() => onGatheringTypeChange('CLASS')}
              type="radio"
            />
            <span>수업</span>
          </label>
          <label className={gatheringType === 'EVENT' ? 'is-selected' : ''}>
            <input
              checked={gatheringType === 'EVENT'}
              name="gathering-type"
              onChange={() => onGatheringTypeChange('EVENT')}
              type="radio"
            />
            <span>행사</span>
          </label>
        </div>
      </fieldset>
      <label>
        {gatheringType === 'EVENT' ? '행사 시작일' : '수업 날짜'}
        <KoreanDateInput onChange={onHeldOnChange} required value={heldOn} />
      </label>
      {gatheringType === 'EVENT' && (
        <label>
          행사 종료일
          <KoreanDateInput onChange={onEndsOnChange} required value={endsOn} />
        </label>
      )}
      {gatheringType === 'CLASS' && onRecurringClassChange && (
        <div className="recurring-class-field">
          <label className="checkbox-label">
            <input
              checked={isRecurringClass}
              onChange={(event) => onRecurringClassChange(event.target.checked)}
              type="checkbox"
            />
            <span>연속 수업으로 개설</span>
          </label>
          {isRecurringClass && (
            <div className="recurring-class-options">
              <label>
                수업 횟수
                <input
                  max="24"
                  min="2"
                  onChange={(event) => onRecurringWeeksChange?.(event.target.value)}
                  required
                  type="number"
                  value={recurringWeeks}
                />
              </label>
              <p className="field-hint">
                {heldOn}부터 매주 같은 요일에 {recurringWeeks || 0}회 수업이 생성됩니다. 선납 회원은 각 수업 출석 시 자동으로 선납 처리됩니다.
              </p>
            </div>
          )}
        </div>
      )}
      {showHostSelection &&
        gatheringType === 'CLASS' &&
        onHostMemberIdChange && (
          <SearchableMemberSelect
            label="진행자"
            members={hostMembers}
            onChange={onHostMemberIdChange}
            value={hostMemberId}
          />
        )}
      <label>
        정모 제목 <span className="optional">(선택)</span>
        <input
          onChange={(event) => onTitleChange(event.target.value)}
          value={title}
        />
      </label>
      <label>
        장소 <span className="optional">(선택)</span>
        <input
          onChange={(event) => onLocationChange(event.target.value)}
          value={location}
        />
      </label>
      <label>
        기본 참가비
        <input
          min="0"
          onChange={(event) =>
            onDefaultParticipationFeeChange(event.target.value)
          }
          step="1000"
          type="number"
          value={defaultParticipationFee}
        />
        <span className="field-hint">
          참석자별로 무료·할인 금액과 입금 상태를 따로 조정할 수 있습니다.
        </span>
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {showActions && (
        <div className="form-actions">
          <button disabled={isSubmitting} type="submit">
            {isSubmitting && submittingLabel ? submittingLabel : submitLabel}
          </button>
          <button className="secondary-button" onClick={onCancel} type="button">
            취소
          </button>
        </div>
      )}
    </form>
  )
}
