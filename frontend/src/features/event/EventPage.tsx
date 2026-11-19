import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import { apiFetch } from '../../shared/api/apiFetch'
import { FeedbackMessageDialog } from '../../shared/feedback-dialog/FeedbackMessageDialog'
import { EmptyState } from '../../shared/ui/EmptyState'
import { Modal } from '../../shared/ui/Modal'
import { SelectField } from '../../shared/ui/SelectField'

type EventStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
type View = 'LIST' | 'EDITOR' | 'DETAIL'

type PartyEvent = { id: string; name: string; eventStatus: EventStatus }
type Seat = {
  id: string
  section: number
  row: number
  column: number
  name: string
  description: string
  mission: string | null
  taken: boolean
}
type MyRole = { id: string; name: string; description: string; mission: string }
type EventDetail = PartyEvent & { roles: Seat[]; myRole: MyRole | null }
type ManagedRole = {
  id: string
  displayOrder: number
  name: string
  description: string
  mission: string
  confirmed: boolean
}
type DraftRole = {
  id: string
  name: string
  description: string
  mission: string
}

type RolePreview = ManagedRole | DraftRole

const statusLabels: Record<EventStatus, string> = {
  DRAFT: '준비 중',
  OPEN: '선택 가능',
  CLOSED: '마감',
}

async function responseMessage(response: Response, fallback: string) {
  return response
    .json()
    .then((body: { message?: string }) => body.message ?? fallback)
    .catch(() => fallback)
}

export function EventPage({
  canViewMissions,
  isAdmin,
}: {
  canViewMissions: boolean
  isAdmin: boolean
}) {
  const [view, setView] = useState<View>('LIST')
  const [events, setEvents] = useState<PartyEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<PartyEvent | null>(null)
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [managedRoles, setManagedRoles] = useState<ManagedRole[]>([])
  const [eventName, setEventName] = useState('')
  const [eventStatus, setEventStatus] = useState<EventStatus>('DRAFT')
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [roleMission, setRoleMission] = useState('')
  const [draftRoles, setDraftRoles] = useState<DraftRole[]>([])
  const [editingRole, setEditingRole] = useState<ManagedRole | null>(null)
  const [editingDraftRoleId, setEditingDraftRoleId] = useState<string | null>(
    null,
  )
  const [previewRole, setPreviewRole] = useState<RolePreview | null>(null)
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false)
  const [claimTarget, setClaimTarget] = useState<Seat | null>(null)
  const [isClaimMissionVisible, setIsClaimMissionVisible] = useState(false)
  const [confirmedRole, setConfirmedRole] = useState<MyRole | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [roleToUnassign, setRoleToUnassign] = useState<ManagedRole | null>(null)
  const [message, setMessage] = useState('')

  async function loadEvents() {
    const response = await apiFetch(
      isAdmin ? '/api/v1/admin/events' : '/api/v1/events',
      { credentials: 'include' },
    )
    if (!response.ok) {
      setMessage('이벤트 목록을 불러오지 못했습니다.')
      return
    }
    setEvents((await response.json()) as PartyEvent[])
  }

  async function loadDetail(event: PartyEvent) {
    const response = await apiFetch(`/api/v1/events/${event.id}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage(
        await responseMessage(response, '이벤트를 불러오지 못했습니다.'),
      )
      return false
    }
    setDetail((await response.json()) as EventDetail)
    return true
  }

  async function loadManagedRoles(eventId: string) {
    const response = await apiFetch(`/api/v1/admin/events/${eventId}/roles`, {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('등록된 역할을 불러오지 못했습니다.')
      return
    }
    setManagedRoles((await response.json()) as ManagedRole[])
  }

  useEffect(() => {
    void Promise.resolve().then(loadEvents)
    // Initial server state synchronization is intentionally performed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  function resetRoleForm() {
    setRoleName('')
    setRoleDescription('')
    setRoleMission('')
    setEditingRole(null)
    setEditingDraftRoleId(null)
    setIsRoleEditorOpen(false)
  }

  function returnToList() {
    setView('LIST')
    setSelectedEvent(null)
    setDetail(null)
    setManagedRoles([])
    setDraftRoles([])
    setMessage('')
    void loadEvents()
  }

  function beginCreate() {
    setSelectedEvent(null)
    setEventName('')
    setEventStatus('DRAFT')
    resetRoleForm()
    setDraftRoles([])
    setManagedRoles([])
    setView('EDITOR')
  }

  async function beginEdit(event: PartyEvent) {
    setSelectedEvent(event)
    setEventName(event.name)
    setEventStatus(event.eventStatus)
    resetRoleForm()
    setDraftRoles([])
    await loadManagedRoles(event.id)
    setView('EDITOR')
  }

  async function beginDetail(event: PartyEvent) {
    setSelectedEvent(event)
    setMessage('')
    if (await loadDetail(event)) setView('DETAIL')
  }

  function roleValues() {
    const name = roleName.trim()
    const description = roleDescription.trim()
    const mission = roleMission.trim()
    if (name === '' || description === '' || mission === '') {
      setMessage('역할명, 설명, 미션을 모두 입력해 주세요.')
      return null
    }
    return { name, description, mission }
  }

  function addDraftRole() {
    const values = roleValues()
    if (values === null) return
    setDraftRoles((current) =>
      editingDraftRoleId === null
        ? [...current, { id: crypto.randomUUID(), ...values }]
        : current.map((role) =>
            role.id === editingDraftRoleId ? { ...role, ...values } : role,
          ),
    )
    resetRoleForm()
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const isNew = selectedEvent === null
    const response = await apiFetch(
      isNew
        ? '/api/v1/admin/events'
        : `/api/v1/admin/events/${selectedEvent.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: eventName, eventStatus }),
      },
    )
    if (!response.ok) {
      setMessage(
        await responseMessage(response, '이벤트를 저장하지 못했습니다.'),
      )
      return
    }
    const saved = (await response.json()) as PartyEvent
    for (const role of isNew ? draftRoles : []) {
      const roleResponse = await apiFetch(
        `/api/v1/admin/events/${saved.id}/roles`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(role),
        },
      )
      if (!roleResponse.ok) {
        setMessage(
          '이벤트는 저장했지만 일부 역할을 추가하지 못했습니다. 수정 화면에서 다시 추가해 주세요.',
        )
        setSelectedEvent(saved)
        await loadManagedRoles(saved.id)
        setView('EDITOR')
        return
      }
    }
    await beginDetail(saved)
  }

  async function saveRole() {
    if (selectedEvent === null) {
      addDraftRole()
      return
    }
    const values = roleValues()
    if (values === null) return
    const endpoint =
      editingRole === null
        ? `/api/v1/admin/events/${selectedEvent.id}/roles`
        : `/api/v1/admin/events/${selectedEvent.id}/roles/${editingRole.id}`
    const response = await apiFetch(endpoint, {
      method: editingRole === null ? 'POST' : 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!response.ok) {
      setMessage(
        await responseMessage(
          response,
          editingRole === null
            ? '역할을 추가하지 못했습니다.'
            : '역할을 수정하지 못했습니다.',
        ),
      )
      return
    }
    resetRoleForm()
    await loadManagedRoles(selectedEvent.id)
  }

  function beginRoleEdit(role: ManagedRole) {
    setEditingRole(role)
    setEditingDraftRoleId(null)
    setRoleName(role.name)
    setRoleDescription(role.description)
    setRoleMission(role.mission)
    setIsRoleEditorOpen(true)
  }

  function beginDraftRoleEdit(role: DraftRole) {
    setEditingDraftRoleId(role.id)
    setEditingRole(null)
    setRoleName(role.name)
    setRoleDescription(role.description)
    setRoleMission(role.mission)
    setIsRoleEditorOpen(true)
  }

  function beginRoleCreate() {
    resetRoleForm()
    setIsRoleEditorOpen(true)
  }

  function roleIsConfirmed(role: RolePreview) {
    return 'confirmed' in role && role.confirmed
  }

  function deleteDraftRole(roleId: string) {
    setDraftRoles((current) => current.filter((role) => role.id !== roleId))
    if (editingDraftRoleId === roleId) resetRoleForm()
  }
  async function deleteRole(role: ManagedRole) {
    if (selectedEvent === null) return
    const response = await apiFetch(
      `/api/v1/admin/events/${selectedEvent.id}/roles/${role.id}`,
      { method: 'DELETE', credentials: 'include' },
    )
    if (!response.ok) {
      setMessage(await responseMessage(response, '역할을 삭제하지 못했습니다.'))
      return
    }
    if (editingRole?.id === role.id) resetRoleForm()
    await loadManagedRoles(selectedEvent.id)
  }

  async function unassignRole() {
    if (selectedEvent === null || roleToUnassign === null) return
    const response = await apiFetch(
      `/api/v1/admin/events/${selectedEvent.id}/roles/${roleToUnassign.id}/assignment`,
      { method: 'DELETE', credentials: 'include' },
    )
    if (!response.ok) {
      setMessage(
        await responseMessage(response, '역할 확정을 취소하지 못했습니다.'),
      )
      return
    }
    setRoleToUnassign(null)
    await loadManagedRoles(selectedEvent.id)
  }
  async function claimRole() {
    if (selectedEvent === null || claimTarget === null) return
    const response = await apiFetch(
      `/api/v1/events/${selectedEvent.id}/roles/${claimTarget.id}/claim`,
      { method: 'POST', credentials: 'include' },
    )
    setClaimTarget(null)
    if (!response.ok) {
      setMessage(
        await responseMessage(
          response,
          '역할을 확정하지 못했습니다. 좌석표를 다시 확인해 주세요.',
        ),
      )
      await loadDetail(selectedEvent)
      return
    }
    setConfirmedRole((await response.json()) as MyRole)
    await loadDetail(selectedEvent)
  }

  async function deleteEvent() {
    if (selectedEvent === null) return
    const response = await apiFetch(
      `/api/v1/admin/events/${selectedEvent.id}`,
      { method: 'DELETE', credentials: 'include' },
    )
    if (!response.ok) {
      setMessage(
        await responseMessage(response, '이벤트를 삭제하지 못했습니다.'),
      )
      return
    }
    setIsDeleteDialogOpen(false)
    returnToList()
  }

  if (view === 'EDITOR') {
    const listedRoles = selectedEvent === null ? draftRoles : managedRoles
    return (
      <section
        className="meeting-note-page event-page"
        aria-labelledby="event-editor-heading"
      >
        <div className="attendance-page-heading">
          <div>
            <p className="eyebrow">EVENT</p>
            <h2 id="event-editor-heading">
              {selectedEvent === null ? '이벤트 생성' : '이벤트 수정'}
            </h2>
            <p>이벤트 정보와 역할을 준비한 뒤 상태를 선택해 주세요.</p>
          </div>
          <button
            className="secondary-button"
            onClick={returnToList}
            type="button"
          >
            목록으로
          </button>
        </div>
        <form className="panel form event-editor-form" onSubmit={saveEvent}>
          <label>
            이벤트 이름
            <input
              maxLength={100}
              onChange={(event) => setEventName(event.target.value)}
              required
              value={eventName}
            />
          </label>
          <SelectField
            label="상태"
            onChange={(value) => setEventStatus(value as EventStatus)}
            options={Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            value={eventStatus}
          />
          <div className="event-role-editor">
            <div className="panel-heading">
              <div>
                <h3>역할</h3>
                <p>
                  역할명을 누르면 설명과 미션을 확인하거나 관리할 수 있습니다.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={beginRoleCreate}
                type="button"
              >
                역할 추가
              </button>
            </div>
            {listedRoles.length === 0 ? (
              <p className="description">아직 등록된 역할이 없습니다.</p>
            ) : (
              <ul className="event-role-management-list">
                {listedRoles.map((role) => (
                  <li key={role.id}>
                    <button
                      className="event-role-summary"
                      onClick={() => setPreviewRole(role)}
                      type="button"
                    >
                      <strong>{role.name}</strong>
                      {roleIsConfirmed(role) && (
                        <span className="event-role-confirmed">확정됨</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-actions">
            <button type="submit">이벤트 저장</button>
          </div>
        </form>
        {isRoleEditorOpen && (
          <Modal
            ariaLabelledBy="role-editor-heading"
            footer={
              <>
                <button
                  className="secondary-button"
                  onClick={resetRoleForm}
                  type="button"
                >
                  취소
                </button>
                <button form="event-role-form" type="submit">
                  {editingRole === null && editingDraftRoleId === null
                    ? '역할 추가'
                    : '역할 수정 저장'}
                </button>
              </>
            }
            onClose={resetRoleForm}
          >
            <div className="modal-heading">
              <h3 id="role-editor-heading">
                {editingRole === null && editingDraftRoleId === null
                  ? '역할 추가'
                  : '역할 수정'}
              </h3>
              <p>설명은 선택 전에, 미션은 확정한 본인에게만 표시됩니다.</p>
            </div>
            <form
              className="form"
              id="event-role-form"
              onSubmit={(event) => {
                event.preventDefault()
                void saveRole()
              }}
            >
              <label>
                역할명
                <input
                  maxLength={100}
                  onChange={(event) => setRoleName(event.target.value)}
                  required
                  value={roleName}
                />
              </label>
              <label>
                역할 설명
                <textarea
                  maxLength={3000}
                  onChange={(event) => setRoleDescription(event.target.value)}
                  required
                  value={roleDescription}
                />
              </label>
              <label>
                확정 후 미션
                <textarea
                  maxLength={3000}
                  onChange={(event) => setRoleMission(event.target.value)}
                  required
                  value={roleMission}
                />
              </label>
            </form>
          </Modal>
        )}{' '}
        {previewRole && (
          <Modal
            ariaLabelledBy="role-preview-heading"
            footer={
              <>
                {!roleIsConfirmed(previewRole) && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (selectedEvent === null) {
                        beginDraftRoleEdit(previewRole as DraftRole)
                      } else {
                        beginRoleEdit(previewRole as ManagedRole)
                      }
                      setPreviewRole(null)
                    }}
                    type="button"
                  >
                    수정
                  </button>
                )}
                {selectedEvent !== null && roleIsConfirmed(previewRole) && (
                  <button
                    className="danger-button"
                    onClick={() => {
                      setRoleToUnassign(previewRole as ManagedRole)
                      setPreviewRole(null)
                    }}
                    type="button"
                  >
                    확정 취소
                  </button>
                )}{' '}
                {!roleIsConfirmed(previewRole) && (
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (selectedEvent === null) {
                        deleteDraftRole(previewRole.id)
                      } else {
                        void deleteRole(previewRole as ManagedRole)
                      }
                      setPreviewRole(null)
                    }}
                    type="button"
                  >
                    삭제
                  </button>
                )}
                <button onClick={() => setPreviewRole(null)} type="button">
                  닫기
                </button>
              </>
            }
            onClose={() => setPreviewRole(null)}
          >
            <div className="modal-heading">
              <h3 id="role-preview-heading">{previewRole.name}</h3>
              {roleIsConfirmed(previewRole) && (
                <p>이미 확정된 역할이라 수정할 수 없습니다.</p>
              )}
            </div>
            <dl className="event-role-preview-details">
              <div>
                <dt>역할 설명</dt>
                <dd className="markdown-preview">
                  <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                    {previewRole.description}
                  </Markdown>
                </dd>
              </div>
              <div>
                <dt>확정 후 미션</dt>
                <dd>
                  <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                    {previewRole.mission}
                  </Markdown>
                </dd>
              </div>
            </dl>
          </Modal>
        )}{' '}
        {roleToUnassign && (
          <Modal
            ariaLabelledBy="role-unassign-heading"
            footer={
              <>
                <button
                  className="secondary-button"
                  onClick={() => setRoleToUnassign(null)}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="danger-button"
                  onClick={() => void unassignRole()}
                  type="button"
                >
                  확정 취소
                </button>
              </>
            }
            onClose={() => setRoleToUnassign(null)}
            role="alertdialog"
          >
            <div className="modal-heading">
              <h3 id="role-unassign-heading">
                {roleToUnassign.name} 역할 확정을 취소할까요?
              </h3>
              <p>
                선택한 회원의 역할이 해제되어 다른 사람이 다시 선택할 수
                있습니다.
              </p>
            </div>
          </Modal>
        )}{' '}
        {message && (
          <FeedbackMessageDialog
            message={message}
            onClose={() => setMessage('')}
          />
        )}
      </section>
    )
  }

  if (view === 'DETAIL' && selectedEvent !== null) {
    const eventDetail = detail
    const groupedSeats =
      eventDetail?.roles.reduce<Record<number, Seat[]>>(
        (groups, seat) => ({
          ...groups,
          [seat.section]: [...(groups[seat.section] ?? []), seat],
        }),
        {},
      ) ?? {}
    return (
      <section
        className="meeting-note-page event-page"
        aria-labelledby="event-detail-heading"
      >
        <div className="attendance-page-heading">
          <div>
            <p className="eyebrow">
              EVENT · {statusLabels[selectedEvent.eventStatus]}
            </p>
            <h2 id="event-detail-heading">{selectedEvent.name}</h2>
            <p>역할을 누르면 설명을 확인한 뒤 확정할 수 있습니다.</p>
          </div>
          <div className="header-actions">
            {isAdmin && (
              <button
                onClick={() => void beginEdit(selectedEvent)}
                type="button"
              >
                수정
              </button>
            )}
            {isAdmin && (
              <button
                className="danger-button"
                onClick={() => setIsDeleteDialogOpen(true)}
                type="button"
              >
                이벤트 삭제
              </button>
            )}
            <button
              className="secondary-button"
              onClick={returnToList}
              type="button"
            >
              목록으로
            </button>
          </div>
        </div>
        {eventDetail?.myRole && (
          <section className="panel event-my-role">
            <p className="eyebrow">MY ROLE</p>
            <h3>{eventDetail.myRole.name}</h3>
            <div className="event-role-copy markdown-preview">
              <b>역할 설명</b>
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                {eventDetail.myRole.description}
              </Markdown>
            </div>
            <div className="event-role-copy event-role-mission markdown-preview">
              <b>나의 미션</b>
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                {eventDetail.myRole.mission}
              </Markdown>
            </div>
          </section>
        )}
        <section className="panel event-seat-panel">
          <div className="panel-heading">
            <div>
              <h3>역할 좌석표</h3>
              <p>미션은 확정한 본인에게만 공개됩니다.</p>
            </div>
          </div>
          {eventDetail === null ? (
            <p>좌석표를 불러오는 중입니다.</p>
          ) : eventDetail.roles.length === 0 ? (
            <EmptyState
              description="관리자가 역할을 등록하면 이곳에 좌석표가 표시됩니다."
              icon="▦"
              title="아직 등록된 역할이 없습니다"
            />
          ) : (
            <div className="event-seat-sections">
              {Object.entries(groupedSeats).map(([section, seats]) => (
                <div className="event-seat-section" key={section}>
                  <span className="event-section-label">{section}분단</span>
                  <div className="event-seat-grid">
                    {seats.map((seat) => (
                      <button
                        className={`event-seat ${seat.taken ? 'is-taken' : ''}`}
                        disabled={
                          !canViewMissions &&
                          (seat.taken || eventDetail.myRole !== null)
                        }
                        key={seat.id}
                        onClick={() => {
                          setClaimTarget(seat)
                          setIsClaimMissionVisible(false)
                        }}
                        type="button"
                      >
                        <span>{seat.name}</span>
                        <small>
                          {seat.taken
                            ? canViewMissions
                              ? '설명·미션 보기'
                              : '선택 완료'
                            : '설명 보기'}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {claimTarget && (
          <Modal
            ariaLabelledBy="role-confirm-heading"
            footer={
              <>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setClaimTarget(null)
                    setIsClaimMissionVisible(false)
                  }}
                  type="button"
                >
                  취소
                </button>
                {canViewMissions && claimTarget.mission !== null && (
                  <button
                    className="secondary-button"
                    onClick={() => setIsClaimMissionVisible(true)}
                    type="button"
                  >
                    미션 확인
                  </button>
                )}
                {!claimTarget.taken &&
                  eventDetail !== null &&
                  eventDetail.myRole === null &&
                  eventDetail.eventStatus === 'OPEN' &&
                  selectedEvent?.eventStatus === 'OPEN' && (
                    <button onClick={() => void claimRole()} type="button">
                      이 역할로 확정
                    </button>
                  )}
              </>
            }
            onClose={() => {
              setClaimTarget(null)
              setIsClaimMissionVisible(false)
            }}
            role="alertdialog"
          >
            <div className="modal-heading">
              <h3 id="role-confirm-heading">{claimTarget.name}</h3>
              <p className="event-role-confirmation-warning">
                역할 설명을 확인하고 확정해 주세요. 확정 후에는 변경할 수
                없습니다.
              </p>
            </div>
            <div className="event-role-description event-role-markdown markdown-preview">
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                {claimTarget.description}
              </Markdown>
            </div>
            {isClaimMissionVisible && claimTarget.mission !== null && (
              <div className="event-confirmed-duty event-role-markdown markdown-preview">
                <b>미션</b>
                <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                  {claimTarget.mission}
                </Markdown>
              </div>
            )}
          </Modal>
        )}
        {confirmedRole && (
          <Modal
            ariaLabelledBy="role-confirmed-heading"
            footer={
              <button onClick={() => setConfirmedRole(null)} type="button">
                확인
              </button>
            }
            onClose={() => setConfirmedRole(null)}
          >
            <div className="modal-heading">
              <h3 id="role-confirmed-heading">
                {confirmedRole.name} 역할이 확정됐습니다
              </h3>
              <p>아래 미션을 확인해 주세요.</p>
            </div>
            <div className="event-confirmed-duty event-role-markdown markdown-preview">
              <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
                {confirmedRole.mission}
              </Markdown>
            </div>
          </Modal>
        )}
        {isDeleteDialogOpen && (
          <Modal
            ariaLabelledBy="event-delete-heading"
            footer={
              <>
                <button
                  className="secondary-button"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="danger-button"
                  onClick={() => void deleteEvent()}
                  type="button"
                >
                  이벤트 삭제
                </button>
              </>
            }
            onClose={() => setIsDeleteDialogOpen(false)}
            role="alertdialog"
          >
            <div className="modal-heading">
              <h3 id="event-delete-heading">이벤트를 삭제할까요?</h3>
              <p>목록에서만 숨겨집니다. 이미 선택된 역할 기록은 보존됩니다.</p>
            </div>
          </Modal>
        )}
        {message && (
          <FeedbackMessageDialog
            message={message}
            onClose={() => setMessage('')}
          />
        )}
      </section>
    )
  }

  return (
    <section
      className="meeting-note-page event-page"
      aria-labelledby="event-heading"
    >
      <div className="attendance-page-heading">
        <div>
          <p className="eyebrow">EVENT</p>
          <h2 id="event-heading">이벤트</h2>
          <p>모임 이벤트와 역할 선택을 확인합니다.</p>
        </div>
        {isAdmin && (
          <div className="header-actions">
            <button onClick={beginCreate} type="button">
              이벤트 생성
            </button>
          </div>
        )}
      </div>
      <section className="panel">
        {events.length === 0 ? (
          <EmptyState
            description={
              isAdmin
                ? '우측 상단의 이벤트 생성 버튼으로 시작해 보세요.'
                : '공개된 이벤트가 생기면 이곳에 표시됩니다.'
            }
            icon="▦"
            title="등록된 이벤트가 없습니다"
          />
        ) : (
          <ul className="meeting-note-list event-list">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  className="meeting-note-row"
                  onClick={() => void beginDetail(event)}
                  type="button"
                >
                  <span
                    className={`event-status event-status-${event.eventStatus.toLowerCase()}`}
                  >
                    {statusLabels[event.eventStatus]}
                  </span>
                  <strong>{event.name}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {message && (
        <FeedbackMessageDialog
          message={message}
          onClose={() => setMessage('')}
        />
      )}
    </section>
  )
}
