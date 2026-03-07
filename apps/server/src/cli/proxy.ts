import { resolve } from "path";
import { existsSync } from "fs";
import { distDir } from "./utils.js";

export async function startProxy(): Promise<void> {
  const proxyPath = resolve(distDir, "proxy/index.js");
  if (existsSync(proxyPath)) {
    await import(proxyPath);
  } else {
    console.error("API proxy not found at", proxyPath);
    process.exit(1);
  }
}
