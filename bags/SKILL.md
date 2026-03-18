---
name: bags
description: |
  Bags Protocol on Solana - token launches, trading, fee sharing, partner configs, pool management, and Dexscreener integration via the Bags Public API v2. Covers all 34 endpoints at public-api-v2.bags.fm.

  Use when: launching Solana tokens via Bags, trading/swapping tokens, configuring fee shares, claiming fees, managing partners, querying pools, listing on Dexscreener, or building any application that integrates with the Bags protocol. Triggers on mentions of bags.fm, Bags API, Bags protocol, bags token launch, bags fee share, bags trading, or Meteora DBC/DAMM v2 pool interactions through Bags.
user-invocable: true
---

# Bags Protocol - Claude Code Skill

Complete reference for building with the Bags Protocol on Solana. Bags provides token launching with built-in fee sharing, trading via aggregated routes, partner revenue sharing, and Dexscreener listing - all through a REST API.

**Docs:** https://docs.bags.fm
**Developer Portal:** https://dev.bags.fm
**OpenAPI Spec:** https://docs.bags.fm/api-reference/openapi.json

---

## Prerequisites

**API Key Required.** 28 of 34 Bags endpoints require an API key. The 6 agent endpoints (`/agent/*`) use JWT tokens in the request body instead; of those, `/agent/auth/init` and `/agent/auth/login` require no auth at all.

1. Sign up at https://bags.fm (supports Twitter, Google, GitHub, TikTok, Kick, Instagram, and more)
2. Go to https://dev.bags.fm to generate an API key (max 10 per user)
3. Set `BAGS_API_KEY` in your environment:
   ```bash
   export BAGS_API_KEY=your_key_here
   ```

When building a project that uses the Bags API, **always check that the user has `BAGS_API_KEY` set** before making requests. If it's missing, direct them to https://dev.bags.fm to create one.

## Quick Start

### 1. Install Dependencies
```bash
npm install @solana/web3.js bs58
```

### 2. Make Your First Request
```typescript
const API_KEY = process.env.BAGS_API_KEY;
if (!API_KEY) throw new Error("Set BAGS_API_KEY env var - get one at https://dev.bags.fm");

const BASE_URL = "https://public-api-v2.bags.fm/api/v1";

const res = await fetch(`${BASE_URL}/token-launch/feed`, {
  headers: { "x-api-key": API_KEY },
});
const data = await res.json();
// data.response = array of TokenLaunchFeedItem
```

---

## Authentication

- **API Key** (28 of 34 endpoints): Pass `x-api-key: <key>` header. Source: `process.env.BAGS_API_KEY`
- **Agent JWT** (6 endpoints, no API key): All `/agent/*` endpoints use JWT tokens passed in the request body instead of API keys. The 2 auth endpoints (`/agent/auth/init`, `/agent/auth/login`) require no auth at all; the other 4 (`/agent/dev/keys/create`, `/agent/dev/keys`, `/agent/wallet/export`, `/agent/wallet/list`) require a JWT token in the body.
- **Rate limit**: 1,000 requests/hour per user and IP
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Response Format

```typescript
// Success
{ success: true, response: T }

// Error (most endpoints)
{ success: false, error: "message" }

// Error (agent/fee-share wallet endpoints)
{ success: false, response: "message" }
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - invalid parameters |
| 401 | Unauthorized - missing/invalid API key |
| 403 | Forbidden |
| 404 | Not Found |
| 413 | Payload Too Large (file >15MB) |
| 429 | Rate limit exceeded |
| 500 | Internal Server Error |

---

## Key Concepts

### Token Launch Lifecycle
1. **PRE_LAUNCH** - Token info created, not yet launched
2. **PRE_GRAD** - Launched, trading on virtual pool (Meteora DBC)
3. **MIGRATING** - Migrating to DAMM v2
4. **MIGRATED** - Fully migrated, trading on DAMM v2

### Fee Sharing
- Basis points system: 10,000 = 100%
- Up to 100 fee claimers per token
- Lookup tables: the `additionalLookupTables` parameter is required when >7 claimers. The API auto-creates lookup tables when >15 claimers. Between 8-15, you must provide your own.
- Fee share config is **required** before launching a token

### Transaction Flow
All transaction endpoints return Base58-encoded serialized Solana transactions. The client must:
1. Deserialize the transaction
2. Sign it with the appropriate wallet
3. Submit via `/solana/send-transaction` or directly to Solana RPC

### Social Providers (enum)
`apple` | `google` | `email` | `solana` | `twitter` | `tiktok` | `kick` | `instagram` | `onlyfans` | `github` | `moltbook`

---

## Complete Endpoint Reference

### Base URL
```
https://public-api-v2.bags.fm/api/v1
```

---

# AGENT AUTHENTICATION

Agent auth is for **bots/automated agents only** and uses Moltbook (Bags' social platform) for verification. Most users just need an API key from https://dev.bags.fm instead.

The agent JWT flow is:
1. Call `/agent/auth/init` with a Moltbook username
2. Post the verification content to Moltbook
3. Call `/agent/auth/login` with the post ID to get a 365-day JWT

---

## POST /agent/auth/init
Initialize agent authentication. Generates a verification challenge (15-min expiry).

**Auth:** None

**Request Body:**
```json
{ "agentUsername": "myagent" }
```

**Response:**
```json
{
  "success": true,
  "response": {
    "publicIdentifier": "uuid",
    "secret": "string",
    "agentUsername": "string",
    "agentUserId": "string",
    "verificationPostContent": "string"
  }
}
```

---

## POST /agent/auth/login
Complete authentication after posting verification to Moltbook. Returns 365-day JWT.

**Auth:** None

**Request Body:**
```json
{
  "publicIdentifier": "uuid-from-init",
  "secret": "secret-from-init",
  "postId": "moltbook-post-id"
}
```

**Response:**
```json
{ "success": true, "response": { "token": "eyJ..." } }
```

---

## POST /agent/dev/keys/create
Create a new API key.

**Auth:** JWT in body

**Request Body:**
```json
{ "token": "jwt", "name": "My Bot" }
```
`name`: 1-255 chars

**Response:** Returns `apiKey` object with: `status`, `userId`, `name`, `keyId` (uuid), `key` (the actual API key), `lastUsedAt`, `createdAt`, `updatedAt`.

---

## POST /agent/dev/keys
List all active API keys.

**Auth:** JWT in body

**Request Body:**
```json
{ "token": "jwt" }
```

**Response:** Array of `AgentApiKey` objects.

---

## POST /agent/wallet/export
Export private key for an agent wallet. **SECURITY: Never log or expose private keys.**

**Auth:** JWT in body

**Request Body:**
```json
{ "token": "jwt", "walletAddress": "Base58PublicKey" }
```

**Response:**
```json
{ "success": true, "response": { "privateKey": "Base58PrivateKey" } }
```

---

## POST /agent/wallet/list
List all wallets for the authenticated agent.

**Auth:** JWT in body

**Request Body:**
```json
{ "token": "jwt" }
```

**Response:** Array of Base58 wallet public key strings.

---

# TOKEN LAUNCH

## Complete Token Launch Flow

```typescript
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

const API_KEY = process.env.BAGS_API_KEY;
const BASE = "https://public-api-v2.bags.fm/api/v1";
const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };
const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Step 1: Create token info + metadata
const tokenInfo = await fetch(`${BASE}/token-launch/create-token-info`, {
  method: "POST",
  headers: { "x-api-key": API_KEY },
  body: (() => {
    const form = new FormData();
    form.append("name", "My Token");
    form.append("symbol", "MYTKN");
    form.append("description", "A test token on Bags");
    form.append("imageUrl", "https://example.com/token.png");
    form.append("twitter", "https://twitter.com/mytoken");
    form.append("website", "https://mytoken.xyz");
    return form;
  })(),
}).then(r => r.json());

const { tokenMint, tokenMetadata } = tokenInfo.response;

// Step 2: Create fee share config (REQUIRED before launch)
const feeConfig = await fetch(`${BASE}/fee-share/config`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    payer: wallet.publicKey.toBase58(),
    baseMint: tokenMint,
    claimersArray: [wallet.publicKey.toBase58()],
    basisPointsArray: [10000], // 100% to creator
  }),
}).then(r => r.json());

// Sign and send fee share config transactions
if (feeConfig.response.transactions) {
  for (const txData of feeConfig.response.transactions) {
    const tx = VersionedTransaction.deserialize(bs58.decode(txData.transaction));
    tx.sign([wallet]);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig);
  }
}

// Step 3: Create launch transaction
const launchTx = await fetch(`${BASE}/token-launch/create-launch-transaction`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    ipfs: tokenMetadata,
    tokenMint,
    wallet: wallet.publicKey.toBase58(),
    initialBuyLamports: 100000000, // 0.1 SOL initial buy
    configKey: feeConfig.response.meteoraConfigKey,
  }),
}).then(r => r.json());

// Step 4: Sign and send launch transaction
const tx = VersionedTransaction.deserialize(bs58.decode(launchTx.response));
tx.sign([wallet]);

const signature = await fetch(`${BASE}/solana/send-transaction`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    transaction: bs58.encode(tx.serialize()),
  }),
}).then(r => r.json());

console.log("Launched!", signature.response);
```

---

## POST /token-launch/create-token-info
Create token info with image upload and generate a token mint.

**Auth:** API Key
**Content-Type:** multipart/form-data

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Token name (max 32 chars) |
| `symbol` | string | Yes | Token symbol (max 10 chars, auto-uppercased) |
| `description` | string | Yes | Token description (max 1000 chars) |
| `image` | file | Conditional | Image file. Required if no `imageUrl`. Cannot combine with `imageUrl` or `metadataUrl`. |
| `imageUrl` | uri | Conditional | Image URL. Required if no `image`. |
| `metadataUrl` | uri | No | Pre-existing metadata URL. Must use with `imageUrl`, not `image`. Skips IPFS upload. |
| `telegram` | string | No | Telegram URL |
| `twitter` | string | No | Twitter URL |
| `website` | string | No | Website URL |

**Valid combinations:**
1. `image` only
2. `imageUrl` only
3. `imageUrl` + `metadataUrl`

**Response:**
```json
{
  "success": true,
  "response": {
    "tokenMint": "Base58PublicKey",
    "tokenMetadata": "ipfs://...",
    "tokenLaunch": {
      "name": "string",
      "symbol": "string",
      "description": "string",
      "image": "url",
      "tokenMint": "Base58PublicKey",
      "status": "PRE_LAUNCH",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601",
      "userId": "string|null",
      "telegram": "string|null",
      "twitter": "string|null",
      "website": "string|null",
      "launchWallet": "string|null",
      "launchSignature": "string|null",
      "uri": "string|null"
    }
  }
}
```

---

## POST /token-launch/create-launch-transaction
Create a pre-signed token launch transaction.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ipfs` | string | Yes | IPFS/metadata URL from create-token-info |
| `tokenMint` | string | Yes | Token mint public key |
| `wallet` | string | Yes | Launcher wallet public key |
| `initialBuyLamports` | number | Yes | Initial buy amount in lamports |
| `configKey` | string | Yes | Meteora config key from fee-share/config |
| `tipWallet` | string | No | Tip recipient wallet |
| `tipLamports` | number | No | Tip amount in lamports |

**Response:** `{ success: true, response: "Base58Transaction" }`

---

## GET /token-launch/feed
Get recent/active token launches. No parameters.

**Auth:** API Key

**Response:** Array of feed items with: `name`, `symbol`, `description`, `image`, `tokenMint`, `status`, `twitter?`, `website?`, `launchSignature?`, `accountKeys?`, `numRequiredSigners?`, `uri?`, `dbcPoolKey?`, `dbcConfigKey?`.

---

## GET /token-launch/creator/v3
Get token launch creators/deployers.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `tokenMint` | string | Yes |

**Response:** Array of creator objects with: `username?`, `pfp?`, `royaltyBps?`, `isCreator?`, `wallet?`, `provider?` (SocialProvider | "unknown" | null), `providerUsername?`, `twitterUsername?`, `bagsUsername?`, `isAdmin?`.

---

# TRADING

## Complete Trading Flow

```typescript
// Step 1: Get quote
const quote = await fetch(
  `${BASE}/trade/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenMint}&amount=1000000000&slippageMode=auto`,
  { headers: { "x-api-key": API_KEY } }
).then(r => r.json());

// Step 2: Create swap transaction
const swap = await fetch(`${BASE}/trade/swap`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    quoteResponse: quote.response,
    userPublicKey: wallet.publicKey.toBase58(),
  }),
}).then(r => r.json());

// Step 3: Sign and send
const tx = VersionedTransaction.deserialize(bs58.decode(swap.response.swapTransaction));
tx.sign([wallet]);

const sig = await fetch(`${BASE}/solana/send-transaction`, {
  method: "POST",
  headers,
  body: JSON.stringify({ transaction: bs58.encode(tx.serialize()) }),
}).then(r => r.json());
```

---

## GET /trade/quote
Get a swap quote with routing, price impact, and slippage.

**Auth:** API Key

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `inputMint` | string | Yes | - | Input token mint |
| `outputMint` | string | Yes | - | Output token mint |
| `amount` | number | Yes | - | Amount in smallest unit (lamports for SOL) |
| `slippageMode` | "auto"\|"manual" | No | "auto" | Slippage calculation mode |
| `slippageBps` | number (0-10000) | No | - | Required when slippageMode="manual" |

**Response:**
```json
{
  "success": true,
  "response": {
    "requestId": "string",
    "contextSlot": 123456,
    "inAmount": "string",
    "inputMint": "string",
    "outAmount": "string",
    "outputMint": "string",
    "minOutAmount": "string",
    "otherAmountThreshold": "string",
    "priceImpactPct": "string",
    "slippageBps": 100,
    "routePlan": [
      {
        "venue": "string",
        "inAmount": "string",
        "outAmount": "string",
        "inputMint": "string",
        "outputMint": "string",
        "inputMintDecimals": 9,
        "outputMintDecimals": 6,
        "marketKey": "string",
        "data": "string"
      }
    ],
    "platformFee": {
      "amount": "string",
      "feeBps": 0,
      "feeAccount": "string",
      "segmenterFeeAmount": "string",
      "segmenterFeePct": 0
    },
    "outTransferFee": "string|null",
    "simulatedComputeUnits": 200000
  }
}
```

---

## POST /trade/swap
Create a swap transaction from a quote.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `quoteResponse` | object | Yes | Full quote response from /trade/quote |
| `userPublicKey` | string | Yes | User's wallet public key |

**Response:**
```json
{
  "success": true,
  "response": {
    "swapTransaction": "Base58Transaction",
    "computeUnitLimit": 200000,
    "lastValidBlockHeight": 250000000,
    "prioritizationFeeLamports": 5000
  }
}
```

---

## POST /solana/send-transaction
Submit a signed transaction to the Solana network.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transaction` | string | Yes | Base58 encoded signed transaction |

**Response:** `{ success: true, response: "transactionSignature" }`

---

# FEE SHARE CONFIGURATION

## POST /fee-share/config
Create fee sharing config. **Required before token launch.**

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `payer` | string | Yes | Payer wallet public key |
| `baseMint` | string | Yes | Token mint public key |
| `claimersArray` | string[] | Yes | Fee claimer wallets (1-100, no duplicates) |
| `basisPointsArray` | number[] | Yes | BPS per claimer (must sum to 10,000) |
| `partner` | string | No | Partner wallet public key |
| `partnerConfig` | string | No | Partner config PDA (required if partner set) |
| `additionalLookupTables` | string[] | No | Lookup tables (required when >7 claimers) |
| `tipWallet` | string | No | Tip recipient wallet |
| `tipLamports` | number | No | Tip amount in lamports |

**Response:**
```json
{
  "success": true,
  "response": {
    "needsCreation": true,
    "feeShareAuthority": "Base58Key",
    "meteoraConfigKey": "Base58Key",
    "transactions": [
      {
        "transaction": "Base58Transaction",
        "blockhash": {
          "blockhash": "string",
          "lastValidBlockHeight": 123456789
        }
      }
    ],
    "bundles": null
  }
}
```

---

## POST /fee-share/admin/transfer-tx
Transfer fee share admin authority.

**Auth:** API Key

| Parameter | Type | Required |
|-----------|------|----------|
| `baseMint` | string | Yes |
| `currentAdmin` | string | Yes |
| `newAdmin` | string | Yes |
| `payer` | string | Yes |

**Response:** Single `TransactionWithBlockhash` object.

---

## POST /fee-share/admin/update-config
Update fee share claimers and BPS allocations.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseMint` | string | Yes | Token mint |
| `claimersArray` | string[] | Yes | New claimer wallets (1-100) |
| `basisPointsArray` | number[] | Yes | New BPS values (sum to 10,000) |
| `payer` | string | Yes | Payer wallet |
| `additionalLookupTables` | string[] | No | Required when >7 claimers |

**Response:** Array of `TransactionWithBlockhash` in `transactions` field.

---

## GET /fee-share/admin/list
List token mints where a wallet is fee share admin.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `wallet` | string | Yes |

**Response:** `{ success: true, response: { tokenMints: ["string"] } }`

---

## GET /token-launch/fee-share/wallet/v2
Resolve social provider + username to wallet address.

**Auth:** API Key

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `provider` | SocialProvider | Yes | Social platform |
| `username` | string | Yes | Username (1-100 chars) |

**Response:**
```json
{
  "success": true,
  "response": {
    "provider": "twitter",
    "platformData": {
      "id": "string",
      "username": "string",
      "display_name": "string",
      "avatar_url": "string"
    },
    "wallet": "Base58Key"
  }
}
```

**Errors:** 404 when wallet not found.

---

## POST /token-launch/fee-share/wallet/v2/bulk
Bulk resolve social providers + usernames to wallets.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | array | Yes | 1-100 items, no duplicate username+provider combos |
| `items[].username` | string | Yes | Username (1-100 chars, normalized lowercase, leading @ removed) |
| `items[].provider` | SocialProvider | Yes | Social platform |

**Response:** Array in input order. `wallet` is null if not found.

---

# FEE CLAIMING

## Complete Fee Claiming Flow

```typescript
// Step 1: Check claimable positions
const positions = await fetch(
  `${BASE}/token-launch/claimable-positions?wallet=${wallet.publicKey.toBase58()}`,
  { headers: { "x-api-key": API_KEY } }
).then(r => r.json());

// Step 2: For each position with claimable fees, generate claim txs
for (const position of positions.response) {
  if (position.totalClaimableLamportsUserShare > 0) {
    const claimTxs = await fetch(`${BASE}/token-launch/claim-txs/v3`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        feeClaimer: wallet.publicKey.toBase58(),
        tokenMint: position.baseMint,
      }),
    }).then(r => r.json());

    // Step 3: Sign and send each claim transaction
    for (const txData of claimTxs.response) {
      const tx = VersionedTransaction.deserialize(bs58.decode(txData.tx));
      tx.sign([wallet]);
      await fetch(`${BASE}/solana/send-transaction`, {
        method: "POST",
        headers,
        body: JSON.stringify({ transaction: bs58.encode(tx.serialize()) }),
      });
    }
  }
}
```

---

## GET /token-launch/claimable-positions
Get all claimable fee positions for a wallet.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `wallet` | string | Yes |

**Response:** Array of `ClaimablePosition` objects:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isCustomFeeVault` | boolean | Yes | Uses custom fee vault |
| `baseMint` | string | Yes | Token mint |
| `isMigrated` | boolean | Yes | Migrated to DAMM v2 |
| `totalClaimableLamportsUserShare` | number | Yes | Total claimable lamports |
| `programId` | string | No | Fee share program ID (v1 or v2) |
| `quoteMint` | string | No | Quote token mint (v2) |
| `virtualPool` | string | No | Virtual pool address |
| `virtualPoolAddress` | string | No | Virtual pool address (alt field name) |
| `virtualPoolClaimableAmount` | number | No | Claimable from virtual pool (v1) |
| `virtualPoolClaimableLamportsUserShare` | number | No | User's share from virtual pool (v2) |
| `dammPoolClaimableAmount` | number | No | Claimable from DAMM pool (v1) |
| `dammPoolClaimableLamportsUserShare` | number | No | User's share from DAMM pool (v2) |
| `dammPoolAddress` | string | No | DAMM pool address |
| `dammPositionInfo` | object | No | DAMM v2 position details: `{ position, pool, positionNftAccount, tokenAMint, tokenBMint, tokenAVault, tokenBVault }` |
| `claimableDisplayAmount` | number | No | Human-readable claimable amount |
| `user` | string | No | User wallet (v2) |
| `claimerIndex` | number | No | Index in config (v2) |
| `userBps` | number | No | User's basis points (v2) |
| `customFeeVault` | string | No | Custom fee vault address (v1) |
| `customFeeVaultClaimerA` | string | No | Custom fee vault claimer A (v1) |
| `customFeeVaultClaimerB` | string | No | Custom fee vault claimer B (v1) |
| `customFeeVaultClaimerSide` | "A"\|"B" | No | Which side of custom fee vault (v1) |

---

## POST /token-launch/claim-txs/v2
Generate claim transactions with granular control over fee share program version, custom fee vaults, and DAMM v2 position parameters. Use v3 instead unless you need fine-grained control.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feeClaimer` | string | Yes | Fee claimer wallet public key |
| `tokenMint` | string | Yes | Token mint public key |
| `virtualPoolAddress` | string | No | Virtual pool address |
| `dammV2Position` | string | No | DAMM v2 position public key |
| `dammV2Pool` | string | No | DAMM v2 pool public key |
| `dammV2PositionNftAccount` | string | No | DAMM v2 position NFT account |
| `tokenAMint` | string | No | Token A mint (DAMM v2) |
| `tokenBMint` | string | No | Token B mint (DAMM v2) |
| `tokenAVault` | string | No | Token A vault (DAMM v2) |
| `tokenBVault` | string | No | Token B vault (DAMM v2) |
| `claimVirtualPoolFees` | boolean | No | Whether to claim virtual pool fees |
| `claimDammV2Fees` | boolean | No | Whether to claim DAMM v2 fees |
| `isCustomFeeVault` | boolean | No | Whether using custom fee vault |
| `feeShareProgramId` | string | No | Fee share program ID (v1 or v2) |
| `customFeeVaultClaimerA` | string | No | Custom fee vault claimer A |
| `customFeeVaultClaimerB` | string | No | Custom fee vault claimer B |
| `customFeeVaultClaimerSide` | "A"\|"B" | No | Which side of custom fee vault |

**Response:** Array of `TransactionWithBlockhash` objects.

---

## POST /token-launch/claim-txs/v3
Generate claim transactions. Automatically handles all logic based on token state. Preferred over v2 for simplicity.

**Auth:** API Key

**IMPORTANT:** Response uses field `tx` (not `transaction`).

| Parameter | Type | Required |
|-----------|------|----------|
| `feeClaimer` | string | Yes |
| `tokenMint` | string | Yes |

**Response:**
```json
{
  "success": true,
  "response": [
    {
      "tx": "Base58Transaction",
      "blockhash": {
        "blockhash": "string",
        "lastValidBlockHeight": 123456789
      }
    }
  ]
}
```

---

## GET /token-launch/lifetime-fees
Get total lifetime fees for a token (in lamports).

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `tokenMint` | string | Yes |

**Response:** `{ success: true, response: "lamports-string" }`

---

## GET /fee-share/token/claim-events
Get claim events with pagination or time filtering.

**Auth:** API Key

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `tokenMint` | string | Yes | - | Token mint |
| `mode` | "offset"\|"time" | No | "offset" | Query mode |
| `limit` | int (1-100) | No | 100 | Max events (offset mode) |
| `offset` | int (min 0) | No | 0 | Skip count (offset mode) |
| `from` | int | No | - | Start unix timestamp (time mode, required) |
| `to` | int | No | - | End unix timestamp (time mode, required, >= from) |

**Response:**
```json
{
  "success": true,
  "response": {
    "events": [
      {
        "wallet": "string",
        "isCreator": true,
        "amount": "lamports-string",
        "signature": "string",
        "timestamp": "ISO8601"
      }
    ]
  }
}
```

---

## GET /token-launch/claim-stats
Claim statistics per fee claimer for a token.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `tokenMint` | string | Yes |

**Response:** Array with: `username`, `pfp`, `royaltyBps`, `isCreator`, `wallet`, `totalClaimed` (lamports string), `provider?`, `providerUsername?`, `twitterUsername?`, `bagsUsername?`, `isAdmin?`.

---

# PARTNER MANAGEMENT

## Partner Fee Flow

```typescript
// Step 1: Create partner config (one-time, one per wallet)
const partnerTx = await fetch(`${BASE}/fee-share/partner-config/creation-tx`, {
  method: "POST",
  headers,
  body: JSON.stringify({ partnerWallet: wallet.publicKey.toBase58() }),
}).then(r => r.json());

// Sign and send the partner config creation tx
const tx = VersionedTransaction.deserialize(bs58.decode(partnerTx.response.transaction));
tx.sign([wallet]);
await connection.sendRawTransaction(tx.serialize());

// Step 2: Check partner stats
const stats = await fetch(
  `${BASE}/fee-share/partner-config/stats?partner=${wallet.publicKey.toBase58()}`,
  { headers: { "x-api-key": API_KEY } }
).then(r => r.json());
// stats.response = { claimedFees: "string", unclaimedFees: "string" }

// Step 3: Claim partner fees
const claimTxs = await fetch(`${BASE}/fee-share/partner-config/claim-tx`, {
  method: "POST",
  headers,
  body: JSON.stringify({ partnerWallet: wallet.publicKey.toBase58() }),
}).then(r => r.json());
```

---

## POST /fee-share/partner-config/creation-tx
Create a partner config (one per wallet).

**Auth:** API Key

| Parameter | Type | Required |
|-----------|------|----------|
| `partnerWallet` | string | Yes |

**Response:**
```json
{
  "success": true,
  "response": {
    "transaction": "Base58Transaction",
    "blockhash": { "blockhash": "string", "lastValidBlockHeight": 123456789 }
  }
}
```

---

## POST /fee-share/partner-config/claim-tx
Claim accumulated partner fees.

**Auth:** API Key

| Parameter | Type | Required |
|-----------|------|----------|
| `partnerWallet` | string | Yes |

**Response:**
```json
{
  "success": true,
  "response": {
    "transactions": [
      {
        "transaction": "Base58Transaction",
        "blockhash": { "blockhash": "string", "lastValidBlockHeight": 123456789 }
      }
    ]
  }
}
```

**Errors:** 400 (no unclaimed fees), 404 (partner config not found).

---

## GET /fee-share/partner-config/stats
Get partner claimed/unclaimed fees.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `partner` | string | Yes |

**Response:**
```json
{
  "success": true,
  "response": { "claimedFees": "lamports-string", "unclaimedFees": "lamports-string" }
}
```

---

# POOL INFORMATION

## GET /solana/bags/pools
List all Bags pools.

**Auth:** API Key

| Query Param | Type | Required | Default |
|-------------|------|----------|---------|
| `onlyMigrated` | boolean | No | false |

**Response:** Array of: `{ tokenMint, dbcConfigKey, dbcPoolKey, dammV2PoolKey: string|null }`

---

## GET /solana/bags/pools/token-mint
Get pool by token mint.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `tokenMint` | string | Yes |

**Response:** `{ tokenMint, dbcConfigKey, dbcPoolKey, dammV2PoolKey: string|null }`

---

## POST /token-launch/state/pool-config
Map fee claimer vault keys to Meteora DBC pool config keys.

**Auth:** API Key

| Parameter | Type | Required |
|-----------|------|----------|
| `feeClaimerVaults` | string[] | Yes |

**Response:** `{ poolConfigKeys: ["string|null"] }` - aligned with input order.

---

# DEXSCREENER INTEGRATION

## Dexscreener Listing Flow

```typescript
// Step 1: Check availability
const avail = await fetch(
  `${BASE}/solana/dexscreener/order-availability?tokenAddress=${tokenMint}`,
  { headers: { "x-api-key": API_KEY } }
).then(r => r.json());

if (avail.response.available) {
  // Step 2: Create order (returns payment tx)
  const order = await fetch(`${BASE}/solana/dexscreener/create-order`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tokenAddress: tokenMint,
      description: "My awesome token",
      iconImageUrl: "https://example.com/icon.png",
      headerImageUrl: "https://example.com/header.png",
      payerWallet: wallet.publicKey.toBase58(),
      links: [
        { url: "https://twitter.com/mytoken", label: "Twitter" },
        { url: "https://mytoken.xyz", label: "Website" },
      ],
      payWithSol: false, // pay with USDC by default
    }),
  }).then(r => r.json());

  // Step 3: Sign and send the payment transaction
  const tx = VersionedTransaction.deserialize(bs58.decode(order.response.transaction));
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig);

  // Step 4: Submit payment confirmation
  await fetch(`${BASE}/solana/dexscreener/submit-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      orderUUID: order.response.orderUUID,
      paymentSignature: sig,
    }),
  });
}
```

---

## POST /solana/dexscreener/create-order
Create a Dexscreener listing order.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenAddress` | string | Yes | Token public key |
| `description` | string | Yes | Token description (1-1000 chars) |
| `iconImageUrl` | uri | Yes | Icon image URL |
| `headerImageUrl` | uri | Yes | Header image URL |
| `payerWallet` | string | Yes | Payer wallet public key |
| `links` | DexscreenerLink[] | No | Array of `{ url: uri, label?: string (max 100) }` |
| `payWithSol` | boolean | No | Default false (USDC) |

**Response:**
```json
{
  "orderUUID": "string",
  "recipientWallet": "string",
  "priceUSDC": 0,
  "transaction": "Base58Transaction",
  "lastValidBlockHeight": 123456789
}
```

---

## GET /solana/dexscreener/order-availability
Check if Dexscreener listing is available for a token.

**Auth:** API Key

| Query Param | Type | Required |
|-------------|------|----------|
| `tokenAddress` | string | Yes |

**Response:** `{ success: true, response: { available: true } }`

---

## POST /solana/dexscreener/submit-payment
Submit signed payment for a Dexscreener order.

**Auth:** API Key

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderUUID` | string | Yes | Order UUID from create-order |
| `paymentSignature` | string | Yes | Transaction signature |

**Response:** `{ success: true, response: "confirmation message" }`

---

# COMMON PATTERNS

## TypeScript Helper Class

```typescript
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

class BagsClient {
  private baseUrl = "https://public-api-v2.bags.fm/api/v1";

  constructor(
    private apiKey: string,
    private wallet: Keypair,
    private connection: Connection
  ) {}

  private get headers() {
    return { "x-api-key": this.apiKey, "Content-Type": "application/json" };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || data.response);
    return data.response;
  }

  async signAndSend(serializedTx: string): Promise<string> {
    const tx = VersionedTransaction.deserialize(bs58.decode(serializedTx));
    tx.sign([this.wallet]);
    return this.request<string>("/solana/send-transaction", {
      method: "POST",
      body: JSON.stringify({ transaction: bs58.encode(tx.serialize()) }),
    });
  }

  async getQuote(inputMint: string, outputMint: string, amount: number) {
    return this.request(`/trade/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageMode=auto`);
  }

  async swap(quoteResponse: any) {
    return this.request<{ swapTransaction: string }>("/trade/swap", {
      method: "POST",
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: this.wallet.publicKey.toBase58(),
      }),
    });
  }

  async getClaimablePositions() {
    return this.request(`/token-launch/claimable-positions?wallet=${this.wallet.publicKey.toBase58()}`);
  }

  async claimFees(tokenMint: string) {
    return this.request<Array<{ tx: string }>>("/token-launch/claim-txs/v3", {
      method: "POST",
      body: JSON.stringify({
        feeClaimer: this.wallet.publicKey.toBase58(),
        tokenMint,
      }),
    });
  }

  async getLaunchFeed() {
    return this.request("/token-launch/feed");
  }

  async getLifetimeFees(tokenMint: string) {
    return this.request<string>(`/token-launch/lifetime-fees?tokenMint=${tokenMint}`);
  }
}
```

## Well-Known Mints

| Token | Mint Address |
|-------|-------------|
| SOL (wrapped) | `So11111111111111111111111111111111111111112` |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

## Important Gotchas

1. **Fee share config is REQUIRED** before launching a token - create it first
2. **Basis points must sum to exactly 10,000** (not 10,001, not 9,999)
3. **Lookup tables**: `additionalLookupTables` param required when >7 claimers; auto-created when >15
4. **v3 claim endpoint returns `tx`** not `transaction` field name
5. **Agent error format differs**: uses `response` field instead of `error`
6. **All amounts in lamports** are returned as strings for bigint safety - parse with `BigInt()`
7. **Transactions expire** - sign and send quickly after receiving from the API
8. **One partner config per wallet** - creation will fail if already exists
9. **Max 100 fee claimers** per token launch
10. **Max 10 API keys** per user account
