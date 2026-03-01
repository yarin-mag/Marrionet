export const config = {
  port: Number(process.env.API_PROXY_PORT ?? 8788),
  host: "127.0.0.1",
  marionetteApiUrl: process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
  anthropicUpstream: process.env.ANTHROPIC_UPSTREAM ?? "https://api.anthropic.com",
};
