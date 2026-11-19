/**
 * Builds a real QR code (error correction M) with qrcode-generator and turns it into one SVG path.
 * Pure: no DOM, so it can be tested and reused for print.
 */
import qrcode from 'qrcode-generator';

/** Light modules on every side, as the QR standard requires for reliable scanning. */
export const QUIET_ZONE = 4;

export interface QrMatrix {
  /** Modules per side, without the quiet zone (21 for the smallest code). */
  modules: number;
  /** Side of the SVG view box: the modules plus the quiet zone on both sides. */
  box: number;
  /** One path that covers every dark module. */
  path: string;
}

/** The text as UTF-8 bytes, one character per byte, which is the form the generator's byte mode reads. */
function utf8Binary(text: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(text)) out += String.fromCharCode(byte);
  return out;
}

/** Returns null when the text is too long to fit in a QR code. */
export function qrMatrix(value: string): QrMatrix | null {
  try {
    const code = qrcode(0, 'M');
    code.addData(utf8Binary(value), 'Byte');
    code.make();
    const modules = code.getModuleCount();
    let path = '';
    for (let row = 0; row < modules; row++) {
      let col = 0;
      while (col < modules) {
        if (!code.isDark(row, col)) {
          col++;
          continue;
        }
        // Join neighbouring dark modules of a row into one rectangle: a shorter path and no hairline gaps.
        let run = 1;
        while (col + run < modules && code.isDark(row, col + run)) run++;
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h${run}v1h-${run}z`;
        col += run;
      }
    }
    return { modules, box: modules + QUIET_ZONE * 2, path };
  } catch {
    return null;
  }
}
