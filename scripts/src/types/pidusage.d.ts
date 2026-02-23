/**
 * Type declarations for pidusage module
 */

declare module 'pidusage' {
  interface Stats {
    cpu: number;
    memory: number;
    elapsed: number;
  }

  function pidusage(pid: number): Promise<Stats>;
  export = pidusage;
}
