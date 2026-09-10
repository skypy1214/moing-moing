import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { FeedbackMessageDialog } from '../../shared/feedback-dialog/FeedbackMessageDialog'
import { EmptyState } from '../../shared/ui/EmptyState'
import { Modal } from '../../shared/ui/Modal'
import { SelectField } from '../../shared/ui/SelectField'

type Category = {
  id: string
  name: string
  color: string
  sortOrder: number
  active: boolean
}

type BoardPost = {
  id: string
  categoryId: string
  title: string
  markdownContent: string
  noteStatus: 'PUBLISHED' | 'HIDDEN'
  createdAt: string
}

type BoardView = 'LIST' | 'DETAIL' | 'EDITOR' | 'CATEGORY_SETTINGS'
type NoteSort =
  'DEFAULT' | 'CREATED_ASC' | 'CREATED_DESC' | 'TITLE_ASC' | 'TITLE_DESC'

const initialMarkdown = `# 2026년 8월 운영 회의록

> 회의 일시: 2026/08/24 · 작성: 운영진

## 안건

1. 지난 모임 운영 회고
2. 다음 정모 준비
3. 대관 일정 확인

## 논의 내용

- **참여 안내**는 모임 이틀 전에 공지합니다.
- *대관 확정* 전에는 외부 공지를 올리지 않습니다.
- 필요한 자료는 운영진 단체 채팅방에 공유합니다.

## 할 일

- [ ] 대관 가능 날짜 확인 — 담당: 민지
- [x] 다음 모임 장소 후보 정리 — 담당: 준호
- [ ] 공지 초안 작성 — 담당: 서연

## 일정 및 담당

| 날짜 | 내용 | 담당 | 상태 |
| --- | --- | --- | --- |
| 08/28 | 대관 문의 | 민지 | 진행 중 |
| 08/30 | 정모 공지 | 서연 | 예정 |

## 결정 사항

다음 정모는 **토요일 오후**를 우선으로 검토합니다. 확정 전 변경 사항은 이 게시글에 계속 기록합니다.

## 참고 명령

\`\`\`text
공지 게시 전: 대관 확정 여부와 참석 가능 인원을 확인한다.
\`\`\``

type MeetingNotePageProps = {
  isAdmin?: boolean
  readOnly?: boolean
}

export function MeetingNotePage({
  isAdmin = false,
  readOnly = false,
}: MeetingNotePageProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [notes, setNotes] = useState<BoardPost[]>([])
  const [hiddenNotes, setHiddenNotes] = useState<BoardPost[]>([])
  const [selectedNote, setSelectedNote] = useState<BoardPost | null>(null)
  const [view, setView] = useState<BoardView>('LIST')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [noteSort, setNoteSort] = useState<NoteSort>('DEFAULT')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [markdownContent, setMarkdownContent] = useState(initialMarkdown)
  const [categoryName, setCategoryName] = useState('')
  const [categoryColor, setCategoryColor] = useState('#6657D9')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isHiddenNotesDialogOpen, setIsHiddenNotesDialogOpen] = useState(false)
  const [message, setMessage] = useState('')

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  )

  const visibleNotes = useMemo(() => {
    const filteredNotes =
      filterCategoryId === ''
        ? notes
        : notes.filter((note) => note.categoryId === filterCategoryId)

    return [...filteredNotes].sort((left, right) => {
      if (noteSort === 'DEFAULT') {
        return 0
      }
      if (noteSort === 'TITLE_ASC' || noteSort === 'TITLE_DESC') {
        const comparison = left.title.localeCompare(right.title, 'ko')
        return noteSort === 'TITLE_ASC' ? comparison : -comparison
      }
      const comparison = left.createdAt.localeCompare(right.createdAt)
      return noteSort === 'CREATED_ASC' ? comparison : -comparison
    })
  }, [filterCategoryId, noteSort, notes])

  async function loadCategories() {
    const response = await fetch('/api/v1/meeting-note-categories', {
      credentials: 'include',
    })
    if (response.ok) {
      setCategories((await response.json()) as Category[])
    }
  }

  async function loadNotes(categoryFilter = filterCategoryId) {
    const query = categoryFilter === '' ? '' : `?categoryId=${categoryFilter}`
    const response = await fetch(`/api/v1/meeting-notes${query}`, {
      credentials: 'include',
    })
    if (response.ok) {
      setNotes((await response.json()) as BoardPost[])
    }
  }

  async function loadHiddenNotes() {
    const response = await fetch('/api/v1/meeting-notes/hidden', {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('숨김 글 목록을 불러오지 못했습니다.')
      return false
    }
    setHiddenNotes((await response.json()) as BoardPost[])
    return true
  }

  useEffect(() => {
    // Initial server-state synchronization intentionally runs once for this feature page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([loadCategories(), loadNotes('')])
    // The loaders are deliberately not dependencies: adding them would reload on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isCategoryDialogOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCategoryDialogOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCategoryDialogOpen])

  function beginPostCreation() {
    setSelectedNote(null)
    setTitle('')
    setCategoryId(activeCategories[0]?.id ?? '')
    setMarkdownContent(initialMarkdown)
    setMessage('')
    setView('EDITOR')
  }

  function beginPostEdit(note: BoardPost) {
    setSelectedNote(note)
    setTitle(note.title)
    setCategoryId(note.categoryId)
    setMarkdownContent(note.markdownContent)
    setMessage('')
    setView('EDITOR')
  }

  function beginPostDetail(note: BoardPost) {
    setSelectedNote(note)
    setMessage('')
    setView('DETAIL')
  }

  function returnToList() {
    setSelectedNote(null)
    setMessage('')
    setView('LIST')
  }

  function nextNoteSort(field: 'CREATED' | 'TITLE') {
    const ascending = `${field}_ASC` as NoteSort
    const descending = `${field}_DESC` as NoteSort
    setNoteSort((current) =>
      current === ascending
        ? descending
        : current === descending
          ? 'DEFAULT'
          : ascending,
    )
  }

  function noteSortIndicator(field: 'CREATED' | 'TITLE') {
    if (noteSort === `${field}_ASC`) {
      return '↑'
    }
    if (noteSort === `${field}_DESC`) {
      return '↓'
    }
    return '↕'
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const endpoint =
      editingCategory === null
        ? '/api/v1/meeting-note-categories'
        : `/api/v1/meeting-note-categories/${editingCategory.id}`
    const response = await fetch(endpoint, {
      method: editingCategory === null ? 'POST' : 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: categoryName,
        color: categoryColor,
        sortOrder: editingCategory?.sortOrder ?? activeCategories.length,
      }),
    })
    if (!response.ok) {
      setMessage('카테고리를 저장하지 못했습니다.')
      return
    }
    setCategoryName('')
    setCategoryColor('#6657D9')
    setEditingCategory(null)
    setIsCategoryDialogOpen(false)
    await loadCategories()
    setMessage('카테고리를 저장했습니다.')
  }

  async function deactivateCategory(category: Category) {
    const response = await fetch(
      `/api/v1/meeting-note-categories/${category.id}/deactivate`,
      { method: 'POST', credentials: 'include' },
    )
    if (!response.ok) {
      setMessage('카테고리를 비활성화하지 못했습니다.')
      return
    }
    if (filterCategoryId === category.id) {
      setFilterCategoryId('')
      await loadNotes('')
    }
    await loadCategories()
    setMessage('카테고리를 비활성화했습니다. 기존 게시글 분류는 유지됩니다.')
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (categoryId === '') {
      setMessage('카테고리를 먼저 선택해 주세요.')
      return
    }
    const response = await fetch(
      selectedNote === null
        ? '/api/v1/meeting-notes'
        : `/api/v1/meeting-notes/${selectedNote.id}`,
      {
        method: selectedNote === null ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, title, markdownContent }),
      },
    )
    if (!response.ok) {
      setMessage('게시글을 저장하지 못했습니다.')
      return
    }
    await loadNotes()
    setMessage('게시글을 저장했습니다.')
    setView('LIST')
  }

  async function hideNote(note: BoardPost) {
    const response = await fetch(`/api/v1/meeting-notes/${note.id}/hide`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('게시글을 숨기지 못했습니다.')
      return
    }
    await loadNotes()
    setMessage('게시글을 숨겼습니다. 기존 내용은 보존됩니다.')
    setView('LIST')
  }

  async function publishNote(note: BoardPost) {
    const response = await fetch(`/api/v1/meeting-notes/${note.id}/publish`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('게시글 숨김을 해제하지 못했습니다.')
      return
    }
    await Promise.all([loadNotes(), loadHiddenNotes()])
    setMessage('게시글 숨김을 해제했습니다.')
  }

  async function openHiddenNotesDialog() {
    if (await loadHiddenNotes()) {
      setIsHiddenNotesDialogOpen(true)
    }
  }

  function categoryFor(note: BoardPost) {
    return categories.find((category) => category.id === note.categoryId)
  }

  function openCategoryDialog(category?: Category) {
    setEditingCategory(category ?? null)
    setCategoryName(category?.name ?? '')
    setCategoryColor(category?.color ?? '#6657D9')
    setIsCategoryDialogOpen(true)
  }

  if (view === 'CATEGORY_SETTINGS') {
    return (
      <section
        className="meeting-note-page"
        aria-labelledby="category-settings-heading"
      >
        <div className="attendance-page-heading">
          <div>
            <p className="eyebrow">ADMIN SETTINGS</p>
            <h2 id="category-settings-heading">게시판 카테고리 관리</h2>
            <p>카테고리 추가와 수정은 관리자만 할 수 있습니다.</p>
          </div>
          <button
            className="secondary-button"
            onClick={returnToList}
            type="button"
          >
            게시판으로 돌아가기
          </button>
        </div>
        <section className="panel board-settings-panel">
          <div className="panel-heading">
            <div>
              <h3>카테고리 목록</h3>
              <p>기존 게시글의 분류는 비활성화해도 보존됩니다.</p>
            </div>
            <button onClick={() => openCategoryDialog()} type="button">
              카테고리 추가
            </button>
          </div>
          <ul className="meeting-note-category-list">
            {categories.map((category) => (
              <li key={category.id}>
                <span style={{ borderColor: category.color }}>
                  {category.name}
                  {category.active ? '' : ' (비활성)'}
                </span>
                {category.active && (
                  <div className="category-actions">
                    <button
                      className="secondary-button"
                      onClick={() => openCategoryDialog(category)}
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => void deactivateCategory(category)}
                      type="button"
                    >
                      비활성화
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        {isCategoryDialogOpen && (
          <Modal
            ariaLabelledBy="category-dialog-heading"
            footer={
              <>
                <button
                  className="secondary-button"
                  onClick={() => setIsCategoryDialogOpen(false)}
                  type="button"
                >
                  취소
                </button>
                <button form="category-form" type="submit">
                  저장
                </button>
              </>
            }
            onClose={() => setIsCategoryDialogOpen(false)}
          >
            <div className="modal-heading">
              <h3 id="category-dialog-heading">
                {editingCategory === null ? '카테고리 추가' : '카테고리 수정'}
              </h3>
              <p>색상은 게시판 목록의 카테고리 배지에 표시됩니다.</p>
            </div>
            <form className="form" id="category-form" onSubmit={submitCategory}>
              <label>
                이름
                <input
                  onChange={(event) => setCategoryName(event.target.value)}
                  required
                  value={categoryName}
                />
              </label>
              <label>
                색상
                <input
                  onChange={(event) => setCategoryColor(event.target.value)}
                  pattern="#[0-9A-Fa-f]{6}"
                  required
                  value={categoryColor}
                />
              </label>
            </form>
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

  if (view === 'EDITOR') {
    return (
      <section
        className="meeting-note-page"
        aria-labelledby="board-editor-heading"
      >
        <div className="attendance-page-heading">
          <div>
            <p className="eyebrow">BOARD</p>
            <h2 id="board-editor-heading">
              {selectedNote === null ? '게시글 작성' : '게시글 수정'}
            </h2>
            <p>Markdown으로 작성하고, 저장 전 미리 보기로 확인합니다.</p>
          </div>
          <button
            className="secondary-button"
            onClick={returnToList}
            type="button"
          >
            목록으로
          </button>
        </div>
        <form className="panel form" onSubmit={submitNote}>
          <SelectField
            label="카테고리"
            onChange={setCategoryId}
            options={activeCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            placeholder="선택해 주세요"
            value={categoryId}
          />
          <label>
            제목
            <input
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label>
            Markdown 본문
            <textarea
              className="markdown-editor"
              onChange={(event) => setMarkdownContent(event.target.value)}
              required
              value={markdownContent}
            />
          </label>
          <div className="form-actions">
            <button type="submit">저장</button>
            {selectedNote !== null && (
              <button
                className="danger-button"
                onClick={() => void hideNote(selectedNote)}
                type="button"
              >
                숨김
              </button>
            )}
          </div>
        </form>
        <section className="panel markdown-preview">
          <h3>미리 보기</h3>
          <Markdown remarkPlugins={[remarkGfm]} skipHtml>
            {markdownContent}
          </Markdown>
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

  if (view === 'DETAIL' && selectedNote !== null) {
    const category = categoryFor(selectedNote)

    return (
      <section
        className="meeting-note-page"
        aria-labelledby="board-detail-heading"
      >
        <div className="attendance-page-heading">
          <div>
            <p className="eyebrow">{category?.name ?? '게시글'}</p>
            <h2 id="board-detail-heading">{selectedNote.title}</h2>
            <p>{selectedNote.createdAt.slice(0, 10)} 작성</p>
          </div>
          <div className="header-actions">
            {!readOnly && (
              <button onClick={() => beginPostEdit(selectedNote)} type="button">
                수정
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
        <article className="panel markdown-preview board-post-detail">
          <Markdown remarkPlugins={[remarkGfm]} skipHtml>
            {selectedNote.markdownContent}
          </Markdown>
        </article>
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
    <section className="meeting-note-page" aria-labelledby="board-heading">
      <div className="attendance-page-heading">
        <div>
          <p className="eyebrow">BOARD</p>
          <h2 id="board-heading">게시판</h2>
          <p>카테고리별 운영 기록과 안내 글을 확인합니다.</p>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button
              className="secondary-button"
              onClick={() => setView('CATEGORY_SETTINGS')}
              type="button"
            >
              카테고리 관리
            </button>
          )}
          {!readOnly && (
            <button
              className="secondary-button"
              onClick={() => void openHiddenNotesDialog()}
              type="button"
            >
              숨김 글
            </button>
          )}
          {!readOnly && (
            <button onClick={beginPostCreation} type="button">
              글 작성
            </button>
          )}
        </div>
      </div>
      <section className="panel">
        <div className="meeting-note-list-controls">
          <div
            aria-label="카테고리 필터"
            className="meeting-note-filter-buttons"
            role="group"
          >
            <button
              className={
                filterCategoryId === ''
                  ? 'is-active is-active-green'
                  : 'secondary-button'
              }
              onClick={() => {
                setFilterCategoryId('')
                void loadNotes('')
              }}
              type="button"
            >
              전체
            </button>
            {activeCategories.map((category) => (
              <button
                className={
                  filterCategoryId === category.id
                    ? 'is-active is-active-green'
                    : 'secondary-button'
                }
                key={category.id}
                onClick={() => {
                  setFilterCategoryId(category.id)
                  void loadNotes(category.id)
                }}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
          <div
            aria-label="게시글 정렬"
            className="meeting-note-sort-buttons"
            role="group"
          >
            <button
              className={`secondary-button meeting-note-sort-${noteSort === 'CREATED_ASC' ? 'asc' : noteSort === 'CREATED_DESC' ? 'desc' : 'none'}`}
              onClick={() => nextNoteSort('CREATED')}
              type="button"
            >
              작성일 {noteSortIndicator('CREATED')}
            </button>
            <button
              className={`secondary-button meeting-note-sort-${noteSort === 'TITLE_ASC' ? 'asc' : noteSort === 'TITLE_DESC' ? 'desc' : 'none'}`}
              onClick={() => nextNoteSort('TITLE')}
              type="button"
            >
              제목 {noteSortIndicator('TITLE')}
            </button>
          </div>
        </div>
        {activeCategories.length === 0 ? (
          <EmptyState
            description="관리자가 카테고리를 준비하면 게시글을 작성할 수 있습니다."
            icon="☰"
            title="카테고리를 불러오지 못했습니다"
          />
        ) : visibleNotes.length === 0 ? (
          <EmptyState
            description="새 글을 작성하거나 필터를 변경해 보세요."
            icon="☰"
            title="조건에 맞는 게시글이 없습니다"
          />
        ) : (
          <ul className="meeting-note-list">
            {visibleNotes.map((note) => {
              const category = categoryFor(note)
              return (
                <li key={note.id}>
                  <button
                    className="meeting-note-row"
                    onClick={() => beginPostDetail(note)}
                    type="button"
                  >
                    <span
                      className="meeting-note-category"
                      style={{ backgroundColor: category?.color }}
                    >
                      {category?.name ?? '분류 없음'}
                    </span>
                    <strong>{note.title}</strong>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {isHiddenNotesDialogOpen && (
        <Modal
          ariaLabelledBy="hidden-notes-dialog-heading"
          footer={
            <button
              className="secondary-button"
              onClick={() => setIsHiddenNotesDialogOpen(false)}
              type="button"
            >
              닫기
            </button>
          }
          onClose={() => setIsHiddenNotesDialogOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="hidden-notes-dialog-heading">숨김 글</h3>
            <p>숨긴 게시글을 다시 공개할 수 있습니다.</p>
          </div>
          {hiddenNotes.length === 0 ? (
            <EmptyState
              description="현재 숨긴 게시글이 없습니다."
              icon="📄"
              title="숨김 글이 없습니다"
            />
          ) : (
            <ul className="meeting-note-hidden-list">
              {hiddenNotes.map((note) => {
                const category = categoryFor(note)
                return (
                  <li key={note.id}>
                    <div>
                      <span
                        className="meeting-note-category"
                        style={{ backgroundColor: category?.color }}
                      >
                        {category?.name ?? '분류 없음'}
                      </span>
                      <strong>{note.title}</strong>
                    </div>
                    <button
                      onClick={() => void publishNote(note)}
                      type="button"
                    >
                      숨김 해제
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
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
