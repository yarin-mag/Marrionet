/**
 * ANSI / VT100 / XTerm escape code stripping utility
 */

export class AnsiStripper {
  /**
   * Strip all terminal escape sequences from text.
   * Handles CSI, OSC, DCS, and standalone ESC sequences produced by
   * node-pty / ConPTY / Claude Code's ink-based TUI.
   */
  static strip(text: string): string {
    return (
      text
        // CSI sequences: ESC [ ... (letter)  — covers colors, cursor movement, etc.
        .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '')
        // OSC sequences: ESC ] ... BEL  or  ESC ] ... ESC \
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        // DCS / PM / APC sequences
        .replace(/\x1b[P^_][^\x1b]*\x1b\\/g, '')
        // Two-character ESC sequences (e.g. ESC M, ESC 7, ESC 8)
        .replace(/\x1b[^[\]()P^_]/g, '')
        // Any remaining bare ESC
        .replace(/\x1b/g, '')
        // Non-printable control characters (keep \t, \n)
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    );
  }

  /**
   * Returns true if the stripped text has meaningful printable content.
   */
  static hasMeaningfulContent(stripped: string): boolean {
    return stripped.trim().length > 0;
  }
}
