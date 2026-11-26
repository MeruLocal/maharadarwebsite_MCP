# Plans #2, #3, #4: reconciled and built (2026-11-26)

Rule: **PR #4 (product truth) wins** wherever the plans overlap. This stacks on PR #1. Tests use fixtures; nothing calls a live host.

## Naming
PR #3 proposes unprefixed tool names (`search_site`, `get_tool`, ...). PR #2 and PR #1 use `maharadar_*`. We kept `maharadar_*`: it does not break PR #1 clients and avoids clashes in multi-server clients. Mapping: `search_site`=`maharadar_search`, `fetch_record`=`maharadar_fetch`, `list_tools`/`get_tool`=`maharadar_list_free_tools`/`maharadar_get_free_tool`, `get_trust_facts`, `get_comparison`, `get_market_info`, `get_changelog` = same name with the prefix.

## Step status
| Plan step | Status | Notes |
|---|---|---|
| #2 M1 / #4 D1 re-sync from site trunk | **Held** | Trunk still holds the over-claims (#4 A8). Needs website W1-W4 + live build SHA. |
| #2 M2 hosting | **Needs ops/founder** | DNS, Docker host (F-7). |
| #2 M3 / #3 P3 / #4 D5 limits | **Built (gate)** | `src/limits.ts`: `not_published` until `approvedBy`; unenforced rows `planned`, no number; site table never served. Export shape is **assumed** (see file header); real `plan-limits.export.json` not in this repo. |
| #2 M4 tools | **Built (gated, empty)** | claims, trust facts, comparisons, market info, changelog: gates + fixtures tested; registers empty by design. `get_guide`, `get_case_study`: unbuilt (no published pages). |
| #2 M5 search + fetch | **Built** | search hits have ids; fetch resolves every id. |
| #2 M6 / #4 D9 registry submission | **Held** | Gates not met. |
| #2 M7 / #4 D2 never-serve test | **Built** | `neverServe` list in `data/product-truth.json`; tests fail on seeded bad strings and walk all tool output. Phrase list is hand-copied; replace with website W8.1 list when it exists. |
| #3 P1 entity / brand guard | **Built, entity unresolved** | Operator no longer named anywhere; parent/sister names and the repo owner are not served. Soor LLC vs Meru Technosoft is a founder decision: no name used. |
| #3 P2 / #4 D3 about + disambiguation | **Built** | `DISAMBIGUATION` on instructions, about, server card, llms.txt. |
| #3 P4 / #4 D6 tool list | **Partly** | Count = tools verified live 2026-11-19 (15) with a basis note; two over-claiming check strings removed. Website's per-tool production check (W6.1) not available. |
| #3 P5 FAQ visible content | **n/a** | Snapshot is visible copy, not JSON-LD. |
| #3 P7 PR #1 body said 9 tools | **Moot** | Now 18. |
| #4 D4 feature status | **Built** | `maharadar_get_feature_status`; version label null until the website publishes `product-truth.json`. |
| #3 markets (DE/FR/IT/JP, en-AE) | **Held** | Gate requires Astra check, dated sourced figures; en-AE question open. |
| #4 D7 media, D8 changelog content | **Unbuilt / empty** | Depend on website W12 / W7.1. |

## Held content (removed from served output)
Platform: site-audit, technical-seo, site-intelligence, keywords, links, search-engines, content, publishing, roles-and-permissions, api. Audiences: agencies, saas, developers. FAQs: 10 of 13 (kept: credit card, AI blog posts, crawl politely). Reasons per item in `data/product-truth.json`.

## Founder / ops needs
F-1 free-plan numbers; entity name; en-AE; legal reviewer; hosting + DNS; website W1-W4 merge then re-sync; `plan-limits.export.json`; claim register; DNS TXT for registry.
