import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(12, 16, 24, 0.8)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '16px',
    color: '#fff',
    boxShadow: '0 0 16px rgba(99, 102, 241, 0.3)',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.02em',
  },
  marketBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '100px',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  solDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #9945FF, #14F195)',
    boxShadow: '0 0 6px rgba(153, 69, 255, 0.4)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  devnetBadge: {
    padding: '4px 10px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'var(--yellow)',
    background: 'var(--yellow-dim)',
    borderRadius: '100px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}

export default function Header() {
  return (
    <header style={styles.header} id="noxis-header">
      <div style={styles.left}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>N</div>
          <span style={styles.logoText}>NOXIS</span>
        </div>
        <div style={styles.marketBadge}>
          <div style={styles.solDot} />
          SOL-PERP
        </div>
      </div>
      <div style={styles.right}>
        <span style={styles.devnetBadge}>⚡ Devnet</span>
        <WalletMultiButton />
      </div>
    </header>
  )
}
