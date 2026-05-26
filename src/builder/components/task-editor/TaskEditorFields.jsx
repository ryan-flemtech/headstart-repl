import React from 'react'
import AssetBrowser from '../../../shared/AssetBrowser'
import { useAssets } from '../../../shared/useAssets'
import { SPRITE_TYPES } from '../../../app/components/ScratchWorkspace'
import { s } from './styles'

function CodeWorkspaceTabs({ activeTab, onChange, starterLabel = 'Starter code', testLabel = 'Complete code', rightAction = null }) {
  return (
    <div style={s.workspaceTabs} className="ui-tabs ui-tabs--editor" role="tablist" aria-label="Code workspace">
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'starter'}
        style={{ ...s.workspaceTab, ...(activeTab === 'starter' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('starter')}
      >
        {starterLabel}
      </button>
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'complete'}
        style={{ ...s.workspaceTab, ...(activeTab === 'complete' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('complete')}
      >
        {testLabel}
      </button>
      {rightAction && <div style={s.workspaceTabActions}>{rightAction}</div>}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div style={s.modalBackdrop} role="dialog" aria-modal="true">
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose} title="Close">x</button>
        </div>
        <div style={s.modalBody}>
          {children}
        </div>
      </div>
    </div>
  )
}

function CarryThroughPicker({ task, lesson, onUpdate, isScratch, isPython }) {
  const taskIndex = lesson.tasks.findIndex(t => t.id === task.id)
  const prevTask = taskIndex > 0 ? lesson.tasks[taskIndex - 1] : null
  const otherTasks = lesson.tasks.filter(t => t.id !== task.id)

  const carryField = isScratch ? 'carryBlocksFrom' : 'carryCodeFrom'
  const carryFrom = isScratch ? task.carryBlocksFrom : task.carryCodeFrom

  const mode = carryFrom == null
    ? 'new'
    : (prevTask && carryFrom === prevTask.id ? 'last' : 'other')

  function copyCompleteCode(sourceTask) {
    const updates = { [carryField]: sourceTask.id }
    if (isPython) {
      updates.starterCode = sourceTask.completeCode ?? sourceTask.starterCode ?? ''
    } else if (isScratch) {
      updates.starterBlocks = sourceTask.completeBlocks ?? sourceTask.starterBlocks ?? null
    } else {
      updates.starterFiles = (sourceTask.completeFiles ?? sourceTask.starterFiles ?? []).map(f => ({ ...f }))
      const newEntry = sourceTask.completeEntryFile ?? sourceTask.entryFile
      if (newEntry) updates.entryFile = newEntry
    }
    onUpdate({ ...task, ...updates })
  }

  function handleNewStarterCode() {
    const updates = { [carryField]: null }
    if (isPython) {
      updates.starterCode = ''
    } else if (isScratch) {
      updates.starterBlocks = null
    } else {
      updates.starterFiles = (task.starterFiles ?? []).map(f => ({ ...f, content: '' }))
    }
    onUpdate({ ...task, ...updates })
  }

  function handleOther() {
    const defaultTask = otherTasks.find(t => t.id !== prevTask?.id) ?? otherTasks[0]
    if (defaultTask) copyCompleteCode(defaultTask)
  }

  const radioName = `carry-${task.id}`

  return (
    <Field label={isScratch ? 'Carry blocks from task' : 'Carry code from task'}>
      <div style={s.carryRadioGroup}>
        <label style={{
          ...s.optionChoiceCard,
          ...(mode === 'last' ? s.optionChoiceCardActive : {}),
          ...(!prevTask ? s.optionChoiceCardDisabled : {}),
        }}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'last'}
            disabled={!prevTask}
            onChange={() => prevTask && copyCompleteCode(prevTask)}
            style={s.optionChoiceInput}
          />
          <span style={s.optionChoiceTitle}>Carry from last task</span>
          <span style={{ ...s.optionChoiceText, ...(mode === 'last' ? s.optionChoiceTextActive : {}) }}>
            {prevTask ? `${prevTask.id}. ${prevTask.title || 'Untitled'}` : 'No previous task'}
          </span>
        </label>

        <label style={{ ...s.optionChoiceCard, ...(mode === 'new' ? s.optionChoiceCardActive : {}) }}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'new'}
            onChange={handleNewStarterCode}
            style={s.optionChoiceInput}
          />
          <span style={s.optionChoiceTitle}>New starter code</span>
          <span style={{ ...s.optionChoiceText, ...(mode === 'new' ? s.optionChoiceTextActive : {}) }}>
            Start this task from its own starter content.
          </span>
        </label>

        <label style={{
          ...s.optionChoiceCard,
          ...(mode === 'other' ? s.optionChoiceCardActive : {}),
          ...(otherTasks.length === 0 ? s.optionChoiceCardDisabled : {}),
        }}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'other'}
            disabled={otherTasks.length === 0}
            onChange={handleOther}
            style={s.optionChoiceInput}
          />
          <span style={s.optionChoiceTitle}>From other task</span>
          <span style={{ ...s.optionChoiceText, ...(mode === 'other' ? s.optionChoiceTextActive : {}) }}>
            Copy complete code from a chosen task.
          </span>
        </label>

        {mode === 'other' && (
          <select
            style={s.select}
            value={carryFrom ?? ''}
            onChange={e => {
              const sourceTask = lesson.tasks.find(t => t.id === parseInt(e.target.value, 10))
              if (sourceTask) copyCompleteCode(sourceTask)
            }}
          >
            {otherTasks.map(t => (
              <option key={t.id} value={t.id}>{t.id}. {t.title || 'Untitled'}</option>
            ))}
          </select>
        )}
      </div>
    </Field>
  )
}

function TaskFormatIcon({ type }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'scratch') return (
    <svg {...common}>
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" />
    </svg>
  )
  if (type === 'information') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
  if (type === 'quiz') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
  return (
    <svg {...common}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function QuizTypeIcon({ type }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'match') return (
    <svg {...common}>
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
      <path d="M17 7h.01" />
      <path d="M17 17h.01" />
      <path d="M8 7h8" />
      <path d="M8 17h8" />
    </svg>
  )
  if (type === 'blank') return (
    <svg {...common}>
      <path d="M4 7h16" />
      <path d="M4 12h6" />
      <path d="M14 12h6" />
      <path d="M4 17h16" />
    </svg>
  )
  if (type === 'answer') return (
    <svg {...common}>
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h7" />
      <path d="M15 18l2 2 4-5" />
    </svg>
  )
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="2" />
      <path d="M11 7h8" />
      <circle cx="7" cy="17" r="2" />
      <path d="M11 17h8" />
    </svg>
  )
}

const SPRITE_TYPE_OPTIONS = SPRITE_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

export function SpriteManager({ sprites, onChange, assetsPath = '', lessonId, lessonType }) {
  const [expandedCostumes, setExpandedCostumes] = React.useState({})

  function addSprite() {
    const next = sprites.length + 1
    onChange([...sprites, { id: `sprite${next}`, name: `Sprite ${next}`, type: 'cat', x: 0, y: 0, size: 100, direction: 90 }])
  }

  function removeSprite(id) {
    if (sprites.length <= 1) return
    onChange(sprites.filter(sp => sp.id !== id))
  }

  function update(id, field, value) {
    onChange(sprites.map(sp => sp.id === id ? { ...sp, [field]: value } : sp))
  }

  function toggleCostumes(id) {
    setExpandedCostumes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function addCostume(spriteId) {
    const sp = sprites.find(s => s.id === spriteId)
    const next = (sp?.costumes ?? []).length + 1
    onChange(sprites.map(s => s.id === spriteId ? { ...s, costumes: [...(s.costumes ?? []), { name: `costume${next}`, image: '' }] } : s))
  }

  function removeCostume(spriteId, idx) {
    onChange(sprites.map(s => s.id === spriteId ? { ...s, costumes: (s.costumes ?? []).filter((_, i) => i !== idx) } : s))
  }

  function updateCostume(spriteId, idx, field, value) {
    onChange(sprites.map(s => {
      if (s.id !== spriteId) return s
      return { ...s, costumes: (s.costumes ?? []).map((c, i) => i === idx ? { ...c, [field]: value } : c) }
    }))
  }

  return (
    <div style={s.spriteManager}>
      {sprites.map(sp => (
        <div key={sp.id}>
          <div style={s.spriteRow}>
            <input
              style={{ ...s.input, width: 120, flex: '0 0 120px' }}
              value={sp.name}
              onChange={e => update(sp.id, 'name', e.target.value)}
              placeholder="Name"
            />
            <select style={{ ...s.select, flex: '0 0 auto' }} value={sp.type ?? 'cat'} onChange={e => update(sp.id, 'type', e.target.value)}>
              {SPRITE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>X</span>
              <input style={{ ...s.input, width: 56 }} type="number" value={sp.x ?? 0} onChange={e => update(sp.id, 'x', Number(e.target.value))} />
            </label>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>Y</span>
              <input style={{ ...s.input, width: 56 }} type="number" value={sp.y ?? 0} onChange={e => update(sp.id, 'y', Number(e.target.value))} />
            </label>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>Size</span>
              <input style={{ ...s.input, width: 60 }} type="number" min="10" max="500" value={sp.size ?? 100} onChange={e => update(sp.id, 'size', Number(e.target.value))} />
            </label>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>Dir</span>
              <input style={{ ...s.input, width: 56 }} type="number" value={sp.direction ?? 90} onChange={e => update(sp.id, 'direction', Number(e.target.value))} />
            </label>
            <button
              type="button"
              style={s.costumeToggleBtn}
              onClick={() => toggleCostumes(sp.id)}
              title="Edit costumes"
            >
              Costumes ({(sp.costumes ?? []).length})
            </button>
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => removeSprite(sp.id)}
              disabled={sprites.length <= 1}
              title="Remove sprite"
            >
              ✕
            </button>
          </div>
          {expandedCostumes[sp.id] && (
            <CostumeManager
              costumes={sp.costumes ?? []}
              assetsPath={assetsPath}
              lessonId={lessonId}
              lessonType={lessonType}
              onAdd={() => addCostume(sp.id)}
              onRemove={idx => removeCostume(sp.id, idx)}
              onUpdate={(idx, field, value) => updateCostume(sp.id, idx, field, value)}
            />
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={s.addSpriteBtn} onClick={addSprite}>
        + Add sprite
      </button>
    </div>
  )
}

function CostumeManager({ costumes, assetsPath, lessonId, lessonType, onAdd, onRemove, onUpdate }) {
  const [browsingIdx, setBrowsingIdx] = React.useState(null)
  const { lessonAssets } = useAssets()
  const assets = lessonAssets(lessonId, lessonType)

  return (
    <div style={s.costumeManager}>
      {costumes.length === 0 && (
        <p style={s.costumeEmpty}>No costumes — sprite uses its built-in shape. Add a costume to use an image from the assets folder.</p>
      )}
      {costumes.map((c, idx) => {
        const resolvedUrl = c.image && assetsPath
          ? assetsPath.replace(/\/$/, '') + '/' + c.image.replace(/^\//, '')
          : null
        const isBrowsing = browsingIdx === idx
        return (
          <div key={idx} style={s.costumeBlock}>
            <div style={s.costumeRow}>
              {idx === 0 && <span style={s.costumeTag}>Default</span>}
              <input
                style={{ ...s.input, flex: '1 1 100px', minWidth: 0 }}
                value={c.name}
                onChange={e => onUpdate(idx, 'name', e.target.value)}
                placeholder="Costume name"
              />
              <input
                style={{ ...s.input, flex: '2 1 120px', minWidth: 0, fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}
                value={c.image ?? ''}
                onChange={e => onUpdate(idx, 'image', e.target.value)}
                placeholder="e.g. sprites/cat1.png"
              />
              {assets.length > 0 && (
                <button
                  type="button"
                  style={{ ...s.browseToggleBtn, ...(isBrowsing ? s.browseToggleBtnActive : {}) }}
                  onClick={() => setBrowsingIdx(isBrowsing ? null : idx)}
                  title="Browse assets"
                >
                  Browse
                </button>
              )}
              {resolvedUrl && (
                <img
                  src={resolvedUrl}
                  alt=""
                  style={s.costumeThumb}
                  onError={e => { e.target.style.display = 'none' }}
                  onLoad={e => { e.target.style.display = 'block' }}
                />
              )}
              <button
                type="button"
                style={s.removeBtn}
                onClick={() => onRemove(idx)}
                title="Remove costume"
              >✕</button>
            </div>
            {isBrowsing && assetsPath && assets.length > 0 && (
              <AssetBrowser
                assetsPath={assetsPath}
                assets={assets}
                mode="select"
                onSelect={path => { onUpdate(idx, 'image', path); setBrowsingIdx(null) }}
                style={s.inlineBrowser}
              />
            )}
          </div>
        )
      })}
      <button type="button" className="btn-ghost" style={s.addSpriteBtn} onClick={onAdd}>
        + Add costume
      </button>
    </div>
  )
}

export function BackdropManager({ backdrops, onChange, assetsPath, lessonId, lessonType }) {
  const [browsingId, setBrowsingId] = React.useState(null)
  const { lessonAssets } = useAssets()
  const assets = lessonAssets(lessonId, lessonType)

  function add() {
    const next = backdrops.length + 1
    onChange([...backdrops, { id: `backdrop${next}`, name: `Backdrop ${next}`, colour: '#87CEEB' }])
  }
  function remove(id) {
    if (backdrops.length <= 1) return
    onChange(backdrops.filter(b => b.id !== id))
  }
  function update(id, updates) {
    onChange(backdrops.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  return (
    <div style={s.backdropManager}>
      {backdrops.map((b, i) => {
        const isImage = b.image !== undefined
        const resolvedUrl = isImage && b.image && assetsPath
          ? assetsPath.replace(/\/$/, '') + '/' + b.image.replace(/^\//, '')
          : null
        const isBrowsing = browsingId === b.id
        return (
          <div key={b.id} style={s.backdropBlock}>
            <div style={s.backdropRow}>
              {i === 0 && <span style={s.backdropTag}>Default</span>}
              <input
                style={{ ...s.input, flex: '1 1 110px', minWidth: 0 }}
                value={b.name}
                onChange={e => update(b.id, { name: e.target.value })}
                placeholder="Name"
              />
              <select
                style={{ ...s.select, flex: '0 0 auto' }}
                value={isImage ? 'image' : 'colour'}
                onChange={e => {
                  if (e.target.value === 'image') update(b.id, { image: '', colour: undefined })
                  else update(b.id, { colour: b.colour ?? '#ffffff', image: undefined })
                }}
              >
                <option value="colour">Colour</option>
                <option value="image">Image</option>
              </select>
              {isImage ? (
                <>
                  <input
                    style={{ ...s.input, flex: '2 1 120px', minWidth: 0, fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}
                    value={b.image ?? ''}
                    onChange={e => update(b.id, { image: e.target.value })}
                    placeholder="e.g. backdrops/sky.png"
                  />
                  {assets.length > 0 && (
                    <button
                      type="button"
                      style={{ ...s.browseToggleBtn, ...(isBrowsing ? s.browseToggleBtnActive : {}) }}
                      onClick={() => setBrowsingId(isBrowsing ? null : b.id)}
                      title="Browse assets"
                    >
                      Browse
                    </button>
                  )}
                  {resolvedUrl && (
                    <img
                      src={resolvedUrl}
                      alt=""
                      style={s.backdropThumb}
                      onError={e => { e.target.style.display = 'none' }}
                      onLoad={e => { e.target.style.display = 'block' }}
                    />
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="color"
                    value={b.colour ?? '#ffffff'}
                    onChange={e => update(b.id, { colour: e.target.value })}
                    style={s.colorInput}
                  />
                  <div style={{ ...s.backdropSwatch, background: b.colour ?? '#ffffff' }} />
                </div>
              )}
              <button
                type="button"
                style={s.removeBtn}
                onClick={() => remove(b.id)}
                disabled={backdrops.length <= 1}
                title="Remove backdrop"
              >✕</button>
            </div>
            {isBrowsing && assetsPath && assets.length > 0 && (
              <AssetBrowser
                assetsPath={assetsPath}
                assets={assets}
                mode="select"
                onSelect={path => { update(b.id, { image: path }); setBrowsingId(null) }}
                style={s.inlineBrowser}
              />
            )}
          </div>
        )
      })}
      <button type="button" className="btn-ghost" style={s.addSpriteBtn} onClick={add}>
        + Add backdrop
      </button>
    </div>
  )
}

export { Field, TaskFormatIcon, QuizTypeIcon, CodeWorkspaceTabs, Modal, CarryThroughPicker }
