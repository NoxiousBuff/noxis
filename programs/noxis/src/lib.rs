use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("BsVqNDYvD7SBscQUKiLXqMNiYDNro3C1Gu5m6p2Emsqw");

const BPS: i64 = 10_000;
const MARKET_SEED: &[u8] = b"market";
const ORACLE_SEED: &[u8] = b"oracle";
const VAULT_SEED: &[u8] = b"vault";
const MARGIN_SEED: &[u8] = b"margin";
const POSITION_SEED: &[u8] = b"position";

#[program]
pub mod noxis {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        price: i64,
        maintenance_margin_bps: u16,
        liquidation_fee_bps: u16,
    ) -> Result<()> {
        require!(price > 0, ErrorCode::BadPrice);
        require!(maintenance_margin_bps > 0, ErrorCode::BadMargin);
        require!(maintenance_margin_bps < BPS as u16, ErrorCode::BadMargin);
        require!(liquidation_fee_bps <= 1_000, ErrorCode::BadFee);

        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.collateral_mint = ctx.accounts.collateral_mint.key();
        market.vault = ctx.accounts.vault.key();
        market.oracle = ctx.accounts.oracle.key();
        market.open_interest = 0;
        market.funding_rate_bps = 0;
        market.maintenance_margin_bps = maintenance_margin_bps;
        market.liquidation_fee_bps = liquidation_fee_bps;
        market.bump = ctx.bumps.market;

        let oracle = &mut ctx.accounts.oracle;
        oracle.authority = ctx.accounts.authority.key();
        oracle.price = price;
        oracle.last_update_slot = Clock::get()?.slot;
        oracle.bump = ctx.bumps.oracle;

        emit!(MarketInitialized {
            market: market.key(),
            collateral_mint: market.collateral_mint,
            price,
        });
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, price: i64) -> Result<()> {
        require!(price > 0, ErrorCode::BadPrice);
        require_keys_eq!(
            ctx.accounts.oracle.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );

        ctx.accounts.oracle.price = price;
        ctx.accounts.oracle.last_update_slot = Clock::get()?.slot;

        emit!(PriceUpdated { price });
        Ok(())
    }

    pub fn set_funding_rate(ctx: Context<SetFundingRate>, funding_rate_bps: i64) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.market.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require!(funding_rate_bps.abs() <= 500, ErrorCode::BadFundingRate);

        ctx.accounts.market.funding_rate_bps = funding_rate_bps;
        emit!(FundingUpdated { funding_rate_bps });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::BadCollateral);

        token::transfer(ctx.accounts.deposit_ctx(), amount)?;

        let margin = &mut ctx.accounts.margin;
        if margin.owner == Pubkey::default() {
            margin.owner = ctx.accounts.trader.key();
            margin.market = ctx.accounts.market.key();
            margin.bump = ctx.bumps.margin;
        }

        margin.free_collateral = checked_add_u64(margin.free_collateral, amount)?;

        emit!(CollateralDeposited {
            trader: ctx.accounts.trader.key(),
            amount,
        });
        Ok(())
    }

    pub fn fund_vault(ctx: Context<FundVault>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::BadCollateral);

        token::transfer(ctx.accounts.fund_ctx(), amount)?;

        emit!(VaultFunded {
            funder: ctx.accounts.funder.key(),
            amount,
        });
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::BadCollateral);
        require!(
            ctx.accounts.margin.free_collateral >= amount,
            ErrorCode::InsufficientCollateral
        );

        ctx.accounts.margin.free_collateral -= amount;
        ctx.accounts.pay_trader(amount)?;

        emit!(CollateralWithdrawn {
            trader: ctx.accounts.trader.key(),
            amount,
        });
        Ok(())
    }

    pub fn open_position(
        ctx: Context<OpenPosition>,
        side: Side,
        collateral: u64,
        size: u64,
    ) -> Result<()> {
        require!(collateral > 0, ErrorCode::BadCollateral);
        require!(size > 0, ErrorCode::BadSize);
        require!(size >= collateral, ErrorCode::BadLeverage);
        require!(size <= collateral * 10, ErrorCode::BadLeverage);
        require!(
            ctx.accounts.margin.free_collateral >= collateral,
            ErrorCode::InsufficientCollateral
        );
        require!(!ctx.accounts.position.is_open, ErrorCode::PositionAlreadyOpen);

        ctx.accounts.margin.free_collateral -= collateral;
        ctx.accounts.margin.locked_collateral =
            checked_add_u64(ctx.accounts.margin.locked_collateral, collateral)?;

        let position = &mut ctx.accounts.position;
        position.owner = ctx.accounts.trader.key();
        position.market = ctx.accounts.market.key();
        position.side = side;
        position.collateral = collateral;
        position.size = size;
        position.entry_price = ctx.accounts.oracle.price;
        position.entry_funding_rate_bps = ctx.accounts.market.funding_rate_bps;
        position.is_open = true;
        position.bump = ctx.bumps.position;

        ctx.accounts.market.open_interest =
            checked_add_u64(ctx.accounts.market.open_interest, size)?;

        emit!(PositionOpened {
            trader: ctx.accounts.trader.key(),
            side,
            collateral,
            size,
            entry_price: position.entry_price,
        });
        Ok(())
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        let payout = settle_position(
            &mut ctx.accounts.market,
            &mut ctx.accounts.margin,
            &mut ctx.accounts.position,
            ctx.accounts.oracle.price,
            0,
        )?;

        ctx.accounts.pay_trader(payout)?;

        emit!(PositionClosed {
            trader: ctx.accounts.trader.key(),
            payout,
        });
        Ok(())
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        require!(
            is_liquidatable(
                &ctx.accounts.position,
                ctx.accounts.oracle.price,
                ctx.accounts.market.funding_rate_bps,
                ctx.accounts.market.maintenance_margin_bps,
            )?,
            ErrorCode::NotLiquidatable
        );

        let reward = ctx.accounts.position.collateral
            * ctx.accounts.market.liquidation_fee_bps as u64
            / BPS as u64;

        let payout = settle_position(
            &mut ctx.accounts.market,
            &mut ctx.accounts.margin,
            &mut ctx.accounts.position,
            ctx.accounts.oracle.price,
            reward,
        )?;

        ctx.accounts.pay_owner(payout)?;
        ctx.accounts.pay_liquidator(reward)?;

        emit!(PositionLiquidated {
            owner: ctx.accounts.margin.owner,
            liquidator: ctx.accounts.liquidator.key(),
            owner_payout: payout,
            liquidator_reward: reward,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(init, payer = authority, space = 8 + Market::INIT_SPACE, seeds = [MARKET_SEED], bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = authority, space = 8 + Oracle::INIT_SPACE, seeds = [ORACLE_SEED], bump)]
    pub oracle: Account<'info, Oracle>,
    #[account(
        init,
        payer = authority,
        token::mint = collateral_mint,
        token::authority = market,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [ORACLE_SEED], bump = oracle.bump)]
    pub oracle: Account<'info, Oracle>,
}

#[derive(Accounts)]
pub struct SetFundingRate<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + MarginAccount::INIT_SPACE,
        seeds = [MARGIN_SEED, trader.key().as_ref()],
        bump
    )]
    pub margin: Account<'info, MarginAccount>,
    #[account(
        mut,
        constraint = trader_token.owner == trader.key(),
        constraint = trader_token.mint == market.collateral_mint
    )]
    pub trader_token: Account<'info, TokenAccount>,
    #[account(mut, address = market.vault, constraint = vault.mint == market.collateral_mint)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        constraint = funder_token.owner == funder.key(),
        constraint = funder_token.mint == market.collateral_mint
    )]
    pub funder_token: Account<'info, TokenAccount>,
    #[account(mut, address = market.vault, constraint = vault.mint == market.collateral_mint)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [MARGIN_SEED, trader.key().as_ref()],
        bump = margin.bump,
        constraint = margin.owner == trader.key() @ ErrorCode::Unauthorized
    )]
    pub margin: Account<'info, MarginAccount>,
    #[account(
        mut,
        constraint = trader_token.owner == trader.key(),
        constraint = trader_token.mint == market.collateral_mint
    )]
    pub trader_token: Account<'info, TokenAccount>,
    #[account(mut, address = market.vault, constraint = vault.mint == market.collateral_mint)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(seeds = [ORACLE_SEED], bump = oracle.bump)]
    pub oracle: Account<'info, Oracle>,
    #[account(
        mut,
        seeds = [MARGIN_SEED, trader.key().as_ref()],
        bump = margin.bump,
        constraint = margin.owner == trader.key() @ ErrorCode::Unauthorized
    )]
    pub margin: Account<'info, MarginAccount>,
    #[account(
        init,
        payer = trader,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, trader.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(seeds = [ORACLE_SEED], bump = oracle.bump)]
    pub oracle: Account<'info, Oracle>,
    #[account(
        mut,
        seeds = [MARGIN_SEED, trader.key().as_ref()],
        bump = margin.bump,
        constraint = margin.owner == trader.key() @ ErrorCode::Unauthorized
    )]
    pub margin: Account<'info, MarginAccount>,
    #[account(
        mut,
        seeds = [POSITION_SEED, trader.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == trader.key() @ ErrorCode::Unauthorized
    )]
    pub position: Account<'info, Position>,
    #[account(
        mut,
        constraint = trader_token.owner == trader.key(),
        constraint = trader_token.mint == market.collateral_mint
    )]
    pub trader_token: Account<'info, TokenAccount>,
    #[account(mut, address = market.vault, constraint = vault.mint == market.collateral_mint)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(seeds = [ORACLE_SEED], bump = oracle.bump)]
    pub oracle: Account<'info, Oracle>,
    #[account(
        mut,
        seeds = [MARGIN_SEED, position.owner.as_ref()],
        bump = margin.bump
    )]
    pub margin: Account<'info, MarginAccount>,
    #[account(mut, seeds = [POSITION_SEED, position.owner.as_ref()], bump = position.bump)]
    pub position: Account<'info, Position>,
    #[account(
        mut,
        constraint = owner_token.owner == margin.owner,
        constraint = owner_token.mint == market.collateral_mint
    )]
    pub owner_token: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = liquidator_token.owner == liquidator.key(),
        constraint = liquidator_token.mint == market.collateral_mint
    )]
    pub liquidator_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = market.vault, constraint = vault.mint == market.collateral_mint)]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Deposit<'info> {
    fn deposit_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            token::ID,
            Transfer {
                from: self.trader_token.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.trader.to_account_info(),
            },
        )
    }
}

impl<'info> FundVault<'info> {
    fn fund_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            token::ID,
            Transfer {
                from: self.funder_token.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.funder.to_account_info(),
            },
        )
    }
}

impl<'info> Withdraw<'info> {
    fn pay_trader(&self, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }

        let bump = [self.market.bump];
        let signer = &[&[MARKET_SEED, &bump][..]];
        let ctx = CpiContext::new_with_signer(
            token::ID,
            Transfer {
                from: self.vault.to_account_info(),
                to: self.trader_token.to_account_info(),
                authority: self.market.to_account_info(),
            },
            signer,
        );
        token::transfer(ctx, amount)
    }
}

impl<'info> ClosePosition<'info> {
    fn pay_trader(&self, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }

        let bump = [self.market.bump];
        let signer = &[&[MARKET_SEED, &bump][..]];
        let ctx = CpiContext::new_with_signer(
            token::ID,
            Transfer {
                from: self.vault.to_account_info(),
                to: self.trader_token.to_account_info(),
                authority: self.market.to_account_info(),
            },
            signer,
        );
        token::transfer(ctx, amount)
    }
}

impl<'info> Liquidate<'info> {
    fn pay_owner(&self, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }

        let bump = [self.market.bump];
        let signer = &[&[MARKET_SEED, &bump][..]];
        let ctx = CpiContext::new_with_signer(
            token::ID,
            Transfer {
                from: self.vault.to_account_info(),
                to: self.owner_token.to_account_info(),
                authority: self.market.to_account_info(),
            },
            signer,
        );
        token::transfer(ctx, amount)
    }

    fn pay_liquidator(&self, amount: u64) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }

        let bump = [self.market.bump];
        let signer = &[&[MARKET_SEED, &bump][..]];
        let ctx = CpiContext::new_with_signer(
            token::ID,
            Transfer {
                from: self.vault.to_account_info(),
                to: self.liquidator_token.to_account_info(),
                authority: self.market.to_account_info(),
            },
            signer,
        );
        token::transfer(ctx, amount)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub collateral_mint: Pubkey,
    pub vault: Pubkey,
    pub oracle: Pubkey,
    pub open_interest: u64,
    pub funding_rate_bps: i64,
    pub maintenance_margin_bps: u16,
    pub liquidation_fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Oracle {
    pub authority: Pubkey,
    pub price: i64,
    pub last_update_slot: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MarginAccount {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub free_collateral: u64,
    pub locked_collateral: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub collateral: u64,
    pub size: u64,
    pub entry_price: i64,
    pub entry_funding_rate_bps: i64,
    pub is_open: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Side {
    Long,
    Short,
}

#[event]
pub struct MarketInitialized {
    pub market: Pubkey,
    pub collateral_mint: Pubkey,
    pub price: i64,
}

#[event]
pub struct PriceUpdated {
    pub price: i64,
}

#[event]
pub struct FundingUpdated {
    pub funding_rate_bps: i64,
}

#[event]
pub struct CollateralDeposited {
    pub trader: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VaultFunded {
    pub funder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CollateralWithdrawn {
    pub trader: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PositionOpened {
    pub trader: Pubkey,
    pub side: Side,
    pub collateral: u64,
    pub size: u64,
    pub entry_price: i64,
}

#[event]
pub struct PositionClosed {
    pub trader: Pubkey,
    pub payout: u64,
}

#[event]
pub struct PositionLiquidated {
    pub owner: Pubkey,
    pub liquidator: Pubkey,
    pub owner_payout: u64,
    pub liquidator_reward: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Price must be positive")]
    BadPrice,
    #[msg("Collateral must be positive")]
    BadCollateral,
    #[msg("Size must be positive")]
    BadSize,
    #[msg("Leverage must be between 1x and 10x")]
    BadLeverage,
    #[msg("Insufficient collateral")]
    InsufficientCollateral,
    #[msg("Position already open")]
    PositionAlreadyOpen,
    #[msg("Position is not liquidatable")]
    NotLiquidatable,
    #[msg("Bad margin")]
    BadMargin,
    #[msg("Bad fee")]
    BadFee,
    #[msg("Funding rate too large")]
    BadFundingRate,
    #[msg("Math overflow")]
    MathOverflow,
}

pub fn unrealized_pnl(position: &Position, mark_price: i64, funding_rate_bps: i64) -> Result<i64> {
    require!(position.is_open, ErrorCode::NotLiquidatable);
    require!(mark_price > 0, ErrorCode::BadPrice);

    let size = position.size as i64;
    let price_delta = match position.side {
        Side::Long => mark_price - position.entry_price,
        Side::Short => position.entry_price - mark_price,
    };
    let trade_pnl = size * price_delta / position.entry_price;
    let funding_pnl = size * (position.entry_funding_rate_bps - funding_rate_bps) / BPS;

    Ok(trade_pnl + funding_pnl)
}

pub fn equity(position: &Position, mark_price: i64, funding_rate_bps: i64) -> Result<i64> {
    Ok(position.collateral as i64 + unrealized_pnl(position, mark_price, funding_rate_bps)?)
}

pub fn is_liquidatable(
    position: &Position,
    mark_price: i64,
    funding_rate_bps: i64,
    maintenance_margin_bps: u16,
) -> Result<bool> {
    let equity = equity(position, mark_price, funding_rate_bps)?;
    let maintenance_margin = position.size as i64 * maintenance_margin_bps as i64 / BPS;

    Ok(equity <= maintenance_margin)
}

fn settle_position(
    market: &mut Market,
    margin: &mut MarginAccount,
    position: &mut Position,
    mark_price: i64,
    liquidation_reward: u64,
) -> Result<u64> {
    let equity = i64::max(0, equity(position, mark_price, market.funding_rate_bps)?);
    let payout = equity as u64;
    let owner_payout = payout.saturating_sub(liquidation_reward);

    market.open_interest = checked_sub_u64(market.open_interest, position.size)?;
    margin.locked_collateral = checked_sub_u64(margin.locked_collateral, position.collateral)?;

    position.is_open = false;
    position.collateral = 0;
    position.size = 0;

    Ok(owner_payout)
}

fn checked_add_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_add(b).ok_or(ErrorCode::MathOverflow.into())
}

fn checked_sub_u64(a: u64, b: u64) -> Result<u64> {
    a.checked_sub(b).ok_or(ErrorCode::MathOverflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn position(side: Side) -> Position {
        Position {
            owner: Pubkey::new_unique(),
            market: Pubkey::new_unique(),
            side,
            collateral: 1_000,
            size: 5_000,
            entry_price: 100,
            entry_funding_rate_bps: 0,
            is_open: true,
            bump: 255,
        }
    }

    #[test]
    fn long_profits_when_price_rises() {
        assert_eq!(unrealized_pnl(&position(Side::Long), 120, 0).unwrap(), 1_000);
    }

    #[test]
    fn short_profits_when_price_falls() {
        assert_eq!(unrealized_pnl(&position(Side::Short), 80, 0).unwrap(), 1_000);
    }

    #[test]
    fn liquidation_triggers_below_maintenance_margin() {
        assert!(is_liquidatable(&position(Side::Long), 82, 0, 1_000).unwrap());
    }

    #[test]
    fn healthy_position_survives() {
        assert!(!is_liquidatable(&position(Side::Long), 95, 0, 1_000).unwrap());
    }

    #[test]
    fn funding_changes_equity() {
        assert_eq!(unrealized_pnl(&position(Side::Long), 100, 100).unwrap(), -50);
    }
}
