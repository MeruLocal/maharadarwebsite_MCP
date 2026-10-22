# MahaRadar MCP

Public, read-only MCP server for [maharadar.com](https://maharadar.com), the free SEO platform. It answers an AI assistant's buyer questions with canonical URLs: which free SEO tool fits a task, what is free versus paid, how a platform area works, how MahaRadar fits an audience, and the SEO checklist.

It is an **information server**. It does not run audits, touch accounts or write anything. The product API/MCP for account data is a separate Business-plan feature on the site.

- Transport: Streamable HTTP, **stateless** (no `Mcp-Session-Id`), `POST /mcp`. Auth: none.
- Tools (10, all `readOnlyHint: true`): `maharadar_about`, `maharadar_search`, `maharadar_find_free_tool`, `maharadar_list_free_tools`, `maharadar_get_free_tool`, `maharadar_get_plan_limits`, `maharadar_get_platform_feature`, `maharadar_get_audience_guide`, `maharadar_get_seo_checklist`, `maharadar_get_faq`.
- Resources: `maharadar://about`, `maharadar://plan-limits`. Prompts: `recommend_free_seo_tools`, `is_maharadar_a_fit`.
- Discovery: `/.well-known/mcp/server-card.json`, `/.well-known/mcp.json`, `/llms.txt`, `/health`, `/version`.

## Content is generated, never hand-edited

`data/content.json` is produced from the site's own content files:

```bash
SITE_REPO="C:/Software RSS/maharadarwebsite" npm run sync:content
```

It records the site repo, branch and commit it came from (returned in every tool result as `source`). Regenerate from the site trunk before every release. Only `implemented` tools are included. Comparison pages are deliberately **not** served: every competitor column on the site is still `draft` and unresearched.

Plan limits are served with the site's own status (`proposed`, enforcement not verified) and `pricesPublished: false`. The server never states a paid price.

## Connect

```bash
claude mcp add --transport http maharadar https://mcp.maharadar.com/mcp
```

Cursor, VS Code and Claude Desktop configs are in `examples/`. `eval/maharadar-eval.xml` holds 10 verifiable questions (answers checked against `data/content.json`). The host is not live yet.

## Run

```bash
npm install
npm run build && npm start      # :3010, or set PORT
npm test
```

`PUBLIC_URL` (default `https://mcp.maharadar.com`) sets the URLs in the server card and `llms.txt`. That host does not resolve yet (checked 2026-10-22); deploy and DNS are open.

## Registry packets

`docs/submission/` holds prepared, **unsubmitted** packets for the official registry, Smithery, Glama and PulseMCP, with the gates that must pass first. The audit is in `docs/AUDIT.md`.
