/**
 * Startup time benchmark
 * Measures time from spawn to "ready" state
 */

import { spawn } from 'child_process';
import { runBenchmark, formatResult, saveResult } from './setup';

async function measureStartupTime(): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Spawn the wrapper (simulate startup)
    const proc = spawn('node', ['dist/index.js', '--help'], {
      stdio: 'pipe',
      env: {
        ...process.env,
        MARIONETTE_BACKEND_URL: 'ws://localhost:8080',
      },
    });

    let ready = false;

    proc.stdout?.on('data', (data) => {
      const output = data.toString();
      // Consider "ready" when banner is displayed or help is shown
      if (output.includes('Claude Wrapper') || output.includes('Usage:')) {
        if (!ready) {
          ready = true;
          const duration = Date.now() - startTime;
          proc.kill();
          resolve(duration);
        }
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!ready) {
        proc.kill();
        reject(new Error('Startup timeout'));
      }
    }, 5000);
  });
}

async function main() {
  console.log('Startup Time Benchmark');
  console.log('======================\n');

  try {
    const result = await runBenchmark(measureStartupTime, {
      name: 'Startup Time',
      iterations: 100,
      warmup: 5,
    });

    console.log(formatResult(result));

    // Check against target (< 200ms)
    if (result.median < 200) {
      console.log('✅ PASS: Median startup time is under 200ms target');
    } else {
      console.log('⚠️  WARN: Median startup time exceeds 200ms target');
    }

    saveResult(result, 'startup-benchmark.json');
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }
}

main();
