import { useEffect, useRef, memo } from 'react'

const styles = {
  container: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '460px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 18px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  live: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#22c55e',
    animation: 'pulse 2s infinite',
  },
  chartWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
}

function PriceChart() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous
    container.innerHTML = ''

    // Create widget container structure
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    widgetDiv.style.width = '100%'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'PYTH:SOLUSD',
      interval: '5',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(12, 16, 24, 1)',
      gridColor: 'rgba(148, 163, 184, 0.04)',
      hide_top_toolbar: false,
      hide_legend: true,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [])

  return (
    <div style={styles.container} id="price-chart">
      <div style={styles.header}>
        <div style={styles.title}>
          <div style={styles.live} />
          SOL / USD · Pyth Oracle
        </div>
        <span style={{
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>LIVE</span>
      </div>
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={styles.chartWrap}
      />
    </div>
  )
}

export default memo(PriceChart)
