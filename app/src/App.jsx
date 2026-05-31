import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { AnchorProvider, BN, Program, setProvider } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from '@solana/spl-token'

import idl from './idl/noxis.json'

import Header from './components/Header.jsx'
import MarketStats from './components/MarketStats.jsx'
import PriceChart from './components/PriceChart.jsx'
import TradePanel from './components/TradePanel.jsx'
import PositionCard from './components/PositionCard.jsx'
import ActivityLog from './components/ActivityLog.jsx'
import SetupWizard from './components/SetupWizard.jsx'

const PROGRAM_ID = new PublicKey('BsVqNDYvD7SBscQUKiLXqMNiYDNro3C1Gu5m6p2Emsqw')
const USDC_DECIMALS = 6
const PYTH_SOL_USD_FEED = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_SOL_USD_FEED}`

function pda(seed, extra = []) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed), ...extra],
    PROGRAM_ID,
  )[0]
}

function toBaseUnits(value) {
  return new BN(Math.floor(Number(value) * 10 ** USDC_DECIMALS))
}

// ─── Layout styles ────────────────────────────────

const layoutStyles = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gridTemplateRows: 'auto 1fr',
    gap: '16px',
    padding: '16px 24px 24px',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minWidth: 0,
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  setupBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: 'var(--accent-subtle)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: 'var(--radius-md)',
    gridColumn: '1 / -1',
  },
  bannerText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  footerLinks: {
    display: 'flex',
    gap: '16px',
  },
  footerLink: {
    color: 'var(--text-tertiary)',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
}

// ─── Landing page (pre-connect) ────────────────────

const heroStyles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
    minHeight: 'calc(100vh - 140px)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'var(--accent-subtle)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--accent-primary-hover)',
    marginBottom: '24px',
    letterSpacing: '0.03em',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: '16px',
    letterSpacing: '-0.03em',
    maxWidth: '640px',
  },
  gradient: {
    background: 'linear-gradient(135deg, #f1f5f9 0%, #6366f1 50%, #22c55e 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: 'var(--text-tertiary)',
    lineHeight: 1.6,
    maxWidth: '520px',
    marginBottom: '36px',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    maxWidth: '720px',
    width: '100%',
    marginTop: '48px',
  },
  featureCard: {
    padding: '20px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },
  featureIcon: {
    fontSize: '1.5rem',
    marginBottom: '10px',
  },
  featureTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  featureDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
}

function LandingHero() {
  return (
    <div style={heroStyles.container}>
      <div style={heroStyles.badge}>
        ◆ Built on Solana · Powered by Pyth
      </div>
      <h1 style={heroStyles.title}>
        <span style={heroStyles.gradient}>
          Trade SOL Perpetuals
        </span>
        <br />
        On-Chain
      </h1>
      <p style={heroStyles.subtitle}>
        Noxis is a decentralized perpetual futures exchange on Solana.
        Trade SOL-PERP with up to 10x leverage — with real token custody,
        isolated margin, and automated liquidation. All on-chain.
      </p>
      <WalletMultiButton />

      <div style={heroStyles.features}>
        <div style={heroStyles.featureCard}>
          <div style={heroStyles.featureIcon}>🔐</div>
          <div style={heroStyles.featureTitle}>On-Chain Custody</div>
          <div style={heroStyles.featureDesc}>
            Your collateral is held in a PDA-controlled vault. No centralized risk.
          </div>
        </div>
        <div style={heroStyles.featureCard}>
          <div style={heroStyles.featureIcon}>📊</div>
          <div style={heroStyles.featureTitle}>Isolated Margin</div>
          <div style={heroStyles.featureDesc}>
            Each position has its own margin. Losses are capped at your collateral.
          </div>
        </div>
        <div style={heroStyles.featureCard}>
          <div style={heroStyles.featureIcon}>⚡</div>
          <div style={heroStyles.featureTitle}>Liquidation Engine</div>
          <div style={heroStyles.featureDesc}>
            Anyone can liquidate unhealthy positions and earn keeper rewards.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ────────────────────────────────────

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()

  // Core state
  const [mint, setMint] = useState(null)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [withdrawAmount, setWithdrawAmount] = useState('500')
  const [collateral, setCollateral] = useState('100')
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)

  // UI state
  const [showSetup, setShowSetup] = useState(false)
  const [setupSteps, setSetupSteps] = useState(0)
  const [position, setPosition] = useState(null)
  const [marketData, setMarketData] = useState({
    openInterest: 0,
    fundingRate: 0,
  })
  const [marketExists, setMarketExists] = useState(false)

  // Pyth live price
  const [solPrice, setSolPrice] = useState(0)
  const [prevPrice, setPrevPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)
  const initialPriceRef = useRef(0)

  // Fetch SOL/USD price from Pyth Hermes
  useEffect(() => {
    let active = true

    const fetchPrice = async () => {
      try {
        const res = await fetch(PYTH_HERMES_URL)
        const data = await res.json()
        if (!active || !data.parsed || !data.parsed[0]) return

        const priceData = data.parsed[0].price
        const rawPrice = Number(priceData.price)
        const expo = Number(priceData.expo)
        const realPrice = rawPrice * Math.pow(10, expo)

        setSolPrice((prev) => {
          setPrevPrice(prev)
          return realPrice
        })

        if (initialPriceRef.current === 0) {
          initialPriceRef.current = realPrice
        }
        setPriceChange(
          ((realPrice - initialPriceRef.current) / initialPriceRef.current) * 100,
        )
      } catch (err) {
        console.warn('Pyth price fetch failed:', err)
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // Show setup wizard on first wallet connect
  useEffect(() => {
    if (wallet.publicKey && !mint && setupSteps === 0 && !marketExists) {
      setShowSetup(true)
    }
  }, [wallet.publicKey, mint, setupSteps, marketExists])

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null
    const p = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    setProvider(p)
    return p
  }, [connection, wallet])

  const program = useMemo(() => {
    if (!provider) return null
    return new Program(idl, provider)
  }, [provider])

  const accounts = useMemo(() => {
    if (!wallet.publicKey || !mint) return null
    return {
      market: pda('market'),
      oracle: pda('oracle'),
      vault: pda('vault'),
      margin: pda('margin', [wallet.publicKey.toBuffer()]),
      position: pda('position', [wallet.publicKey.toBuffer()]),
      userToken: getAssociatedTokenAddressSync(mint, wallet.publicKey),
    }
  }, [wallet.publicKey, mint])

  // Check if market already exists on-chain & fetch state
  useEffect(() => {
    if (!program || !wallet.publicKey) return
    let active = true

    const fetchState = async () => {
      try {
        const marketPda = pda('market')
        const market = await program.account.market.fetch(marketPda)

        if (active) {
          setMarketExists(true)
          setMint(market.collateralMint)
          setSetupSteps(3) // All setup already done
          setMarketData({
            openInterest: Number(market.openInterest) / 1e6,
            fundingRate: Number(market.fundingRateBps),
          })
        }
      } catch {
        // Market not initialized yet — that's fine
        if (active) setMarketExists(false)
      }

      // Fetch position if we have a mint
      if (mint) {
        try {
          const posPda = pda('position', [wallet.publicKey.toBuffer()])
          const pos = await program.account.position.fetch(posPda)
          if (active && pos.isOpen) {
            setPosition({
              isOpen: true,
              side: pos.side.long ? 'long' : 'short',
              collateral: Number(pos.collateral),
              size: Number(pos.size),
              entryPrice: Number(pos.entryPrice),
              entryFundingRateBps: Number(pos.entryFundingRateBps),
            })
          } else if (active) {
            setPosition(null)
          }
        } catch {
          if (active) setPosition(null)
        }
      }
    }

    fetchState()
    const interval = setInterval(fetchState, 8000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [program, wallet.publicKey, mint])

  function log(message) {
    setLogs((items) => [
      `${new Date().toLocaleTimeString()} ${message}`,
      ...items,
    ])
  }

  async function run(label, fn) {
    if (!wallet.publicKey || !wallet.signTransaction) {
      log('connect wallet first')
      return
    }
    setBusy(true)
    try {
      const sig = await fn()
      log(`${label}: ${sig}`)
    } catch (err) {
      log(`${label} failed: ${err.message}`)
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  // ─── Blockchain actions ──────────────────────

  const createFakeUsdc = useCallback(async () => {
    await run('create fake USDC', async () => {
      const mintKeypair = Keypair.generate()
      const rent = await getMinimumBalanceForRentExemptMint(connection)
      const ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, wallet.publicKey)
      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports: rent,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mintKeypair.publicKey, USDC_DECIMALS, wallet.publicKey, wallet.publicKey),
        createAssociatedTokenAccountInstruction(wallet.publicKey, ata, wallet.publicKey, mintKeypair.publicKey),
        createMintToInstruction(mintKeypair.publicKey, ata, wallet.publicKey, 1_000_000 * 10 ** USDC_DECIMALS),
      )
      tx.feePayer = wallet.publicKey
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.partialSign(mintKeypair)
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setMint(mintKeypair.publicKey)
      return sig
    })
  }, [connection, wallet])

  const initializeMarket = useCallback(async () => {
    const currentPrice = Math.round(solPrice) || 82
    await run('initialize market', async () => {
      return program.methods
        .initializeMarket(new BN(currentPrice), 1000, 500)
        .accounts({
          authority: wallet.publicKey,
          collateralMint: mint,
          market: accounts.market,
          oracle: accounts.oracle,
          vault: accounts.vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    })
  }, [program, wallet, mint, accounts, solPrice])

  const fundVault = useCallback(async () => {
    await run('fund vault', async () => {
      return program.methods
        .fundVault(toBaseUnits(100_000))
        .accounts({
          funder: wallet.publicKey,
          market: accounts.market,
          funderToken: accounts.userToken,
          vault: accounts.vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    })
  }, [program, wallet, accounts])

  const deposit = useCallback(async () => {
    await run('deposit', async () => {
      return program.methods
        .deposit(toBaseUnits(depositAmount))
        .accounts({
          trader: wallet.publicKey,
          market: accounts.market,
          margin: accounts.margin,
          traderToken: accounts.userToken,
          vault: accounts.vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    })
  }, [program, wallet, accounts, depositAmount])

  const withdraw = useCallback(async () => {
    await run('withdraw', async () => {
      return program.methods
        .withdraw(toBaseUnits(withdrawAmount))
        .accounts({
          trader: wallet.publicKey,
          market: accounts.market,
          margin: accounts.margin,
          traderToken: accounts.userToken,
          vault: accounts.vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    })
  }, [program, wallet, accounts, withdrawAmount])

  const openPosition = useCallback(
  async (side, computedSize) => {
    const oraclePrice = Math.round(solPrice) || 82

    await run(`open ${side}`, async () => {
      await program.methods
        .updatePrice(new BN(oraclePrice))
        .accounts({
          authority: wallet.publicKey,
          oracle: accounts.oracle,
        })
        .rpc()

      const sig = await program.methods
        .openPosition(
          { [side]: {} },
          toBaseUnits(collateral),
          toBaseUnits(computedSize),
        )
        .accounts({
          trader: wallet.publicKey,
          market: accounts.market,
          oracle: accounts.oracle,
          margin: accounts.margin,
          position: accounts.position,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      const pos = await program.account.position.fetch(
        accounts.position
      )

      setPosition({
        isOpen: true,
        side: pos.side.long ? 'long' : 'short',
        collateral: Number(pos.collateral),
        size: Number(pos.size),
        entryPrice: Number(pos.entryPrice),
        entryFundingRateBps: Number(pos.entryFundingRateBps),
      })

      return sig
    })
  },
  [program, wallet, accounts, collateral, solPrice],
)

  const closePosition = useCallback(async () => {
  const oraclePrice = Math.round(solPrice) || 82

  await run('close position', async () => {
    await program.methods
      .updatePrice(new BN(oraclePrice))
      .accounts({
        authority: wallet.publicKey,
        oracle: accounts.oracle,
      })
      .rpc()

    const sig = await program.methods
      .closePosition()
      .accounts({
        trader: wallet.publicKey,
        market: accounts.market,
        oracle: accounts.oracle,
        margin: accounts.margin,
        position: accounts.position,
        traderToken: accounts.userToken,
        vault: accounts.vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc()

    setPosition(null)

    return sig
  })
}, [program, wallet, accounts, solPrice])

  const liquidate = useCallback(async () => {
    await run('liquidate', async () => {
      return program.methods
        .liquidate()
        .accounts({
          liquidator: wallet.publicKey,
          market: accounts.market,
          oracle: accounts.oracle,
          margin: accounts.margin,
          position: accounts.position,
          ownerToken: accounts.userToken,
          liquidatorToken: accounts.userToken,
          vault: accounts.vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    })
  }, [program, wallet, accounts])

  // ─── Quick Start (handles existing market) ────

  const quickStart = useCallback(async () => {
    setBusy(true)
    try {
      const newProgram = new Program(
        idl,
        new AnchorProvider(connection, wallet, { commitment: 'confirmed' }),
      )
      const marketPda = pda('market')
      const oraclePrice = Math.round(solPrice) || 82

      // Check if market already exists
      let existingMint = null
      try {
        const existing = await newProgram.account.market.fetch(marketPda)
        existingMint = existing.collateralMint
        log('market already initialized — using existing mint')
        setSetupSteps(2) // Skip steps 1 & 2
      } catch {
        // Market doesn't exist, proceed with full setup
      }

      if (existingMint) {
        // Market exists — just need to fund vault if needed
        setMint(existingMint)
        const userToken = getAssociatedTokenAddressSync(existingMint, wallet.publicKey)

        // Check if user has a token account for this mint
        try {
          await connection.getTokenAccountBalance(userToken)
        } catch {
          log('you need test tokens for this mint — create a new market with a fresh wallet')
          setBusy(false)
          setSetupSteps(3)
          return
        }

        try {
          const sig = await newProgram.methods
            .fundVault(toBaseUnits(100_000))
            .accounts({
              funder: wallet.publicKey,
              market: marketPda,
              funderToken: userToken,
              vault: pda('vault'),
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
          log(`fund vault: ${sig}`)
        } catch (err) {
          log(`fund vault skipped: ${err.message?.includes('0x1') ? 'insufficient tokens' : err.message}`)
        }
        setSetupSteps(3)
      } else {
        // Full fresh setup
        // Step 1: Create USDC
        const mintKeypair = Keypair.generate()
        const rent = await getMinimumBalanceForRentExemptMint(connection)
        const ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, wallet.publicKey)
        const tx1 = new Transaction().add(
          SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports: rent,
            programId: TOKEN_PROGRAM_ID,
          }),
          createInitializeMint2Instruction(mintKeypair.publicKey, USDC_DECIMALS, wallet.publicKey, wallet.publicKey),
          createAssociatedTokenAccountInstruction(wallet.publicKey, ata, wallet.publicKey, mintKeypair.publicKey),
          createMintToInstruction(mintKeypair.publicKey, ata, wallet.publicKey, 1_000_000 * 10 ** USDC_DECIMALS),
        )
        tx1.feePayer = wallet.publicKey
        tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        tx1.partialSign(mintKeypair)
        const signed1 = await wallet.signTransaction(tx1)
        const sig1 = await connection.sendRawTransaction(signed1.serialize())
        await connection.confirmTransaction(sig1, 'confirmed')
        setMint(mintKeypair.publicKey)
        log(`create fake USDC: ${sig1}`)
        setSetupSteps(1)

        const newAccounts = {
          market: marketPda,
          oracle: pda('oracle'),
          vault: pda('vault'),
          userToken: ata,
        }

        // Step 2: Initialize market with live Pyth price
        const sig2 = await newProgram.methods
          .initializeMarket(new BN(oraclePrice), 1000, 500)
          .accounts({
            authority: wallet.publicKey,
            collateralMint: mintKeypair.publicKey,
            market: newAccounts.market,
            oracle: newAccounts.oracle,
            vault: newAccounts.vault,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        log(`initialize market @ $${oraclePrice}: ${sig2}`)
        setSetupSteps(2)

        // Step 3: Fund vault
        const sig3 = await newProgram.methods
          .fundVault(toBaseUnits(100_000))
          .accounts({
            funder: wallet.publicKey,
            market: newAccounts.market,
            funderToken: newAccounts.userToken,
            vault: newAccounts.vault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()
        log(`fund vault: ${sig3}`)
        setSetupSteps(3)
      }
    } catch (err) {
      log(`quick start failed: ${err.message}`)
      console.error(err)
    } finally {
      setBusy(false)
    }
  }, [connection, wallet, solPrice])

  const handleSetupStep = useCallback(
    async (step) => {
      if (step === 0) {
        await createFakeUsdc()
        setSetupSteps(1)
      } else if (step === 1) {
        await initializeMarket()
        setSetupSteps(2)
      } else if (step === 2) {
        await fundVault()
        setSetupSteps(3)
      }
    },
    [createFakeUsdc, initializeMarket, fundVault],
  )

  // ─── Render ────────────────────────────────────

  // If wallet not connected, show landing page
  if (!wallet.publicKey) {
    return (
      <div style={layoutStyles.app}>
        <Header />
        <LandingHero />
        <footer style={layoutStyles.footer}>
          <span>Noxis · Decentralized Perpetual Futures on Solana</span>
          <div style={layoutStyles.footerLinks}>
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              style={layoutStyles.footerLink}
            >
              Solana Explorer
            </a>
            <span>Devnet</span>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div style={layoutStyles.app}>
      <Header />
      <MarketStats
        price={solPrice}
        priceChange={priceChange}
        openInterest={marketData.openInterest}
        fundingRate={marketData.fundingRate}
      />

      <div style={layoutStyles.main}>
        {/* Setup banner */}
        {!mint && !marketExists && (
          <div style={layoutStyles.setupBanner}>
            <span style={layoutStyles.bannerText}>
              🚀 Market not initialized. Set up your devnet environment to start trading.
            </span>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowSetup(true)}
            >
              Quick Setup
            </button>
          </div>
        )}

        {/* Left column: Chart + Position + Log */}
        <div style={layoutStyles.leftColumn}>
          <PriceChart />
          <PositionCard
            position={position}
            markPrice={solPrice}
            fundingRate={marketData.fundingRate}
            onClose={closePosition}
            onLiquidate={liquidate}
            busy={busy}
          />
          <ActivityLog logs={logs} onClear={() => setLogs([])} />
        </div>

        {/* Right column: Trade panel */}
        <div style={layoutStyles.rightColumn}>
          <TradePanel
            busy={busy}
            disabled={!mint}
            price={solPrice}
            onDeposit={deposit}
            onWithdraw={withdraw}
            onOpenPosition={openPosition}
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            collateral={collateral}
            setCollateral={setCollateral}
            withdrawAmount={withdrawAmount}
            setWithdrawAmount={setWithdrawAmount}
          />

          {/* Oracle Price Override */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
          }}>
            <label className="label">Oracle Price Override</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <input
                className="input"
                type="number"
                defaultValue={Math.round(solPrice) || ''}
                placeholder={String(Math.round(solPrice) || '82')}
                id="oracle-price-input"
              />
              <button
                className="btn btn-sm"
                disabled={busy || !mint}
                onClick={async () => {
                  const val = document.getElementById('oracle-price-input').value
                  const p = Number(val) || Math.round(solPrice)
                  await run('update price', async () => {
                    return program.methods
                      .updatePrice(new BN(p))
                      .accounts({
                        authority: wallet.publicKey,
                        oracle: accounts.oracle,
                      })
                      .rpc()
                  })
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                Set
              </button>
            </div>
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              marginTop: '8px',
              lineHeight: 1.4,
            }}>
              Override mock oracle price on-chain. Useful for testing liquidation or PnL scenarios.
            </div>
          </div>

          {/* Account info */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            fontSize: '0.75rem',
          }}>
            <label className="label" style={{ marginBottom: '10px' }}>Account Info</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Wallet</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {wallet.publicKey.toBase58().slice(0, 4)}...{wallet.publicKey.toBase58().slice(-4)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Program</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {PROGRAM_ID.toBase58().slice(0, 4)}...{PROGRAM_ID.toBase58().slice(-4)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mint</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: mint ? 'var(--green-text)' : 'var(--text-muted)',
                }}>
                  {mint ? `${mint.toBase58().slice(0, 4)}...${mint.toBase58().slice(-4)}` : 'not created'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>SOL Price</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: solPrice > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  {solPrice > 0 ? `$${solPrice.toFixed(2)} (Pyth)` : 'loading...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={layoutStyles.footer}>
        <span>Noxis · Decentralized Perpetual Futures on Solana</span>
        <div style={layoutStyles.footerLinks}>
          <a
            href="https://explorer.solana.com/?cluster=devnet"
            target="_blank"
            rel="noopener noreferrer"
            style={layoutStyles.footerLink}
          >
            Solana Explorer
          </a>
          <span>Devnet</span>
        </div>
      </footer>

      {/* Setup Wizard Modal */}
      <SetupWizard
        show={showSetup}
        onClose={() => setShowSetup(false)}
        onQuickStart={quickStart}
        busy={busy}
        completedSteps={setupSteps}
        onStep={handleSetupStep}
      />
    </div>
  )
}
