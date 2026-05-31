import { useMemo } from 'react'

const styles = {
  container: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
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
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.8125rem',
  },
  body: {
    padding: '18px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  sideLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1rem',
    fontWeight: 700,
  },
  pnl: {
    textAlign: 'right',
  },
  pnlValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
  },
  pnlPercent: {
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    marginTop: '2px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px',
  },
  gridItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  gridLabel: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  gridValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  healthBar: {
    height: '4px',
    borderRadius: '2px',
    background: 'var(--bg-elevated)',
    marginTop: '12px',
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.5s ease, background 0.5s ease',
  },
  healthLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
}

export default function PositionCard({ position, markPrice, fundingRate, onClose, onLiquidate, busy }) {
  const pnlData = useMemo(() => {
    if (!position || !position.isOpen) return null
    const { side, collateral, size, entryPrice } = position
    const col = Number(collateral) / 1e6
    const sz = Number(size) / 1e6
    const entry = Number(entryPrice)
    const mark = Number(markPrice)
    const funding = Number(fundingRate)

    if (!entry || !mark || !sz) return null

    const priceDelta = side === 'long' ? mark - entry : entry - mark
    const tradePnl = sz * priceDelta / entry
    const fundingPnl = sz * (Number(position.entryFundingRateBps || 0) - funding) / 10000
    const unrealizedPnl = tradePnl + fundingPnl
    const equity = col + unrealizedPnl
    const leverage = sz / col
    const maintenanceMargin = sz * 0.1
    const healthRatio = equity > 0 ? Math.min(1, (equity - maintenanceMargin) / (col - maintenanceMargin)) : 0
    const liqPrice = side === 'long'
      ? entry * (1 - (col - maintenanceMargin) / sz)
      : entry * (1 + (col - maintenanceMargin) / sz)
    const pnlPercent = col > 0 ? (unrealizedPnl / col) * 100 : 0

    return {
      unrealizedPnl,
      equity,
      leverage,
      liqPrice,
      pnlPercent,
      healthRatio: Math.max(0, Math.min(1, healthRatio)),
      col,
      sz,
      entry,
    }
  }, [position, markPrice, fundingRate])

  if (!position || !position.isOpen) {
    return (
      <div style={styles.container} id="position-card">
        <div style={styles.header}>
          <span style={styles.title}>Open Position</span>
        </div>
        <div style={styles.empty}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
          No open position. Use the trade panel to open a long or short.
        </div>
      </div>
    )
  }

  const isLong = position.side === 'long'
  const pnlColor = pnlData && pnlData.unrealizedPnl >= 0 ? 'var(--green-text)' : 'var(--red-text)'
  const healthColor = pnlData
    ? pnlData.healthRatio > 0.5 ? 'var(--green)' : pnlData.healthRatio > 0.2 ? 'var(--yellow)' : 'var(--red)'
    : 'var(--text-muted)'

  return (
    <div style={styles.container} id="position-card">
      <div style={styles.header}>
        <span style={styles.title}>Open Position</span>
        <span className={`badge ${isLong ? 'badge-green' : 'badge-red'}`}>
          {isLong ? '▲ LONG' : '▼ SHORT'}
        </span>
      </div>

      <div style={styles.body}>
        <div style={styles.topRow}>
          <div style={styles.sideLabel}>
            <span>SOL-PERP</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary-hover)', fontWeight: 600 }}>
              {pnlData ? `${pnlData.leverage.toFixed(1)}x` : ''}
            </span>
          </div>
          {pnlData && (
            <div style={styles.pnl}>
              <div style={{ ...styles.pnlValue, color: pnlColor }}>
                {pnlData.unrealizedPnl >= 0 ? '+' : ''}
                ${pnlData.unrealizedPnl.toFixed(2)}
              </div>
              <div style={{ ...styles.pnlPercent, color: pnlColor }}>
                {pnlData.pnlPercent >= 0 ? '+' : ''}
                {pnlData.pnlPercent.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {pnlData && (
          <>
            <div style={styles.grid}>
              <div style={styles.gridItem}>
                <span style={styles.gridLabel}>Entry Price</span>
                <span style={styles.gridValue}>${pnlData.entry.toFixed(2)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.gridLabel}>Mark Price</span>
                <span style={styles.gridValue}>${Number(markPrice).toFixed(2)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.gridLabel}>Collateral</span>
                <span style={styles.gridValue}>${pnlData.col.toFixed(2)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.gridLabel}>Size</span>
                <span style={styles.gridValue}>${pnlData.sz.toFixed(2)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.gridLabel}>Equity</span>
                <span style={{ ...styles.gridValue, color: pnlColor }}>${pnlData.equity.toFixed(2)}</span>
              </div>
              <div style={styles.gridItem}>
                <span style={styles.gridLabel}>Liq. Price</span>
                <span style={{ ...styles.gridValue, color: 'var(--red-text)' }}>${pnlData.liqPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Health bar */}
            <div style={styles.healthBar}>
              <div style={{ ...styles.healthFill, width: `${pnlData.healthRatio * 100}%`, background: healthColor }} />
            </div>
            <div style={styles.healthLabel}>
              <span>Account Health</span>
              <span style={{ color: healthColor }}>{(pnlData.healthRatio * 100).toFixed(0)}%</span>
            </div>
          </>
        )}

        <div style={styles.actions}>
          <button
            className="btn"
            disabled={busy}
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Close Position
          </button>
          <button
            className="btn btn-short"
            disabled={busy}
            onClick={onLiquidate}
            style={{ flex: 1 }}
          >
            Liquidate
          </button>
        </div>
      </div>
    </div>
  )
}
