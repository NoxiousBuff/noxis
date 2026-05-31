const styles = {
  strip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    padding: '0 24px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(12, 16, 24, 0.5)',
    overflowX: 'auto',
    minHeight: '48px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 24px',
    borderRight: '1px solid var(--border)',
    minWidth: 'fit-content',
  },
  statLabel: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    marginTop: '2px',
  },
  priceValue: {
    fontSize: '1.125rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    marginTop: '2px',
  },
  change: {
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    marginLeft: '8px',
  },
}

export default function MarketStats({ price, priceChange, openInterest, fundingRate }) {
  const isPositive = priceChange >= 0
  const changeColor = isPositive ? 'var(--green-text)' : 'var(--red-text)'
  const changePrefix = isPositive ? '+' : ''
  
  const formatOI = (val) => {
    if (!val) return '$0'
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
    return `$${val.toFixed(2)}`
  }

  return (
    <div style={styles.strip} id="market-stats">
      <div style={styles.stat}>
        <span style={styles.statLabel}>Mark Price</span>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ ...styles.priceValue, color: changeColor }}>
            ${Number(price).toFixed(2)}
          </span>
          <span style={{ ...styles.change, color: changeColor }}>
            {changePrefix}{priceChange.toFixed(2)}%
          </span>
        </div>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Open Interest</span>
        <span style={styles.statValue}>{formatOI(openInterest)}</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Funding Rate</span>
        <span style={{
          ...styles.statValue,
          color: fundingRate === 0 ? 'var(--text-secondary)' : fundingRate > 0 ? 'var(--green-text)' : 'var(--red-text)'
        }}>
          {fundingRate >= 0 ? '+' : ''}{(fundingRate / 100).toFixed(4)}%
        </span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statLabel}>Max Leverage</span>
        <span style={styles.statValue}>10x</span>
      </div>
      <div style={{ ...styles.stat, borderRight: 'none' }}>
        <span style={styles.statLabel}>Collateral</span>
        <span style={styles.statValue}>USDC</span>
      </div>
    </div>
  )
}
