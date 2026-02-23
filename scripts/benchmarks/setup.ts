/**
 * Benchmark utilities and helpers
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
  timestamp: number;
}

export interface BenchmarkOptions {
  iterations?: number;
  warmup?: number;
  name: string;
}

/**
 * Calculate statistics from array of numbers
 */
export function calculateStats(values: number[]): {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  const mean = values.reduce((a, b) => a + b, 0) / len;

  const median = sorted[Math.floor(len / 2)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const p99 = sorted[Math.floor(len * 0.99)];
  const min = sorted[0];
  const max = sorted[len - 1];

  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / len;
  const stdDev = Math.sqrt(variance);

  return { mean, median, p95, p99, min, max, stdDev };
}

/**
 * Run a benchmark function multiple times and collect statistics
 */
export async function runBenchmark(
  fn: () => Promise<number>,
  options: BenchmarkOptions
): Promise<BenchmarkResult> {
  const { iterations = 100, warmup = 10, name } = options;

  console.log(`Running benchmark: ${name}`);
  console.log(`Warmup iterations: ${warmup}`);
  console.log(`Test iterations: ${iterations}`);

  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Collect measurements
  const measurements: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const duration = await fn();
    measurements.push(duration);

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\rProgress: ${i + 1}/${iterations}`);
    }
  }
  process.stdout.write('\n');

  const stats = calculateStats(measurements);

  return {
    name,
    iterations,
    ...stats,
    timestamp: Date.now(),
  };
}

/**
 * Format benchmark result for display
 */
export function formatResult(result: BenchmarkResult): string {
  return `
Benchmark: ${result.name}
Iterations: ${result.iterations}
Mean:       ${result.mean.toFixed(2)}ms
Median:     ${result.median.toFixed(2)}ms
P95:        ${result.p95.toFixed(2)}ms
P99:        ${result.p99.toFixed(2)}ms
Min:        ${result.min.toFixed(2)}ms
Max:        ${result.max.toFixed(2)}ms
StdDev:     ${result.stdDev.toFixed(2)}ms
`;
}

/**
 * Save benchmark result to JSON file
 */
export function saveResult(result: BenchmarkResult, filename: string): void {
  const fs = require('fs');
  const path = require('path');

  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const filepath = path.join(resultsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${filepath}`);
}
