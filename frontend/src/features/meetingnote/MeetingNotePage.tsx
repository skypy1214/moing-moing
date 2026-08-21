import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { apiFetch as fetch } from '../../shared/api/apiFetch'

type Category = {
  id: string
  name: string
  color: string
  sortOrder: number
  active: boolean
}

type MeetingNote = {
  id: string
  categoryId: string
  title: string
  markdownContent: string
  noteStatus: 'PUBLISHED' | 'HIDDEN'
  createdAt: string
}

type NoteSort = 'CREATED_DESC' | 'CREATED_ASC' | 'TITLE_ASC'

const initialMarkdown = `## 안건\n\n- [ ] 논의할 내용\n- [x] 완료한 내용\n\n| 담당 | 할 일 |\n| --- | --- |\n| 운영진 | 다음 모임 준비 |`

export function MeetingNotePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null)
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [noteSort, setNoteSort] = useState<NoteSort>('CREATED_DESC')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [markdownContent, setMarkdownContent] = useState(initialMarkdown)
  const [categoryName, setCategoryName] = useState('')
  const [categoryColor, setCategoryColor] = useState('#2463A5')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
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
      if (noteSort === 'TITLE_ASC') {
        return left.title.localeCompare(right.title, 'ko')
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
      setNotes((await response.json()) as MeetingNote[])
    }
  }

  useEffect(() => {
    // Initial server-state synchronization intentionally runs once for this feature page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([loadCategories(), loadNotes('')])
    // The loaders are deliberately not dependencies: adding them would reload on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetEditor() {
    setSelectedNote(null)
    setTitle('')
    setCategoryId(activeCategories[0]?.id ?? '')
    setMarkdownContent(initialMarkdown)
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
    setEditingCategory(null)
    await loadCategories()
    setMessage('카테고리를 저장했습니다.')
  }

  function beginCategoryEdit(category: Category) {
    setEditingCategory(category)
    setCategoryName(category.name)
    setCategoryColor(category.color)
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
    setMessage('카테고리를 비활성화했습니다. 기존 회의록 분류는 유지됩니다.')
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
      setMessage('회의록을 저장하지 못했습니다.')
      return
    }
    await loadNotes()
    resetEditor()
    setMessage('회의록을 저장했습니다.')
  }

  async function hideNote(note: MeetingNote) {
    const response = await fetch(`/api/v1/meeting-notes/${note.id}/hide`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('회의록을 숨기지 못했습니다.')
      return
    }
    await loadNotes()
    resetEditor()
    setMessage('회의록을 숨겼습니다. 기존 내용은 보존됩니다.')
  }

  function editNote(note: MeetingNote) {
    setSelectedNote(note)
    setTitle(note.title)
    setCategoryId(note.categoryId)
    setMarkdownContent(note.markdownContent)
  }

  function categoryFor(note: MeetingNote) {
    return categories.find((category) => category.id === note.categoryId)
  }

  return (
    <section className="meeting-note-page">
      <div className="attendance-page-heading">
        <div>
          <p className="eyebrow">MEETING NOTES</p>
          <h2>회의록</h2>
          <p>Markdown으로 작성하고, 저장 전 미리 보기로 확인합니다.</p>
        </div>
        <button
          className="secondary-button"
          onClick={resetEditor}
          type="button"
        >
          새 회의록
        </button>
      </div>

      <section className="meeting-note-grid">
        <aside className="panel">
          <h3>카테고리</h3>
          <form className="form" onSubmit={submitCategory}>
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
            <div className="form-actions">
              <button type="submit">
                {editingCategory === null ? '카테고리 추가' : '카테고리 수정'}
              </button>
              {editingCategory !== null && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditingCategory(null)
                    setCategoryName('')
                    setCategoryColor('#2463A5')
                  }}
                  type="button"
                >
                  취소
                </button>
              )}
            </div>
          </form>
          <div className="meeting-note-category-list">
            {activeCategories.map((category) => (
              <div key={category.id}>
                <span style={{ borderColor: category.color }}>
                  {category.name}
                </span>
                <div className="category-actions">
                  <button
                    className="secondary-button"
                    onClick={() => beginCategoryEdit(category)}
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
              </div>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>목록</h3>
              <p>
                공개 회의록 {visibleNotes.length}건 · 숨긴 회의록은 목록에서
                제외됩니다.
              </p>
            </div>
          </div>
          <div className="meeting-note-list-controls">
            <label>
              카테고리 필터
              <select
                onChange={(event) => {
                  setFilterCategoryId(event.target.value)
                  void loadNotes(event.target.value)
                }}
                value={filterCategoryId}
              >
                <option value="">전체</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              정렬
              <select
                onChange={(event) =>
                  setNoteSort(event.target.value as NoteSort)
                }
                value={noteSort}
              >
                <option value="CREATED_DESC">최신 작성순</option>
                <option value="CREATED_ASC">오래된 작성순</option>
                <option value="TITLE_ASC">제목 가나다순</option>
              </select>
            </label>
          </div>
          {activeCategories.length === 0 ? (
            <p className="empty-state">
              먼저 카테고리를 추가해 주세요. 카테고리가 있어야 회의록을 작성할
              수 있습니다.
            </p>
          ) : visibleNotes.length === 0 ? (
            <p className="empty-state">
              선택한 조건에 맞는 회의록이 없습니다. 새 회의록을 작성하거나
              필터를 변경해 보세요.
            </p>
          ) : (
            <ul className="meeting-note-list">
              {visibleNotes.map((note) => {
                const category = categoryFor(note)
                return (
                  <li key={note.id}>
                    <button
                      className="meeting-note-row"
                      onClick={() => editNote(note)}
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
      </section>

      <form className="panel form" onSubmit={submitNote}>
        <div className="panel-heading">
          <div>
            <h3>{selectedNote === null ? '회의록 작성' : '회의록 수정'}</h3>
            <p>raw HTML은 렌더링하지 않습니다.</p>
          </div>
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
        <label>
          카테고리
          <select
            onChange={(event) => setCategoryId(event.target.value)}
            required
            value={categoryId}
          >
            <option value="">선택해 주세요</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
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
        <button type="submit">저장</button>
      </form>

      <section className="panel markdown-preview">
        <h3>미리 보기</h3>
        <Markdown remarkPlugins={[remarkGfm]} skipHtml>
          {markdownContent}
        </Markdown>
      </section>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
