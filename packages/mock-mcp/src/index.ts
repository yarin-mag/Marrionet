import express from "express";

const PORT = Number(process.env.PORT ?? 9999);
const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/mcp", (req, res) => {
  const method = req.body?.method ?? "unknown";
  // Return a fake usage object to demonstrate token capture
  res.json({
    id: req.body?.id ?? null,
    result: { ok: true, echo: { method, params: req.body?.params ?? {} } },
    usage: { input_tokens: 123, output_tokens: 456, total_tokens: 579, cost_usd: 0.0012 }
  });
});

app.listen(PORT, () => console.log(`[mock-mcp] listening on http://localhost:${PORT}`));
