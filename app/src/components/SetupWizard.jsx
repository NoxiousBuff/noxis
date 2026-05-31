import { useState } from 'react'

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    width: '480px',
    maxWidth: '90vw',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
    overflow: 'hidden',
  },
  header: {
    padding: '24px 28px 0',
  },
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  headerSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-tertiary)',
    lineHeight: 1.5,
  },
  body: {
    padding: '20px 28px',
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '14px 0',
    borderBottom: '1px solid var(--border)',
  },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0,
    marginTop: '2px',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  stepDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    lineHeight: 1.4,
  },
  footer: {
    padding: '16px 28px 24px',
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  progressBar: {
    height: '3px',
    background: 'var(--bg-elevated)',
    borderRadius: '2px',
    margin: '16px 0 8px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-primary), #8b5cf6)',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
}

const STEPS = [
  {
    title: 'Create Devnet USDC',
    desc: 'Creates an SPL mint and airdrops 1M test tokens to your wallet.',
    icon: '🪙',
  },
  {
    title: 'Initialize Market',
    desc: 'Deploys the SOL-PERP market with oracle price and risk parameters.',
    icon: '📈',
  },
  {
    title: 'Fund Insurance Vault',
    desc: 'Seeds the vault with 100K USDC for profit payouts and liquidations.',
    icon: '🏦',
  },
]

export default function SetupWizard({ show, onClose, onQuickStart, busy, completedSteps, onStep }) {
  if (!show) return null

  const progress = (completedSteps / STEPS.length) * 100
  const allDone = completedSteps >= STEPS.length

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()} id="setup-wizard">
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>🚀 Quick Setup</div>
          <div style={styles.headerSub}>
            Initialize the Noxis market on Solana Devnet in 3 steps.
          </div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
        </div>

        <div style={styles.body}>
          {STEPS.map((step, i) => {
            const done = i < completedSteps
            const active = i === completedSteps
            return (
              <div key={i} style={{ ...styles.step, borderBottom: i === STEPS.length - 1 ? 'none' : styles.step.borderBottom, opacity: done ? 0.5 : 1 }}>
                <div style={{
                  ...styles.stepNumber,
                  background: done ? 'var(--green-dim)' : active ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  color: done ? 'var(--green-text)' : active ? 'var(--accent-primary-hover)' : 'var(--text-muted)',
                  border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>
                    {step.icon} {step.title}
                  </div>
                  <div style={styles.stepDesc}>{step.desc}</div>
                </div>
                {active && !allDone && (
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() => onStep(i)}
                    style={{ alignSelf: 'center' }}
                  >
                    {busy ? 'Processing...' : 'Run'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={styles.footer}>
          {allDone ? (
            <button className="btn btn-primary" onClick={onClose}>
              🎉 Start Trading
            </button>
          ) : (
            <>
              <button className="btn" onClick={onClose}>Skip</button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={onQuickStart}
              >
                {busy ? '⏳ Running...' : '⚡ Quick Start All'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
