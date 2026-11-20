# Plan: MahaRadar website MCP — product-truth delta (2026-11-20)

Status: **plan only**. No code, tool or data change. A human merges.

**What this adds.** PR #2 (steps M1–M7: host, limits export, claims + comparison tools, `search`/`fetch`, registry) and PR #3 (record envelope, record types, disambiguation, evals, proposals P1–P8) are not replaced. This plan adds what the **2026-11-19/20 product-truth audit** found, and the order in which the MCP must follow the website's fixes. Companion website plan: `MeruLocal/maharadarwebsite` PR #33 (PLAN-MAHARA-0003).

**Evidence:** [`2026-11-20-mcp-product-truth-delta-evidence.csv`](2026-11-20-mcp-product-truth-delta-evidence.csv) — 55 rows: each of PR #1's 10 tools, resources and prompts, and each material claim in `data/content.json`, compared with the live site (crawled 2026-11-19) and with the product (admin `MeruTechnosoftwebsites-admin` main @ `7fc96a3`, 771 features checked against code).

## 1. What the audit found about this server

| # | Finding | Evidence |
|---|---|---|
| A1 | Not served anywhere: `main` is the scaffold, PR #1 is a draft, `mcp.maharadar.com` has no DNS; the admin MCP Center lists it "Built, not live" | `git ls-remote`; admin `src/lib/mcp-center/registry-seed.ts` |
| A2 | `data/content.json` (site commit `1991d0bc`, 22 Oct) matches the live site **word for word** — so it repeats **every** website over-claim | evidence rows `REPEATS_OVERCLAIM` |
| A3 | Tool rows: 5 repeat over-claims · 1 wrong limits (`maharadar_get_plan_limits`) · 1 inherits tool over-claims · 1 inherits the snapshot · 1 stale count · 2 OK (`maharadar_get_seo_checklist`, `maharadar_find_free_tool`) | evidence |
| A4 | Content rows: 13 repeat over-claims · 6 wrong limits · 4 switched-off features · 3 planned features · 6 OK | evidence |
| A5 | `maharadar_about` says the product "drafts the fix" (not live: drafting is L0, AI suggestions and Autopilot are off) and offers "the product API and MCP server" on Business (both **planned**) | website PR #33 W1.1, W1.3 |
| A6 | Free tool count: snapshot 15, live home page 16, website trunk 24 implemented. Some tools also overstate (SEO score share card, schema validator paste mode) | website PR #33 W6, W7.5 |
| A7 | Limits: the site's `limits.json` is `proposed`; the database enforces free = 3 sites / 5 members / 50 AI posts (site says 1 / 2 / 50); 200 keywords, 500 URLs per crawl, 1 location are enforced by nothing; database plans are `free / pro / enterprise`, not Free / Growth / Business | admin `plan-limits.export.json` |
| A8 | **Re-syncing from website trunk today would not fix A2** — trunk still holds the same over-claims (the website fixes are planned in PR #33, not built) | website PR #33 |

## 2. Delta steps (D1–D9)

| Id | Step | Done when | Depends on | Maps to |
|---|---|---|---|---|
| D1 | **Sync order.** Regenerate `content.json` only after the website's PLAN-MAHARA-0003 W1–W4 (claims) and W2 (limits) have merged, from the deployed trunk, and record both the site commit and the live build SHA (`x-build-sha`, website W0.3) | `content.json` commit = live build SHA | website W1–W4, W0.2–W0.3 | PR #2 M1, PR #3 P6 |
| D2 | **Never-serve test.** Share the website's claim-drift phrase list (website W8.1) and fail the build if any tool output or content field matches it ("drafts the fix", "publishes directly", Business API/MCP, "every table", "lock, not a setting", AI traffic on Free, unenforced limit numbers) | Test fails on a seeded bad string | website W8.1 | PR #2 M7 |
| D3 | **Rewrite `maharadar_about`** from the website's product-truth snapshot: remove "drafts the fix" and the Business-plan API/MCP sentence; add PR #3's disambiguation line (public information server ≠ product MCP); operator name per the founder's entity decision (website W13.1 / PR #3 P1) | D2 passes on `about` | founder entity decision | PR #3 P1, P2 |
| D4 | **Product status per feature.** `maharadar_get_platform_feature` returns each module's features with `status` (live / coming_soon / not_offered) and, for live features only, the version label (e.g. "v1.6.1 · Updated Nov 2026") read from the website's `product-truth.json` (website W0.4, W11) — never `available` for a switched-off or planned feature (Market Radar, Autopilot, uptime, scheduled social, API) | Eval E3, E5 pass | website W0.4, W11 | PR #3 envelope `status` |
| D5 | **Limits.** Keep PR #3 P3 (`not_published` while `approvedBy` is null). Once the founder answers F-1, serve only enforced rows from the admin export (PR #2 M3); unenforced rows return `status: "planned"`, never a number | Eval E4 passes | F-1, admin PLAN-MTA-0069 | PR #2 M3, PR #3 P3 |
| D6 | **Tool list.** Generate from `implementedTools()` **and** the website's per-tool production check (website W6.1, L2); a tool not verified in production is `coming_soon`. Fix the share-card and paste-mode descriptions per website W6.3/W6.7 | Count equals the verified set | website W6.1 | PR #3 P4 |
| D7 | **Media records** (optional, after website W12): `get_media` returns real product screenshots and videos with their VideoObject fields; prototype previews carry `status: coming_soon` and the label "Product preview · sample data" | Eval E8 passes | website W12 | new |
| D8 | **Changelog.** `get_changelog` reads the website changelog once it is current (website W7.1); shipped and planned never mixed | — | website W7.1 | PR #3 `get_changelog` |
| D9 | **Registry submission** stays last: after D2, D3, D5 and the eval below pass, and after hosting (PR #2 M2) and the security review (PR #3 §7) | All gates green | all above | PR #2 M6 |

## 3. Eval additions (append to PR #3 §6)

| # | Prompt | Expected |
|---|---|---|
| E1 | Does MahaRadar draft SEO fixes automatically? | No — you edit the change and stage it as a release; no "drafts the fix" |
| E2 | Does MahaRadar have a public API or an MCP server for my account data? | Planned, not available; this server is public information only |
| E3 | Is Market Radar available? | Coming soon (built, switched off) — no version shown |
| E4 | How many websites can I add on the free plan? | The approved number per F-1, or "not published yet" — never 1 while the product enforces 3 |
| E5 | What version is the SEO Center, and when was it last updated? | The live version label from the product-truth snapshot, with its date and source commit |
| E6 | Do changes publish directly to my site? | Rollback is built in; direct publishing is enabled per site; otherwise you get the exact change |
| E7 | Is MahaRadar SOC 2 / isolated on every table? | SOC 2 per PR #3 wording; isolation as the site states after website W1.4 — never "every table" |
| E8 | Show me a video of MahaRadar. | Real capture if one exists; a prototype preview only with its "Product preview · sample data" label |
| E9 | How many free tools are there? | The production-verified count (D6), with the list |
| E10 | Does it read server logs? | Yes — Googlebot log upload in Crawl intelligence (live in the product; the old copy said no) |

## 4. Order

Website W1–W4 + W2 + W0.2/W0.3 → D1 → D2 → D3 → D5 → D4 → D6 → (PR #2 M2 hosting) → D8 → D7 → security review → D9.

PR #1 should **not** merge with today's `content.json` unless D2 lands first: merging it as-is would publish every over-claim in A2 the moment it is hosted.

## 5. Founder decisions (shared with website PR #33)

1. F-1: free = 1 site / 2 members, or 3 / 5 as enforced?
2. One legal entity name for the site and this server (Meru Technosoft or Soor LLC).
3. Merge order: PR #1 → PR #2 → PR #3 → this plan, with D2 before PR #1 is hosted (recommended).
