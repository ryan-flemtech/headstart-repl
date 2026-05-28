import React from 'react'

export default function LoadingScreen({ message }) {
  return (
    <div className="sv-centre-screen">
      <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)' }}>{message}</p>
    </div>
  )
}
