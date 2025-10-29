# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Substrate-based blockchain project called **Stardust** - a memorial park system with affiliate marketing and IPFS storage integration. The project consists of:

- **Substrate Node**: Rust blockchain runtime with custom pallets using Polkadot SDK
- **React DApp**: Mobile-first frontend using React 19 + TypeScript + Ant Design 5 + Vite
- **Subsquid ETL**: Data indexing layer (in stardust-squid folder)

## Architecture

### Core Business Logic

The system implements a **15-level affiliate marketing model** with escrow settlement:

1. **Memorial System**: Users create memorials, make offerings, and manage grave data
2. **Affiliate Network**: 15-level commission structure (5% per level) with escrow settlement
3. **IPFS Integration**: Decentralized storage for media and metadata

### Key Pallets

**Core Memorial Pallets:**
- `pallet-memo-offerings`: Offering directory and order records with affiliate hooks
- `pallet-stardust-grave`: Memorial grave management
- `pallet-stardust-ipfs`: IPFS content management
- `pallet-stardust-park`: Memorial park system
- `pallet-deceased`: Deceased person records
- `pallet-deceased-data`: Media/Data attachments for deceased records (renamed from pallet-deceased-media)

**Affiliate & Financial Pallets:**
- `pallet-stardust-referrals`: Minimal referral relationships (SponsorOf mapping only)  
- `pallet-memo-affiliate`: Escrow settlement with 15-level compression (5%/level, 10% burn, 15% treasury)
- `pallet-ledger`: Weekly activity tracking and statistics
- `pallet-memo-endowment`: Endowment fund management
- `pallet-escrow`: General escrow functionality

**Governance & Trading Pallets:**
- `pallet-evidence`: Evidence submission system
- `pallet-arbitration`: Dispute resolution
- `pallet-otc-maker`: OTC trading maker functionality
- `pallet-otc-listing`: OTC trading listings
- `pallet-otc-order`: OTC order management

### Settlement Flow

1. Users make offerings via `pallet-memo-offerings::offer` → funds routed to escrow account
2. Hook triggers: record offering metadata + call `pallet-memo-affiliate::report()` for accounting
3. Weekly settlement: `pallet-memo-affiliate::settle()` distributes funds from escrow to participants
4. 15-level compression finds up to 15 qualified uplines (must have ≥3×level direct referrals during valid period)
5. Insufficient levels → treasury; 10% burned, 15% base treasury allocation

## Development Commands

### Blockchain (Rust)

```bash
# Build release binary
cargo build --release

# Run development chain
./target/release/solochain-template-node --dev

# Run with detailed logging  
RUST_BACKTRACE=1 ./target/release/solochain-template-node -ldebug --dev

# Purge development chain state
./target/release/solochain-template-node purge-chain --dev

# Generate and view docs
cargo +nightly doc --open

# Run with persistent state
./target/release/solochain-template-node --dev --base-path ./my-chain-state/

# Run tests for specific pallet
cargo test -p pallet-memo-offerings

# Check all pallets
cargo check --workspace
```

### Frontend (React DApp)

```bash
cd stardust-dapp

# Development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build  

# Lint code
npm run lint

# Preview production build
npm run preview

# Type check
npx tsc --noEmit
```

## Development Guidelines

### Code Standards (from .cursor/rules)

- All source code modifications require **detailed Chinese function-level comments**
- Design pallets for **low coupling** between modules
- Update corresponding `README.md` files when modifying pallets
- Use **Chinese for chat dialogue**, not English
- Prioritize **official pallets** over custom implementations to avoid duplication
- Ensure **privacy security** and **MEMO token fund safety**
- Check for **redundant code** and provide optimization suggestions
- Design for **future migration compatibility**

### Frontend Constraints

- **Mobile-first design** (max width 640px, centered)
- **Component-based architecture**
- **Mobile DApp only** - no desktop web interface
- Technology stack: React 19 + TypeScript + Ant Design 5 + Vite
- Frontend code location: `stardust-dapp/` directory
- Maintain frontend-backend synchronization with clear usage instructions
- Optimize user operation **reasonability and convenience**

### Data Layer

- Use **Subsquid** for blockchain data ETL (extract-transform-load) and query layer
- Handle complex/high-variance queries through Subsquid rather than runtime
- Subsquid code location: `stardust-squid/` directory

## Key Configuration

- **Polkadot SDK version**: `f3969c7ddd34985e6e709ed458bcc519f651682a`
- **Runtime**: Custom FRAME-based runtime with memorial park business logic
- **Consensus**: AURA (block authoring) + GRANDPA (finality)
- **Development accounts**: Alice, Bob (pre-funded validators with Alice as sudo)
- **Block time**: 6 seconds (6000ms)
- **Token**: MEMO (12 decimals, ss58Format: 42)
- **Runtime version**: spec_version 101

## Project Structure

```
stardust/
├── node/                     # Substrate node implementation
├── runtime/                  # Runtime configuration and logic
├── pallets/                  # Custom pallets (30+ pallets)
├── stardust-dapp/           # React frontend application
├── stardust-squid/          # Subsquid ETL layer
└── .cursor/rules/           # Development guidelines
```

## Frontend Technical Details

- **Build tool**: Vite 7.1.4 with React plugin
- **Package manager**: npm
- **Key dependencies**: 
  - @polkadot/api 16.4.6 for blockchain interaction
  - @tanstack/react-query 5.85.5 for data fetching
  - zustand 5.0.8 for state management
  - crypto-js 4.2.0 for cryptographic operations
- **Node polyfills**: Included for browser compatibility (crypto, Buffer, process)
- **Target**: ES2020

## Integration Points

- **Polkadot-JS Apps**: Connect to local node at `ws://localhost:9944`
- **IPFS**: Content addressing and decentralized storage
- **Escrow System**: PalletId-derived accounts for affiliate fund management
- **Treasury Integration**: Governance-controlled fund allocation

## Testing & Deployment

The project uses standard Substrate testing patterns. Development chain persists state in `tmp` folder during execution. For production deployment, configure proper base path and genesis state through `node/src/chain_spec.rs`.

Chain specifications available:
- Development (`--dev`): Single node development chain
- Local (`--chain=local`): Multi-node local testnet
- Custom: Configure through chain_spec.rs