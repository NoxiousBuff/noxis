# Noxis

**On-chain isolated-margin SOL-PERP risk engine on Solana.**

> Trade perpetual futures with up to 10x leverage, real SPL token custody, maintenance margin enforcement, and automated liquidation — all on-chain.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                  React Trading UI                     │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │ PriceChart│ │TradePanel│ │  PositionCard       │   │
│  │ (Chart.js)│ │Long/Short│ │  PnL · Health · Liq│   │
│  └──────────┘ └──────────┘ └────────────────────┘   │
│           ↕ Anchor RPC via @coral-xyz/anchor          │
├──────────────────────────────────────────────────────┤
│              Solana Program (Anchor)                  │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Market │  │ Oracle │  │  Margin   │  │Position │ │
│  │ (PDA)  │  │ (PDA)  │  │  Account  │  │ (PDA)  │ │
│  └────────┘  └────────┘  └──────────┘  └─────────┘ │
│                        ↕                              │
│  ┌──────────────────────────────────────────────┐    │
│  │        SPL Token Vault (PDA-owned)            │    │
│  │        Real custody of collateral             │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

## ✨ Features

### On-chain Program
- **Anchor program** — Clean Rust code, full account validation, no unsafe math
- **SPL token custody** — Real collateral held in a PDA-owned token vault
- **Margin accounts** — Per-trader free + locked collateral tracking
- **Isolated perpetual positions** — Long or short with 1x–10x leverage
- **Mock oracle** — Market authority can update SOL/USD mark price
- **Funding rate** — Configurable funding rate that affects position equity
- **Maintenance margin liquidation** — Positions below margin threshold can be liquidated by anyone
- **Liquidator rewards** — Incentive fee paid from vault to liquidators
- **On-chain events** — Emitted for every action (deposits, trades, liquidations, etc.)

### Trading UI
- **Professional dark terminal** — Inspired by dYdX / Hyperliquid
- **Live price chart** — Animated Chart.js line chart with gradient fill
- **Trade panel** — Long/Short toggle, collateral & size inputs, leverage slider
- **Position card** — Live unrealized PnL, equity, leverage, liquidation price, health bar
- **Setup wizard** — One-click "Quick Start" to initialize devnet market
- **Activity log** — Color-coded transaction log with success/error states
- **Glassmorphism design** — Premium dark UI with animated gradients, micro-animations

## 📐 Risk Model

```
pnl        = size × price_delta / entry_price
equity     = collateral + pnl
maint_margin = size × maintenance_margin_bps / 10,000
liquidatable = equity ≤ maint_margin
```

- **Longs** profit when mark price rises
- **Shorts** profit when mark price falls
- **Funding** is applied as: `funding_pnl = size × (entry_funding - current_funding) / 10,000`

## 🗂️ Project Structure

```
noxis/
├── programs/noxis/src/
│   └── lib.rs               # Anchor program (all instructions + accounts)
├── app/
│   ├── src/
│   │   ├── App.jsx           # Main orchestrator with all blockchain logic
│   │   ├── main.jsx          # React entry with wallet providers
│   │   ├── index.css         # Full design system
│   │   ├── idl/noxis.json    # Auto-generated IDL
│   │   └── components/
│   │       ├── Header.jsx        # Logo + wallet + devnet badge
│   │       ├── MarketStats.jsx   # Price, OI, funding rate strip
│   │       ├── PriceChart.jsx    # Live simulated Chart.js chart
│   │       ├── TradePanel.jsx    # Deposit/withdraw + trade form
│   │       ├── PositionCard.jsx  # Live position with PnL + health
│   │       ├── ActivityLog.jsx   # Styled transaction log
│   │       └── SetupWizard.jsx   # 3-step devnet onboarding modal
│   └── package.json
├── Anchor.toml
└── Cargo.toml
```

## 🚀 Quick Start

### Prerequisites
- Rust + Solana CLI + Anchor CLI
- Node.js ≥ 16
- Phantom wallet (set to devnet)

### Build & Deploy Program

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Run Trading UI

```bash
cd app
npm install
npm run dev
```

Then:
1. Open `[https://noxis-b667.vercel.app/]`
2. Connect Phantom (devnet)
3. Click **Quick Setup** → auto-creates USDC mint, initializes market, funds vault
4. Deposit collateral → Open a 5x long or short
5. Watch PnL update as the simulated price moves
6. Close or get liquidated!

## 📋 On-chain Instructions

| Instruction | Description |
|---|---|
| `initialize_market` | Create market + oracle + vault PDAs |
| `update_price` | Set mock oracle SOL/USD price |
| `set_funding_rate` | Configure funding rate (±500 bps max) |
| `deposit` | Transfer SPL tokens into margin account |
| `fund_vault` | Add insurance liquidity to vault |
| `withdraw` | Pull free collateral back to wallet |
| `open_position` | Open isolated long/short (1–10x leverage) |
| `close_position` | Settle position, return equity to trader |
| `liquidate` | Liquidate unhealthy position, claim reward |

## 🛡️ Security Considerations

- All account validation via Anchor constraints
- Checked arithmetic (no overflow/underflow)
- PDA-based authority — no admin keys hold funds
- Leverage capped at 10x on-chain
- Funding rate capped at ±500 bps

## 📝 Production Roadmap

- [ ] Replace mock oracle with Pyth SOL/USD price feed
- [ ] Support multiple trading pairs
- [ ] Add keeper bot for automated liquidations
- [ ] Orderbook or vAMM for price discovery
- [ ] Cross-margin mode
- [ ] Insurance fund mechanics

---

**Built with [Anchor](https://www.anchor-lang.com/) · [Solana](https://solana.com/) · [React](https://react.dev/) · [Chart.js](https://www.chartjs.org/)**
