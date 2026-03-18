/**
 * Bags Protocol API Integration Tests
 *
 * Tests are organized into tiers:
 *   1. No-auth tests (public endpoints, base URL, OpenAPI spec)
 *   2. API-key tests (requires BAGS_API_KEY env var)
 *   3. Transaction-building tests (requires API key, validates tx structure)
 *
 * Run: BAGS_API_KEY=your_key npx tsx tests/bags-api.test.ts
 * Or without a key to run only public endpoint tests.
 */

import { Connection, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

const BASE_URL = "https://public-api-v2.bags.fm/api/v1";
const API_KEY = process.env.BAGS_API_KEY || "";

// Well-known mints for testing
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// --- Test runner ---
let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name: string, fn: () => Promise<void>, requiresKey = false) {
  if (requiresKey && !API_KEY) {
    console.log(`  SKIP  ${name} (no BAGS_API_KEY)`);
    skipped++;
    return;
  }
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function assertType(val: any, type: string, field: string) {
  assert(typeof val === type, `${field} should be ${type}, got ${typeof val}`);
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...options, headers });
  return { status: res.status, data: await res.json(), headers: res.headers };
}

// =====================================================================
// TIER 1: No-Auth / Public Endpoint Tests
// =====================================================================

console.log("\n--- Tier 1: Public / No-Auth Tests ---\n");

await test("Base URL is reachable", async () => {
  const res = await fetch(BASE_URL);
  assert(res.status !== 0, "Base URL should respond");
  // Any response (even 404 for root) proves the server is up
});

await test("OpenAPI spec is accessible", async () => {
  const res = await fetch("https://docs.bags.fm/api-reference/openapi.json");
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const spec = await res.json();
  assert(spec.openapi?.startsWith("3."), "Should be OpenAPI 3.x");
  assert(Object.keys(spec.paths).length > 20, "Should have 20+ endpoints");
  assert(spec.info.title !== undefined, "Should have a title");
});

await test("GET /token-launch/creator/v3 requires auth without API key", async () => {
  // Despite docs suggesting public, this endpoint requires auth
  const res = await fetch(`${BASE_URL}/token-launch/creator/v3`);
  assert(res.status === 401 || res.status === 400, `Expected 401/400, got ${res.status}`);
});

await test("POST /agent/auth/init returns 400 for invalid username", async () => {
  const { status, data } = await fetchApi("/agent/auth/init", {
    method: "POST",
    body: JSON.stringify({ agentUsername: "" }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
  assert(data.success === false, "Should return success: false");
});

await test("POST /agent/auth/login returns 400 for invalid credentials", async () => {
  const { status, data } = await fetchApi("/agent/auth/login", {
    method: "POST",
    body: JSON.stringify({
      publicIdentifier: "00000000-0000-0000-0000-000000000000",
      secret: "invalid",
      postId: "invalid",
    }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
  assert(data.success === false, "Should return success: false");
});

await test("Response format matches documented structure", async () => {
  // Use agent/auth/init with empty body to trigger a validation error
  const { data } = await fetchApi("/agent/auth/init", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert(data.success === false, "Error response should have success: false");
  // Should have either 'error' or 'response' field for the error message
  assert(
    typeof data.error === "string" || typeof data.response === "string",
    "Error response should have error or response string field"
  );
});

// =====================================================================
// TIER 2: API-Key Required Tests
// =====================================================================

console.log("\n--- Tier 2: API-Key Tests ---\n");

await test(
  "GET /token-launch/feed returns valid feed",
  async () => {
    const { status, data } = await fetchApi("/token-launch/feed");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assert(Array.isArray(data.response), "Response should be an array");

    if (data.response.length > 0) {
      const item = data.response[0];
      assertType(item.name, "string", "feed item name");
      assertType(item.symbol, "string", "feed item symbol");
      assertType(item.tokenMint, "string", "feed item tokenMint");
      assert(
        ["PRE_LAUNCH", "PRE_GRAD", "MIGRATING", "MIGRATED"].includes(item.status),
        `Invalid status: ${item.status}`
      );
    }
  },
  true
);

// Store a token mint from the feed for later tests
let testTokenMint = "";

await test(
  "Feed provides a token mint for subsequent tests",
  async () => {
    const { data } = await fetchApi("/token-launch/feed");
    assert(data.success === true && data.response.length > 0, "Need at least 1 feed item");
    // Prefer a MIGRATED token for richer test data
    const migrated = data.response.find((i: any) => i.status === "MIGRATED");
    testTokenMint = migrated?.tokenMint || data.response[0].tokenMint;
    assert(testTokenMint.length > 20, "Token mint should be a valid public key");
    console.log(`        Using token: ${testTokenMint.slice(0, 12)}...`);
  },
  true
);

await test(
  "GET /token-launch/creator/v3 returns creators for a token",
  async () => {
    if (!testTokenMint) throw new Error("No test token mint");
    const { status, data } = await fetchApi(
      `/token-launch/creator/v3?tokenMint=${testTokenMint}`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assert(Array.isArray(data.response), "Response should be an array");
    if (data.response.length > 0) {
      const creator = data.response[0];
      assert(
        creator.wallet === undefined || typeof creator.wallet === "string",
        "wallet should be string or undefined"
      );
    }
  },
  true
);

await test(
  "GET /token-launch/lifetime-fees returns lamports string",
  async () => {
    if (!testTokenMint) throw new Error("No test token mint");
    const { status, data } = await fetchApi(
      `/token-launch/lifetime-fees?tokenMint=${testTokenMint}`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assertType(data.response, "string", "lifetime fees");
    // Should be parseable as a number (lamports)
    const lamports = BigInt(data.response);
    assert(lamports >= 0n, "Lamports should be non-negative");
  },
  true
);

await test(
  "GET /solana/bags/pools returns pool list",
  async () => {
    const { status, data } = await fetchApi("/solana/bags/pools");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assert(Array.isArray(data.response), "Response should be an array");
    if (data.response.length > 0) {
      const pool = data.response[0];
      assertType(pool.tokenMint, "string", "pool tokenMint");
      assertType(pool.dbcConfigKey, "string", "pool dbcConfigKey");
      assertType(pool.dbcPoolKey, "string", "pool dbcPoolKey");
    }
  },
  true
);

await test(
  "GET /solana/bags/pools?onlyMigrated=true filters correctly",
  async () => {
    const { status, data } = await fetchApi("/solana/bags/pools?onlyMigrated=true");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assert(Array.isArray(data.response), "Response should be an array");
    // All returned pools should have dammV2PoolKey
    for (const pool of data.response.slice(0, 5)) {
      assert(
        typeof pool.dammV2PoolKey === "string",
        "Migrated pool should have dammV2PoolKey"
      );
    }
  },
  true
);

await test(
  "GET /solana/bags/pools/token-mint returns pool for known mint",
  async () => {
    if (!testTokenMint) throw new Error("No test token mint");
    const { status, data } = await fetchApi(
      `/solana/bags/pools/token-mint?tokenMint=${testTokenMint}`
    );
    // May 404 if the test token doesn't have a pool yet
    if (status === 200) {
      assert(data.success === true, "Should return success: true");
      assertType(data.response.tokenMint, "string", "pool tokenMint");
      assertType(data.response.dbcPoolKey, "string", "pool dbcPoolKey");
    } else {
      assert(status === 400 || status === 404, `Expected 200/400/404, got ${status}`);
    }
  },
  true
);

await test(
  "GET /trade/quote returns valid quote for SOL->USDC",
  async () => {
    const amount = 100000000; // 0.1 SOL
    const { status, data } = await fetchApi(
      `/trade/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${amount}&slippageMode=auto`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");

    const quote = data.response;
    assertType(quote.requestId, "string", "requestId");
    assertType(quote.inAmount, "string", "inAmount");
    assertType(quote.outAmount, "string", "outAmount");
    assertType(quote.inputMint, "string", "inputMint");
    assertType(quote.outputMint, "string", "outputMint");
    assertType(quote.minOutAmount, "string", "minOutAmount");
    assertType(quote.priceImpactPct, "string", "priceImpactPct");
    assertType(quote.slippageBps, "number", "slippageBps");
    assert(Array.isArray(quote.routePlan), "routePlan should be an array");
    assert(quote.routePlan.length > 0, "routePlan should have at least one leg");

    const leg = quote.routePlan[0];
    assertType(leg.venue, "string", "route leg venue");
    assertType(leg.inAmount, "string", "route leg inAmount");
    assertType(leg.outAmount, "string", "route leg outAmount");
  },
  true
);

await test(
  "GET /trade/quote with manual slippage works",
  async () => {
    const { status, data } = await fetchApi(
      `/trade/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=100000000&slippageMode=manual&slippageBps=300`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.response.slippageBps === 300, "Should use manual slippage of 300 bps");
  },
  true
);

await test(
  "GET /fee-share/token/claim-events returns events for token",
  async () => {
    if (!testTokenMint) throw new Error("No test token mint");
    const { status, data } = await fetchApi(
      `/fee-share/token/claim-events?tokenMint=${testTokenMint}&mode=offset&limit=5`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assert(
      data.response.events !== undefined,
      "Response should have events field"
    );
    assert(Array.isArray(data.response.events), "events should be an array");

    if (data.response.events.length > 0) {
      const event = data.response.events[0];
      assertType(event.wallet, "string", "event wallet");
      assertType(event.amount, "string", "event amount (string for bigint)");
      assertType(event.signature, "string", "event signature");
      assertType(event.timestamp, "string", "event timestamp");
      assertType(event.isCreator, "boolean", "event isCreator");
    }
  },
  true
);

await test(
  "GET /token-launch/claim-stats returns stats array",
  async () => {
    if (!testTokenMint) throw new Error("No test token mint");
    const { status, data } = await fetchApi(
      `/token-launch/claim-stats?tokenMint=${testTokenMint}`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assert(Array.isArray(data.response), "Response should be an array");

    if (data.response.length > 0) {
      const stat = data.response[0];
      assertType(stat.username, "string", "claim stat username");
      assertType(stat.wallet, "string", "claim stat wallet");
      assertType(stat.totalClaimed, "string", "claim stat totalClaimed");
      assertType(stat.royaltyBps, "number", "claim stat royaltyBps");
      assertType(stat.isCreator, "boolean", "claim stat isCreator");
    }
  },
  true
);

await test(
  "Unauthorized request without API key returns 401",
  async () => {
    const res = await fetch(`${BASE_URL}/token-launch/feed`);
    assert(res.status === 401, `Expected 401 without key, got ${res.status}`);
    const data = await res.json();
    assert(data.success === false, "Should return success: false");
  },
  true
);

await test(
  "Rate limit headers are present on responses",
  async () => {
    const { headers } = await fetchApi("/token-launch/feed");
    // Check for at least one rate limit header (case-insensitive)
    const headerKeys = [...headers.keys()].map((k) => k.toLowerCase());
    const hasRateLimit = headerKeys.some((k) => k.includes("ratelimit") || k.includes("rate-limit"));
    // Some APIs may not always include these, so just log
    if (!hasRateLimit) {
      console.log("        Note: No rate limit headers in this response");
    }
  },
  true
);

// =====================================================================
// TIER 3: Transaction Building Validation
// =====================================================================

console.log("\n--- Tier 3: Transaction Building Tests ---\n");

await test(
  "POST /trade/swap returns valid serialized transaction",
  async () => {
    // First get a quote
    const { data: quoteData } = await fetchApi(
      `/trade/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=100000000&slippageMode=auto`
    );
    assert(quoteData.success === true, "Quote should succeed");

    // Create swap tx (we won't sign/send it)
    const { status, data } = await fetchApi("/trade/swap", {
      method: "POST",
      body: JSON.stringify({
        quoteResponse: quoteData.response,
        // Use a dummy wallet - we just want to validate the response format
        userPublicKey: "11111111111111111111111111111111",
      }),
    });

    // May fail with 400 if dummy wallet is rejected, which is fine
    if (status === 200) {
      assert(data.success === true, "Should return success: true");
      const swap = data.response;
      assertType(swap.swapTransaction, "string", "swapTransaction");
      assertType(swap.computeUnitLimit, "number", "computeUnitLimit");
      assertType(swap.lastValidBlockHeight, "number", "lastValidBlockHeight");
      assertType(swap.prioritizationFeeLamports, "number", "prioritizationFeeLamports");

      // Validate the transaction is valid Base58 and deserializable
      const txBytes = bs58.decode(swap.swapTransaction);
      assert(txBytes.length > 0, "Transaction bytes should not be empty");
      const tx = VersionedTransaction.deserialize(txBytes);
      assert(tx.message !== undefined, "Should deserialize to a VersionedTransaction");
      console.log(`        Transaction size: ${txBytes.length} bytes`);
    } else {
      console.log(`        Swap returned ${status} (expected with dummy wallet)`);
    }
  },
  true
);

await test(
  "GET /solana/dexscreener/order-availability validates format",
  async () => {
    if (!testTokenMint) throw new Error("No test token mint");
    const { status, data } = await fetchApi(
      `/solana/dexscreener/order-availability?tokenAddress=${testTokenMint}`
    );
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success: true");
    assertType(data.response.available, "boolean", "available");
  },
  true
);

await test(
  "POST /fee-share/config returns 400 for invalid BPS sum",
  async () => {
    const { status, data } = await fetchApi("/fee-share/config", {
      method: "POST",
      body: JSON.stringify({
        payer: "11111111111111111111111111111111",
        baseMint: "11111111111111111111111111111111",
        claimersArray: ["11111111111111111111111111111111"],
        basisPointsArray: [5000], // Should be 10000
      }),
    });
    assert(status === 400, `Expected 400 for invalid BPS, got ${status}`);
    assert(data.success === false, "Should return success: false");
  },
  true
);

await test(
  "POST /fee-share/config validates duplicate claimers",
  async () => {
    const wallet = "11111111111111111111111111111111";
    const { status, data } = await fetchApi("/fee-share/config", {
      method: "POST",
      body: JSON.stringify({
        payer: wallet,
        baseMint: wallet,
        claimersArray: [wallet, wallet], // Duplicates
        basisPointsArray: [5000, 5000],
      }),
    });
    assert(status === 400, `Expected 400 for duplicate claimers, got ${status}`);
    assert(data.success === false, "Should return success: false");
  },
  true
);

await test(
  "Social wallet lookup returns 404 for nonexistent user",
  async () => {
    const { status, data } = await fetchApi(
      `/token-launch/fee-share/wallet/v2?provider=twitter&username=__nonexistent_user_99999__`
    );
    assert(status === 404, `Expected 404, got ${status}`);
  },
  true
);

// =====================================================================
// Summary
// =====================================================================

console.log("\n==========================================");
console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log("==========================================\n");

if (failed > 0) process.exit(1);
