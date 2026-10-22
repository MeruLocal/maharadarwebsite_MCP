# Official MCP Registry (registry.modelcontextprotocol.io)

Prepared, not run. Steps for a human with the founder's DNS access:

```bash
# 1. Prove the domain (writes a TXT record the founder adds; key never committed)
mcp-publisher login dns --domain maharadar.com --private-key "$MCP_DNS_KEY"
# 2. Validate then publish server.json from the repo root
mcp-publisher validate
mcp-publisher publish
```

`server.json` declares `com.maharadar/maharadar-mcp` with one `remotes` entry (`streamable-http`, `https://mcp.maharadar.com/mcp`). Remote-only, so no npm package. Check `scripts/check-versions.mjs` passes first. Re-check the schema URL in `server.json` against the currently documented one before publishing.
