# MahaRadar MCP

Public, read-only MCP server for [maharadar.com](https://maharadar.com), the free SEO platform. It answers an AI assistant's buyer questions with canonical URLs: which free SEO tool fits a task, what is free versus paid, how a platform area works, how MahaRadar fits an audience, and the SEO checklist.

It is an **information server**. It does not run audits, touch accounts or write anything. It is **not** the MahaRadar product API or an MCP server for account data (both planned, not available).

- Transport: Streamable HTTP, **stateless** (no `Mcp-Session-Id`), `POST /mcp`. Auth: none.
- Tools (18, all `readOnlyHint: true`): `maharadar_about`, `maharadar_search`, `maharadar_fetch`, `maharadar_find_free_tool`, `maharadar_list_free_tools`, `maharadar_get_free_tool`, `maharadar_get_plan_limits`, `maharadar_get_platform_feature`, `maharadar_get_feature_status`, `maharadar_get_audience_guide`, `maharadar_get_seo_checklist`, `maharadar_get_faq`, and six register-backed tools that answer `not_published` until their records are approved: `maharadar_get_claims`, `maharadar_get_trust_facts`, `maharadar_list_comparisons`, `maharadar_get_comparison`, `maharadar_get_market_info`, `maharadar_get_changelog`.
- Resources: `maharadar://about`, `maharadar://plan-limits`. Prompts: `recommend_free_seo_tools`, `is_maharadar_a_fit`.
- Discovery: `/.well-known/mcp/server-card.json`, `/.well-known/mcp.json`, `/llms.txt`, `/health`, `/version`.

## Product-truth rules (what the server will not say)

`data/content.json` is a snapshot of the site and repeats the site's over-claims (audit 2026-11-20). The server therefore serves `content` **minus** what `data/product-truth.json` holds, and fails closed on a never-serve phrase list ("drafts the fix", "publishes directly", Business API/MCP, "every table", AI traffic on Free, ...). Held items answer `status: "not_published"`. Plan limits come only from an approved `data/plan-limits.export.json` (absent today), never from the site table. See `docs/RECONCILIATION.md` for what was built, held and is waiting on the founder or ops.

## Content is generated, never hand-edited

`data/content.json` is produced from the site's own content files:

```bash
SITE_REPO="C:/Software RSS/maharadarwebsite" npm run sync:content
```

It records the site repo, branch and commit it came from (returned in every tool result as `source`; the repo owner is not echoed). **Do not regenerate or host until the website's claim fixes (website PLAN-MAHARA-0003 W1-W4) are merged**: a re-sync from today's trunk repeats the same over-claims. Comparison pages are not served until published with a checked date.

## Connect

```bash
claude mcp add --transport http maharadar https://mcp.maharadar.com/mcp
```

Cursor, VS Code and Claude Desktop configs are in `examples/`. `eval/maharadar-eval.xml` holds 12 verifiable questions (product-truth answers). The host is not live yet.

## Run

```bash
npm install
npm run build && npm start      # :3010, or set PORT
npm test
```

`PUBLIC_URL` (default `https://mcp.maharadar.com`) sets the URLs in the server card and `llms.txt`. That host does not resolve yet (checked 2026-10-22); deploy and DNS are open.

## Registry packets

`docs/submission/` holds prepared, **unsubmitted** packets for the official registry, Smithery, Glama and PulseMCP, with the gates that must pass first. The audit is in `docs/AUDIT.md`.
