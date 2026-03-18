# bags-skill

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill for the [Bags Protocol](https://bags.fm) on Solana.

Covers all 34 Bags API endpoints: token launches, trading/swaps, fee sharing, partner configs, pool management, Dexscreener listing, and agent authentication.

## Install

Via [skills.sh](https://skills.sh):
```bash
npx @anthropic-ai/claude-code skill add --from https://github.com/0xSardius/bags-skill
```

Or manually:
```bash
git clone https://github.com/0xSardius/bags-skill.git
ln -s $(pwd)/bags-skill/bags ~/.claude/skills/bags
```

## What's Included

- Complete endpoint reference for all 34 Bags Public API v2 endpoints
- End-to-end code examples for every major flow (launch, trade, claim fees, partners, Dexscreener)
- Reusable TypeScript `BagsClient` helper class
- Parameter tables, response schemas, and auth requirements
- Important gotchas and edge cases

## Prerequisites

An API key from [dev.bags.fm](https://dev.bags.fm) is required (28 of 34 endpoints need one). Set it as:

```bash
export BAGS_API_KEY=your_key_here
```

## Testing

```bash
npm install
npm test                                    # public endpoint tests only
BAGS_API_KEY=your_key npm test              # full suite (24 tests)
```

## API Coverage

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Agent Auth | 6 | Init/login, dev keys, wallet export/list |
| Token Launch | 4 | Create token info, launch tx, feed, creators |
| Trading | 3 | Quote, swap, send transaction |
| Fee Share Config | 6 | Create/update config, admin transfer, wallet lookup, admin list |
| Fee Claiming | 6 | Claimable positions, claim txs v2/v3, lifetime fees, events, stats |
| Partner | 3 | Create config, claim fees, stats |
| Pools | 3 | List pools, pool by mint, pool config keys |
| Dexscreener | 3 | Create order, check availability, submit payment |

## Links

- [Bags Docs](https://docs.bags.fm)
- [Bags Developer Portal](https://dev.bags.fm)
- [OpenAPI Spec](https://docs.bags.fm/api-reference/openapi.json)
