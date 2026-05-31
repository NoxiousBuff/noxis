import { useMemo, useState } from 'react'
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
import './App.css'

const PROGRAM_ID = new PublicKey('BsVqNDYvD7SBscQUKiLXqMNiYDNro3C1Gu5m6p2Emsqw')
const USDC_DECIMALS = 6

function pda(seed, extra = []) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(seed), ...extra],
    PROGRAM_ID,
  )[0]
}

function toBaseUnits(value) {
  return new BN(Math.floor(Number(value) * 10 ** USDC_DECIMALS))
}

function shortKey(key) {
  if (!key) return ''
  const text = key.toBase58()
  return `${text.slice(0, 4)}...${text.slice(-4)}`
}

export default function App() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [mint, setMint] = useState(null)
  const [price, setPrice] = useState('100')
  const [depositAmount, setDepositAmount] = useState('1000')
  const [collateral, setCollateral] = useState('100')
  const [size, setSize] = useState('500')
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)

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

  function log(message) {
    setLogs((items) => [`${new Date().toLocaleTimeString()} ${message}`, ...items])
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

  async function createFakeUsdc() {
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
        createInitializeMint2Instruction(
          mintKeypair.publicKey,
          USDC_DECIMALS,
          wallet.publicKey,
          wallet.publicKey,
        ),
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ata,
          wallet.publicKey,
          mintKeypair.publicKey,
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          ata,
          wallet.publicKey,
          1_000_000 * 10 ** USDC_DECIMALS,
        ),
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
  }

  async function initializeMarket() {
    await run('initialize market', async () => {
      return program.methods
        .initializeMarket(new BN(price), 1000, 500)
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
  }

  async function updatePrice() {
    await run('update price', async () => {
      return program.methods
        .updatePrice(new BN(price))
        .accounts({
          authority: wallet.publicKey,
          oracle: accounts.oracle,
        })
        .rpc()
    })
  }

  async function fundVault() {
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
  }

  async function deposit() {
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
  }

  async function openPosition(side) {
    await run(`open ${side}`, async () => {
      return program.methods
        .openPosition({ [side]: {} }, toBaseUnits(collateral), toBaseUnits(size))
        .accounts({
          trader: wallet.publicKey,
          market: accounts.market,
          oracle: accounts.oracle,
          margin: accounts.margin,
          position: accounts.position,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    })
  }

  async function closePosition() {
    await run('close position', async () => {
      return program.methods
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
    })
  }

  async function liquidate() {
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
  }

  return (
    <main>
      <header>
        <h1>Noxis Devnet</h1>
        <WalletMultiButton />
      </header>

      <section>
        <p>Wallet: {wallet.publicKey ? shortKey(wallet.publicKey) : 'not connected'}</p>
        <p>Program: {PROGRAM_ID.toBase58()}</p>
        <p>Fake USDC mint: {mint ? mint.toBase58() : 'not created'}</p>
      </section>

      <section>
        <h2>Setup</h2>
        <button disabled={busy || !wallet.publicKey} onClick={createFakeUsdc}>1. Create Fake USDC + Mint 1M</button>
        <input value={price} onChange={(e) => setPrice(e.target.value)} />
        <button disabled={busy || !mint} onClick={initializeMarket}>2. Initialize Market</button>
        <button disabled={busy || !mint} onClick={fundVault}>3. Fund Vault 100k</button>
      </section>

      <section>
        <h2>Trade</h2>
        <label>Deposit</label>
        <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
        <button disabled={busy || !mint} onClick={deposit}>Deposit</button>

        <label>Collateral</label>
        <input value={collateral} onChange={(e) => setCollateral(e.target.value)} />
        <label>Size</label>
        <input value={size} onChange={(e) => setSize(e.target.value)} />
        <button disabled={busy || !mint} onClick={() => openPosition('long')}>Open Long</button>
        <button disabled={busy || !mint} onClick={() => openPosition('short')}>Open Short</button>
      </section>

      <section>
        <h2>Manage</h2>
        <label>Oracle Price</label>
        <input value={price} onChange={(e) => setPrice(e.target.value)} />
        <button disabled={busy || !mint} onClick={updatePrice}>Update Price</button>
        <button disabled={busy || !mint} onClick={closePosition}>Close</button>
        <button disabled={busy || !mint} onClick={liquidate}>Liquidate</button>
      </section>

      <section>
        <h2>Logs</h2>
        <pre>{logs.join('\n')}</pre>
      </section>
    </main>
  )
}
