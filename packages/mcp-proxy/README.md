# marionette-mcp-proxy

Run a mock upstream:
```bash
cd ../mock-mcp
pnpm dev
```

Run proxy:
```bash
cd ../mcp-proxy
MCP_FORWARD_URL=http://localhost:9999 MARIONETTE_INGEST=http://localhost:8787/events pnpm dev
```

Send a fake MCP call through proxy:
```bash
curl -s http://localhost:9797/mcp \
  -H 'content-type: application/json' \
  -H 'x-marionette-run-id: run_demo_1' \
  -H 'x-marionette-agent-id: claude_main' \
  -d '{"id":"1","method":"jira.search","params":{"q":"backlog"}}' | jq
```

Now open the dashboard at http://localhost:5173
