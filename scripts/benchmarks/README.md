# Marionette Performance Benchmarks

This directory contains performance benchmarks for the Marionette Claude wrapper.

## Overview

The benchmarks validate that the TypeScript refactoring maintains performance parity with the legacy JavaScript implementation.

## Benchmarks

### 1. Startup Time (`startup.bench.ts`)
- **Measures**: Time from process spawn to "ready" state
- **Target**: < 200ms (median)
- **Iterations**: 100
- **Command**: `npm run bench:startup`

### 2. Message Latency (`message.bench.ts`)
- **Measures**: Time from stdin input to WebSocket send
- **Target**: < 50ms (p95)
- **Iterations**: 100
- **Command**: `npm run bench:message`

### 3. Memory Overhead (`memory.bench.ts`)
- **Measures**: Heap usage during idle and active states
- **Target**: < 10MB overhead vs legacy
- **Iterations**: 50
- **Command**: `npm run bench:memory`

### 4. CPU Usage (`cpu.bench.ts`)
- **Measures**: CPU percentage during idle and conversation
- **Target**: < 1% during idle
- **Iterations**: 50
- **Command**: `npm run bench:cpu`

## Running Benchmarks

Run all benchmarks:
```bash
npm run bench:startup
npm run bench:message
npm run bench:memory
npm run bench:cpu
```

Generate report:
```bash
npm run bench:report
```

## Interpreting Results

Each benchmark outputs:
- **Mean**: Average value across all iterations
- **Median**: Middle value (50th percentile)
- **P95**: 95th percentile (only 5% of runs were slower)
- **P99**: 99th percentile (only 1% of runs were slower)
- **Min/Max**: Fastest and slowest measurements
- **StdDev**: Standard deviation (consistency indicator)

### Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Startup Time | < 200ms median | < 300ms median |
| Message Latency | < 50ms p95 | < 100ms p95 |
| Memory Overhead | < 10MB | < 20MB |
| CPU Idle | < 1% | < 2% |

## Results

Benchmark results are saved to `benchmarks/results/` as JSON files.

Historical results can be compared to track performance over time.

## Methodology

- **Warmup**: Each benchmark runs 5-10 warmup iterations before measuring
- **Iterations**: 50-100 test iterations per benchmark
- **Isolation**: Each benchmark runs in a separate process
- **Consistency**: Multiple runs should have low standard deviation

## Troubleshooting

**High variance (large StdDev)**:
- Close background applications
- Run benchmarks on idle system
- Increase warmup iterations

**Timeouts**:
- Ensure backend is not required for benchmark
- Check that Claude CLI is in PATH
- Verify no port conflicts

**Out of memory**:
- Reduce iteration count
- Run benchmarks individually

## Adding New Benchmarks

1. Create new file: `benchmarks/your-benchmark.bench.ts`
2. Use `runBenchmark()` helper from `setup.ts`
3. Add npm script to `package.json`
4. Update this README with benchmark details
