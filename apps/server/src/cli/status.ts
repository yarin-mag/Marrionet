import { config } from "../config/index.js";
import { isPortInUse } from "./utils.js";

export async function status(): Promise<void> {
  const running = await isPortInUse(config.port);
  if (running) {
    console.log(`✓ Marionette is running at http://localhost:${config.port}`);
  } else {
    console.log(`✗ Marionette is not running`);
    console.log(`  Start it with: marionette start`);
  }
}
