import { useRef, useEffect } from 'react'

const styles = {
  container: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--green)',
    animation: 'pulse 2s infinite',
  },
  body: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    lineHeight: '1.8',
    minHeight: '180px',
    maxHeight: '300px',
  },
  entry: {
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '2px',
    transition: 'background 0.15s ease',
  },
  time: {
    color: 'var(--text-muted)',
    marginRight: '8px',
  },
  empty: {
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '40px 20px',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
  },
}

export default function ActivityLog({ logs, onClear }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0
    }
  }, [logs.length])

  const getEntryColor = (msg) => {
    if (msg.includes('failed')) return 'var(--red-text)'
    if (msg.includes('connect wallet')) return 'var(--yellow)'
    return 'var(--green-text)'
  }

  const getEntryBg = (msg) => {
    if (msg.includes('failed')) return 'var(--red-dim)'
    return 'transparent'
  }

  return (
    <div style={styles.container} id="activity-log">
      <div style={styles.header}>
        <div style={styles.title}>
          <div style={styles.dot} />
          Activity Log
        </div>
        {logs.length > 0 && (
          <button
            className="btn btn-sm"
            onClick={onClear}
            style={{ padding: '4px 10px', fontSize: '0.6875rem' }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={styles.body} ref={bodyRef}>
        {logs.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📋</div>
            No activity yet. Connect your wallet and start trading.
          </div>
        ) : (
          logs.map((entry, i) => {
            const parts = entry.split(' ')
            const time = parts[0]
            const msg = parts.slice(1).join(' ')
            return (
              <div
                key={i}
                style={{
                  ...styles.entry,
                  color: getEntryColor(msg),
                  background: getEntryBg(msg),
                  animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
                }}
              >
                <span style={styles.time}>{time}</span>
                {msg}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
