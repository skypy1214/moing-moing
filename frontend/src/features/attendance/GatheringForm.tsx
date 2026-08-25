import type { FormEvent } from 'react'

import type { Member } from '../../App'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'
import { KoreanDateInput } from '../../shared/ui/KoreanDateInput'

export type GatheringType = 'CLASS' | 'EVENT'

type GatheringFormProps = {
  endsOn: string
  error?: string
  gatheringType: GatheringType
  heldOn: string
  hostMemberId?: string
  hostMembers?: Member[]
  isSubmitting?: boolean
  location: string
  onCancel: () => void
  onEndsOnChange: (value: string) => void
  onGatheringTypeChange: (value: GatheringType) => void
  onHostMemberIdChange?: (value: string) => void
  onHeldOnChange: (value: string) => void
  onLocationChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTitleChange: (value: string) => void
  submitLabel: string
  submittingLabel?: string
  showHostSelection?: boolean
  title: string
}

export function GatheringForm({
  endsOn,
  error,
  gatheringType,
  heldOn,
  hostMemberId = '',
  hostMembers = [],
  isSubmitting = false,
  location,
  onCancel,
  onEndsOnChange,
  onGatheringTypeChange,
  onHostMemberIdChange,
  onHeldOnChange,
  onLocationChange,
  onSubmit,
  onTitleChange,
  submitLabel,
  submittingLabel,
  showHostSelection = false,
  title,
}: GatheringFormProps) {
  return (
    <form className="form" onSubmit={onSubmit}>
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
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button disabled={isSubmitting} type="submit">
          {isSubmitting && submittingLabel ? submittingLabel : submitLabel}
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">
          취소
        </button>
      </div>
    </form>
  )
}
