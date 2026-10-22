# Registry submission packets (NOT submitted)

Nothing here has been submitted anywhere. Do not submit until the **gates** below are met.

## Gates (all must be true first)

1. `https://mcp.maharadar.com` resolves and serves `POST /mcp` (2026-10-22: DNS returns nothing; no host exists yet). Verify with `node C:/Users/rshah/.claude/skills/RSS-MCP-Audit-skill/audit-live-mcp.mjs https://mcp.maharadar.com/mcp`-style checks and `npx @modelcontextprotocol/inspector --cli https://mcp.maharadar.com/mcp --transport http --method tools/list`.
2. Founder signs off the pricing/limits status. The site source marks the limits `proposed`; the server repeats that. Listing copy must not say "free forever" beyond what `/free-plan` says.
3. `data/content.json` regenerated from the **trunk** of `MeruLocal/maharadarwebsite` (this build was generated from branch `plan/mta-0035-maharadar-marketing-website` @ `1991d0bc`, which is the repo's default branch pointer but not a `master`/`main`).
4. For the official registry: DNS TXT proof for `maharadar.com` (namespace `com.maharadar`), done by the founder with `mcp-publisher login dns`. No credentials are stored in this repo.

## Packet files

| Target | File | Needs |
|---|---|---|
| Official MCP Registry | `server.json` (repo root) + `official-registry.md` | gates 1, 4; remote-only entry, so no npm package or `mcp-name` marker needed |
| Smithery | `smithery.yaml` (root) + `smithery.md` | gate 1; container build from `Dockerfile` |
| Glama | `glama.md` (+ `glama.json` in root) | public GitHub repo, claim by the founder's GitHub login |
| PulseMCP | `pulsemcp.md` | gate 1; submit URL form |

## Listing copy (reuse everywhere)

- **Name:** MahaRadar
- **One line:** Public, read-only facts about MahaRadar, the free SEO platform: which free SEO tool fits a task, what is free vs paid, SEO checklist, with canonical URLs.
- **Tags:** seo, seo-tools, site-audit, sitemap, robots-txt, schema-markup, hreflang, free-tools
- **Tools (9):** maharadar_about, maharadar_search, maharadar_find_free_tool, maharadar_list_free_tools, maharadar_get_free_tool, maharadar_get_plan_limits, maharadar_get_platform_feature, maharadar_get_audience_guide, maharadar_get_seo_checklist
- **Auth:** none. **Writes:** none. **Transport:** Streamable HTTP, stateless.
- **Honest scope line (include):** "Information server. It does not run audits; the audits run on maharadar.com/tools."
