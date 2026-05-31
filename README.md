# Noxis

Noxis is an isolated-margin SOL-PERP risk engine on Solana.

It is intentionally narrow: one market, one collateral mint, real SPL token custody, clean margin math, and liquidation.

## Features

- Anchor program
- SPL collateral vault owned by a PDA
- trader margin accounts
- deposit and withdraw collateral
- vault funding for profit payouts / insurance liquidity
- open isolated long/short positions
- 1x to 10x leverage checks
- mock oracle mark price updates
- funding rate input
- unrealized PnL
- maintenance margin liquidation
- liquidator reward paid from vault
- events for deposits, withdrawals, price updates, opens, closes, liquidations

## Accounts

- `Market`: authority, collateral mint, token vault, oracle, open interest, risk params
- `Oracle`: mock SOL/USD price controlled by market authority
- `MarginAccount`: free and locked collateral for each trader
- `Position`: isolated perp position, one per trader
- `Vault`: SPL token account controlled by the market PDA

## Instructions

- `initialize_market`
- `update_price`
- `set_funding_rate`
- `deposit`
- `fund_vault`
- `withdraw`
- `open_position`
- `close_position`
- `liquidate`

## Risk Model

```text
pnl = size * price_delta / entry_price
equity = collateral + pnl
maintenance_margin = size * maintenance_margin_bps / 10_000
liquidatable = equity <= maintenance_margin
```

Longs profit when mark price rises. Shorts profit when mark price falls.

## Build

```bash
anchor build
cargo test
```

## Demo Flow

1. Create a devnet USDC-style SPL mint.
2. Initialize Noxis market with SOL price `100`.
3. Mint demo collateral to trader token account.
4. Fund the vault with demo insurance liquidity.
5. Deposit trader collateral into the Noxis vault.
6. Open a 5x SOL long or short.
7. Move oracle price.
8. Close if healthy, or liquidate if equity falls below maintenance margin.

## Production Notes

This is a capstone-grade risk engine, not a full exchange. The hard part implemented here is custody plus margin accounting plus liquidation.

Next production steps:

- replace mock oracle with Pyth SOL/USD
- allow multiple markets
- add keeper bot
- add web trading UI
