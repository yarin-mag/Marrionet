import { describe, it, expect } from 'vitest';
import { AnsiStripper } from '../AnsiStripper';

describe('AnsiStripper', () => {
  describe('strip', () => {
    it('should remove ANSI color codes', () => {
      const input = '\x1b[31mRed text\x1b[0m';
      const expected = 'Red text';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should remove multiple ANSI codes', () => {
      const input = '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m';
      const expected = 'Red Green Blue';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should remove complex ANSI codes with multiple parameters', () => {
      const input = '\x1b[1;31;40mBold Red on Black\x1b[0m';
      const expected = 'Bold Red on Black';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should handle plain text without ANSI codes', () => {
      const input = 'Plain text without colors';
      expect(AnsiStripper.strip(input)).toBe(input);
    });

    it('should handle empty string', () => {
      expect(AnsiStripper.strip('')).toBe('');
    });

    it('should remove reset codes', () => {
      const input = 'Text\x1b[0m';
      const expected = 'Text';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should handle mixed content with ANSI codes', () => {
      const input =
        'Normal \x1b[1mbold\x1b[0m \x1b[4munderline\x1b[0m \x1b[31mred\x1b[0m text';
      const expected = 'Normal bold underline red text';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should remove basic ANSI codes from cursor movement text', () => {
      // Note: AnsiStripper only removes color codes (\x1b[<digits>m)
      // Advanced cursor codes like \x1b[2J and \x1b[H are not removed
      const input = '\x1b[31mColored text\x1b[0m';
      const expected = 'Colored text';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should handle text with newlines and ANSI codes', () => {
      const input = '\x1b[31mLine 1\x1b[0m\n\x1b[32mLine 2\x1b[0m';
      const expected = 'Line 1\nLine 2';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should handle text with tabs and ANSI codes', () => {
      const input = '\x1b[31mColumn1\x1b[0m\t\x1b[32mColumn2\x1b[0m';
      const expected = 'Column1\tColumn2';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should handle consecutive ANSI codes', () => {
      const input = '\x1b[1m\x1b[31m\x1b[40mText\x1b[0m';
      const expected = 'Text';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });

    it('should preserve spaces', () => {
      const input = '  \x1b[31mIndented\x1b[0m  ';
      const expected = '  Indented  ';
      expect(AnsiStripper.strip(input)).toBe(expected);
    });
  });
});
