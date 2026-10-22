# Client configs

Replace the URL once the server is deployed (not yet: `mcp.maharadar.com` has no DNS as of 2026-10-22).

- Claude Code: `claude mcp add --transport http maharadar https://mcp.maharadar.com/mcp`
- Claude Desktop / Cursor / VS Code: see the JSON files in this folder.
- Local dev: `npm run build && PORT=3010 npm start`, then use `http://localhost:3010/mcp`.
- Smoke test: `npx @modelcontextprotocol/inspector --cli https://mcp.maharadar.com/mcp --transport http --method tools/list`
