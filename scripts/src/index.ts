#!/usr/bin/env node

/**
 * Claude Wrapper - Entry Point
 * Refactored TypeScript version with modular architecture
 */

import chalk from 'chalk';
import { Config } from './types/state.js';
import { AppFactory } from './factory/AppFactory.js';

// Configuration from environment variables
const config: Config = {
  wsUrl: process.env.MARIONETTE_WS_URL || 'ws://localhost:8787',
  apiUrl: process.env.MARIONETTE_API_URL || 'http://localhost:8787',
  captureEnabled: process.env.MARIONETTE_CAPTURE !== 'false',
  claudeCliPath: process.env.CLAUDE_CLI_PATH || 'claude',
  heartbeatIntervalMs: 30000,
  performanceIntervalMs: 5000,
  messageTimeoutMs: 500,
};

// Create and start the application
const app = AppFactory.create(config);

app.start().catch((err) => {
  console.error(
    chalk.red('[claude-wrapper]'),
    'Fatal error:',
    err
  );
  process.exit(1);
});
