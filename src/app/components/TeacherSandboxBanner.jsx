import React from 'react'

export default function TeacherSandboxBanner({ staging, isScratch, onCancel, onReset, onGoLive, onPushScratch, onDeactivate }) {
  return (
    <div className="teacher-sandbox-banner">
      <span className="teacher-sandbox-banner__text">
        {staging
          ? 'Sandbox preview — students are still on the lesson'
          : 'Sandbox is LIVE — students can see this'}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {staging ? (
          <>
            <button className="btn-ghost teacher-sandbox-banner__btn teacher-sandbox-banner__btn--warn" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn-ghost teacher-sandbox-banner__btn teacher-sandbox-banner__btn--warn" onClick={onReset}>
              Reset to Sandbox Starter
            </button>
            <button className="btn-primary teacher-sandbox-banner__btn" onClick={onGoLive}>
              Go Live &amp; Send to Students
            </button>
          </>
        ) : (
          <>
            {isScratch && (
              <button className="btn-primary teacher-sandbox-banner__btn" onClick={onPushScratch}>
                Push to All
              </button>
            )}
            <button className="btn-ghost teacher-sandbox-banner__btn" onClick={onReset}>
              Reset to Sandbox Starter
            </button>
            <button className="btn-danger teacher-sandbox-banner__btn" onClick={onDeactivate}>
              Deactivate Sandbox
            </button>
          </>
        )}
      </div>
    </div>
  )
}
