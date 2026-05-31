import { useState, useMemo } from 'react'

const styles = {
  container: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    padding: '12px',
    textAlign: 'center',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent-primary)',
    background: 'var(--accent-subtle)',
  },
  body: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sideToggle: {
    display: 'flex',
    gap: '8px',
  },
  sideBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputWrap: {
    position: 'relative',
  },
  inputSuffix: {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  leverageBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  leverageSlider: {
    flex: 1,
    WebkitAppearance: 'none',
    appearance: 'none',
    height: '4px',
    borderRadius: '2px',
    background: 'var(--bg-elevated)',
    outline: 'none',
    cursor: 'pointer',
  },
  leverageValue: {
    minWidth: '42px',
    textAlign: 'right',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '0.9375rem',
    color: 'var(--accent-primary-hover)',
  },
  leveragePresets: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  presetBtn: {
    flex: 1,
    padding: '4px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-card)',
    color: 'var(--text-muted)',
    fontSize: '0.6875rem',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'center',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
  },
  infoValue: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
}

export default function TradePanel({
  busy,
  disabled,
  price,
  onDeposit,
  onWithdraw,
  onOpenPosition,
  depositAmount,
  setDepositAmount,
  collateral,
  setCollateral,
  withdrawAmount,
  setWithdrawAmount,
}) {
  const [tab, setTab] = useState('trade')
  const [side, setSide] = useState('long')
  const [leverage, setLeverage] = useState(5)

  // Size is computed: collateral × leverage
  const computedSize = useMemo(() => {
    const c = Number(collateral)
    if (!c || c <= 0) return 0
    return Math.floor(c * leverage)
  }, [collateral, leverage])

  const liqPrice = useMemo(() => {
    const c = Number(collateral)
    const s = computedSize
    const p = Number(price)
    if (!c || !s || !p || s === 0) return null
    const maintenanceMargin = s * 0.1 // 1000 bps
    if (side === 'long') {
      return p * (1 - (c - maintenanceMargin) / s)
    } else {
      return p * (1 + (c - maintenanceMargin) / s)
    }
  }, [collateral, computedSize, price, side])

  return (
    <div style={styles.container} id="trade-panel">
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'trade' ? styles.tabActive : {}) }}
          onClick={() => setTab('trade')}
        >
          Trade
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'deposit' ? styles.tabActive : {}) }}
          onClick={() => setTab('deposit')}
        >
          Deposit / Withdraw
        </button>
      </div>

      <div style={styles.body}>
        {tab === 'trade' ? (
          <>
            {/* Side Toggle */}
            <div style={styles.sideToggle}>
              <button
                style={{
                  ...styles.sideBtn,
                  ...(side === 'long'
                    ? {
                        background: 'rgba(34, 197, 94, 0.12)',
                        borderColor: 'rgba(34, 197, 94, 0.3)',
                        color: 'var(--green-text)',
                        boxShadow: '0 0 12px rgba(34, 197, 94, 0.1)',
                      }
                    : {}),
                }}
                onClick={() => setSide('long')}
              >
                ▲ Long
              </button>
              <button
                style={{
                  ...styles.sideBtn,
                  ...(side === 'short'
                    ? {
                        background: 'rgba(239, 68, 68, 0.12)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        color: 'var(--red-text)',
                        boxShadow: '0 0 12px rgba(239, 68, 68, 0.1)',
                      }
                    : {}),
                }}
                onClick={() => setSide('short')}
              >
                ▼ Short
              </button>
            </div>

            {/* Margin (Collateral) */}
            <div style={styles.inputGroup}>
              <label className="label">Margin (Collateral)</label>
              <div style={styles.inputWrap}>
                <input
                  className="input"
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  placeholder="100"
                  style={{ paddingRight: '50px' }}
                />
                <span style={styles.inputSuffix}>USDC</span>
              </div>
            </div>

            {/* Leverage slider */}
            <div style={styles.inputGroup}>
              <label className="label">Leverage</label>
              <div style={styles.leverageBar}>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  style={styles.leverageSlider}
                />
                <span style={{
                  ...styles.leverageValue,
                  color: leverage >= 8 ? 'var(--red-text)' : leverage >= 5 ? 'var(--yellow)' : 'var(--green-text)',
                }}>{leverage}x</span>
              </div>
              <div style={styles.leveragePresets}>
                {[1, 2, 3, 5, 7, 10].map((lev) => (
                  <button
                    key={lev}
                    style={{
                      ...styles.presetBtn,
                      ...(leverage === lev ? {
                        borderColor: 'var(--accent-primary)',
                        color: 'var(--accent-primary-hover)',
                        background: 'var(--accent-subtle)',
                      } : {}),
                    }}
                    onClick={() => setLeverage(lev)}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" />

            {/* Computed info rows */}
            <div style={styles.infoRow}>
              <span>Entry Price</span>
              <span style={styles.infoValue}>${Number(price).toFixed(2)}</span>
            </div>
            <div style={styles.infoRow}>
              <span>Position Size</span>
              <span style={styles.infoValue}>${computedSize.toLocaleString()} USDC</span>
            </div>
            <div style={styles.infoRow}>
              <span>Leverage</span>
              <span style={{
                ...styles.infoValue,
                color: leverage >= 8 ? 'var(--red-text)' : leverage >= 5 ? 'var(--yellow)' : 'var(--green-text)',
              }}>
                {leverage}x
              </span>
            </div>
            {liqPrice && liqPrice > 0 && (
              <div style={styles.infoRow}>
                <span>Est. Liquidation</span>
                <span style={{ ...styles.infoValue, color: 'var(--red-text)' }}>
                  ${liqPrice.toFixed(2)}
                </span>
              </div>
            )}

            {/* Submit */}
            <button
              className={`btn ${side === 'long' ? 'btn-long' : 'btn-short'}`}
              disabled={busy || disabled || computedSize === 0}
              onClick={() => onOpenPosition(side, computedSize)}
              style={{ width: '100%', padding: '14px', fontSize: '0.9375rem', fontWeight: 700, marginTop: '4px' }}
            >
              {busy
                ? '⏳ Processing...'
                : `${side === 'long' ? '▲ Long' : '▼ Short'} ${computedSize.toLocaleString()} USDC`}
            </button>
          </>
        ) : (
          <>
            {/* Deposit */}
            <div style={styles.inputGroup}>
              <label className="label">Deposit Amount</label>
              <div style={styles.inputWrap}>
                <input
                  className="input"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="1000"
                  style={{ paddingRight: '50px' }}
                />
                <span style={styles.inputSuffix}>USDC</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || disabled}
              onClick={onDeposit}
              style={{ width: '100%' }}
            >
              {busy ? '⏳ Processing...' : 'Deposit Collateral'}
            </button>

            <div className="divider" />

            {/* Withdraw */}
            <div style={styles.inputGroup}>
              <label className="label">Withdraw Amount</label>
              <div style={styles.inputWrap}>
                <input
                  className="input"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="500"
                  style={{ paddingRight: '50px' }}
                />
                <span style={styles.inputSuffix}>USDC</span>
              </div>
            </div>
            <button
              className="btn"
              disabled={busy || disabled}
              onClick={onWithdraw}
              style={{ width: '100%' }}
            >
              {busy ? '⏳ Processing...' : 'Withdraw'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
