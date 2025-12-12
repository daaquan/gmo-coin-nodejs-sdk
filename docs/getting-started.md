# Getting Started

## Overview

This SDK provides a typed, minimal-dependencies client for GMO Coin's Forex (FX) and Cryptocurrency (Crypto) Private REST and WebSocket APIs. It supports both Forex and Cryptocurrency trading operations.

**Requirements:**
- Node.js 18+ (uses built-in `fetch`)
- Runtime dependency: `ws`

## Installation

### Prerequisites
- Node.js 18 or higher
- npm

### Install Dependencies
```bash
npm install
```

### Build the Project
```bash
npm run build
```

## Environment Setup

You need to set environment variables for API authentication. Both FX and Crypto APIs can be configured.

### macOS/Linux (One-time setup)
```bash
FX_API_KEY=yourFxKey FX_API_SECRET=yourFxSecret CRYPTO_API_KEY=yourCryptoKey CRYPTO_API_SECRET=yourCryptoSecret npm run examples:rest
```

### macOS/Linux (Export and run)
```bash
export FX_API_KEY=yourFxKey
export FX_API_SECRET=yourFxSecret
export CRYPTO_API_KEY=yourCryptoKey
export CRYPTO_API_SECRET=yourCryptoSecret
npm run examples:rest
```

### Windows PowerShell
```powershell
$env:FX_API_KEY="yourFxKey"; $env:FX_API_SECRET="yourFxSecret"; $env:CRYPTO_API_KEY="yourCryptoKey"; $env:CRYPTO_API_SECRET="yourCryptoSecret"; npm run examples:rest
```

### Windows Command Prompt
```cmd
set FX_API_KEY=yourFxKey && set FX_API_SECRET=yourFxSecret && set CRYPTO_API_KEY=yourCryptoKey && set CRYPTO_API_SECRET=yourCryptoSecret && npm run examples:rest
```

## Quick Start Examples

### Run REST API Examples
```bash
npm run examples:rest
```

### Run WebSocket Examples
```bash
npm run examples:ws
```

### Basic Usage Example

```typescript
import { FxPrivateRestClient } from './src/rest.js';

const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

// Get account assets
const assets = await fx.getAssets();
console.log(assets.data);

// Place a LIMIT order
const placed = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  executionType: 'LIMIT',
  limitPrice: '130'
});