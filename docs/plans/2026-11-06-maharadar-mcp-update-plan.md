# Plan: updated MahaRadar website MCP (2026-11-06)

**Status:** plan only, nothing built by this PR. Part of PLAN-MTA-0068 in `MeruLocal/MeruTechnosoftwebsites-admin` (steps M1–M7), which follows the MahaRadar competitor research (`MeruLocal/hellogrowthcrm-researchsuite#122`).

**Starting point:** the server built on 2026-10-22 in PR #1 (branch `fix/mcp-audit-build-2026-10-22`): stateless Streamable HTTP, 10 read-only tools (`maharadar_about`, `maharadar_search`, `maharadar_list_free_tools`, `maharadar_find_free_tool`, `maharadar_get_free_tool`, `maharadar_get_plan_limits`, `maharadar_get_platform_feature`, `maharadar_get_audience_guide`, `maharadar_get_faq`, `maharadar_get_seo_checklist`), discovery files, 23 tests, Astra-reviewed. `main` is still the README-only scaffold, and `mcp.maharadar.com` does not exist yet. Competitor comparisons were left out on purpose because the site's competitor columns are unchecked (`checkedOn: null`).

## Rules that do not change

- Read-only tools only. No outbound fetches, no secrets, no write tools.
- Only founder-approved (L4) MahaRadar claims and dated, sourced competitor facts. No competitor prices unless the founder approves. No verdicts ("best", "#1").
- Every fact carries its source URL and the date it was checked; every result carries the source commit.

## Steps

| Id | Step | Done when | Depends on |
|---|---|---|---|
| M1 | Merge PR #1. Regenerate `data/content.json` from the site's deploy branch `Main` (after maharadarwebsite#10), not the plan branch | Tests pass; `content.json` records the `Main` commit | maharadarwebsite#10 |
| M2 | Host at `mcp.maharadar.com` (Docker; same Cloudflare zone as the site). Link from the site's `llms.txt` (maharadarwebsite#7) and `/.well-known/mcp.json` | `POST /mcp` answers `initialize` and `tools/list`; GET returns 405 | M1; founder or ops (F-7) |
| M3 | `maharadar_get_plan_limits` reads the app's single limits export (PLAN-MTA-0068 B1) instead of the site's `limits.json`. Until B1 ships it keeps returning `status: proposed` | Test: served limits equal the B1 export, row by row | B1 |
| M4 | New tools: `maharadar_get_claims` (search and fetch over L4 claims only, from the app's claim register, B2); `maharadar_list_comparisons` and `maharadar_get_comparison` (only comparison pages published with a checked date; each competitor fact with source URL and date); `maharadar_get_guide` (learn guides once live); `maharadar_get_case_study` (HelloBooks, once published) | Each tool has read-only annotations, an output schema, tests | B2, B3, published pages |
| M5 | `search` and `fetch` pair for assistant connectors: `fetch` takes the ids `maharadar_search` returns | Connector test passes in one client | M1 |
| M6 | Submit to the official MCP Registry, Glama, PulseMCP and Smithery using `docs/submission/` (on the PR #1 branch) | All four gates met: hosted (M2); pricing and limits signed off (F-1); content from trunk (M1); DNS TXT proof for `com.maharadar` by the founder | M2, F-1, F-7 |
| M7 | Tests and eval: no tool returns a non-L4 claim or an undated competitor fact; eval file gains limits and comparison questions | Tests in CI-equivalent local run | M3, M4 |

## Order

M1 → M2 → M5 → M3 → M4 → M7 → M6. M4 waits for the research outputs and the claim register; nothing is invented to fill it.

## After it is live

The app's MCP Center entry for this repo moves from `empty_repo` to live and is audited against the live endpoint (PLAN-MTA-0068 B8).
