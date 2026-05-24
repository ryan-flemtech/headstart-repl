import React, { useState } from 'react'
import { useAssets } from './useAssets'

const MANUAL_VALUE = '__manual__'

function fileExt(filename) {
  const dot = filename.lastIndexOf('.')
  return dot !== -1 ? filename.slice(dot + 1).toLowerCase() : ''
}

function optionLabel(filename) {
  const ext = fileExt(filename)
  return ext ? `${filename}  [${ext}]` : filename
}

export default function AssetPicker({ lessonId, lessonType, value, onChange, placeholder }) {
  const { lessonFolderAssets, sharedAssets, loading } = useAssets()
  const [showManual, setShowManual] = useState(false)

  const lessonItems = lessonFolderAssets(lessonId)
  const typeItems = lessonType ? sharedAssets(lessonType) : []
  const commonItems = sharedAssets('common')
  const hasManifestEntries = lessonItems.length > 0 || typeItems.length > 0 || commonItems.length > 0

  // Determine if current value exists in manifest
  const allManifestFiles = [...lessonItems, ...typeItems, ...commonItems]
  const valueInManifest = value && allManifestFiles.includes(value)
  const isManualMode = showManual || (value && !valueInManifest && !loading)

  function handleSelectChange(e) {
    const v = e.target.value
    if (v === MANUAL_VALUE) {
      setShowManual(true)
    } else {
      setShowManual(false)
      onChange(v)
    }
  }

  function handleManualChange(e) {
    onChange(e.target.value)
  }

  function switchToDropdown() {
    setShowManual(false)
    onChange('')
  }

  if (!hasManifestEntries || loading) {
    return (
      <input
        style={s.input}
        value={value ?? ''}
        onChange={handleManualChange}
        placeholder={placeholder ?? 'e.g. images/photo.png'}
      />
    )
  }

  const selectValue = isManualMode ? MANUAL_VALUE : (value ?? '')

  return (
    <div style={s.wrap}>
      <select
        style={s.select}
        value={selectValue}
        onChange={handleSelectChange}
      >
        <option value="">— select asset —</option>
        {lessonItems.length > 0 && (
          <optgroup label="Lesson assets">
            {lessonItems.map(f => (
              <option key={f} value={f}>{optionLabel(f)}</option>
            ))}
          </optgroup>
        )}
        {typeItems.length > 0 && lessonType && (
          <optgroup label={`Shared (${lessonType})`}>
            {typeItems.map(f => (
              <option key={f} value={f}>{optionLabel(f)}</option>
            ))}
          </optgroup>
        )}
        {commonItems.length > 0 && (
          <optgroup label="Shared (common)">
            {commonItems.map(f => (
              <option key={f} value={f}>{optionLabel(f)}</option>
            ))}
          </optgroup>
        )}
        <option value={MANUAL_VALUE}>— enter path manually —</option>
      </select>

      {isManualMode && (
        <div style={s.manualRow}>
          <input
            style={{ ...s.input, flex: 1 }}
            value={value ?? ''}
            onChange={handleManualChange}
            placeholder={placeholder ?? 'e.g. images/photo.png'}
            autoFocus
          />
          <button
            type="button"
            style={s.browseBtn}
            onClick={switchToDropdown}
            title="Back to asset browser"
          >
            Browse
          </button>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  select: {
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    background: '#fff',
    width: '100%',
    outline: 'none',
  },
  input: {
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    outline: 'none',
    width: '100%',
  },
  manualRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  browseBtn: {
    padding: '6px 10px',
    border: '1px solid var(--colour-primary)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
}
