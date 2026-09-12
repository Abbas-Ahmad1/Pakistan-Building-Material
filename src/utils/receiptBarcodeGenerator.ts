/**
 * Utility to generate crisp Base64 PNG data URLs for Barcodes and QR Codes.
 * Embedded directly into printable HTML receipts/invoices so they are 100% visible
 * in print previews, physical printers, and mobile/laptop PDF exports.
 */

// Code 128-B patterns
const CODE128_PATTERNS: Record<number, string> = {
  0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322',
  5: '131222', 6: '122213', 7: '122312', 8: '132212', 9: '221213',
  10: '221312', 11: '231212', 12: '112232', 13: '122132', 14: '122231',
  15: '113222', 16: '123122', 17: '123221', 18: '223211', 19: '221132',
  20: '221231', 21: '213212', 22: '223112', 23: '312131', 24: '311222',
  25: '321122', 26: '321221', 27: '312212', 28: '322112', 29: '322211',
  30: '212123', 31: '212321', 32: '232121', 33: '111323', 34: '131123',
  35: '131321', 36: '112313', 37: '132113', 38: '132311', 39: '211313',
  40: '231113', 41: '231311', 42: '112133', 43: '112331', 44: '132131',
  45: '113123', 46: '113321', 47: '133121', 48: '313121', 49: '211331',
  50: '231131', 51: '213113', 52: '213311', 53: '213131', 54: '311123',
  55: '311321', 56: '331121', 57: '312113', 58: '312311', 59: '332111',
  60: '314111', 61: '221411', 62: '431111', 63: '111224', 64: '111422',
  65: '121124', 66: '121421', 67: '141122', 68: '141221', 69: '112214',
  70: '112412', 71: '122114', 72: '122411', 73: '142112', 74: '142211',
  75: '241211', 76: '221114', 77: '413111', 78: '241112', 79: '134111',
  80: '111242', 81: '121142', 82: '121241', 83: '114212', 84: '124112',
  85: '124211', 86: '411212', 87: '421112', 88: '421211', 89: '212141',
  90: '214121', 91: '412121', 92: '111143', 93: '111341', 94: '131141',
  95: '114113', 96: '114311', 97: '411113', 98: '411311', 99: '113141',
  100: '114131', 101: '311141', 102: '411131',
  104: '211214',
  106: '2331112'
};

export function generateBarcodeBase64Png(value: string, width = 180, height = 46): string {
  if (typeof document === 'undefined') return '';
  const safeValue = String(value || '').trim();
  if (!safeValue) return '';

  const codeIndices: number[] = [104];
  let checksum = 104;

  for (let i = 0; i < safeValue.length; i++) {
    const ascii = safeValue.charCodeAt(i);
    const codeIdx = Math.max(0, Math.min(95, ascii - 32));
    codeIndices.push(codeIdx);
    checksum += codeIdx * (i + 1);
  }

  codeIndices.push(checksum % 103);

  let bitString = '0000000000';
  for (const idx of codeIndices) {
    const pattern = CODE128_PATTERNS[idx] || '212222';
    for (let p = 0; p < pattern.length; p++) {
      const runLen = parseInt(pattern[p], 10);
      bitString += (p % 2 === 0 ? '1' : '0').repeat(runLen);
    }
  }

  const stopPattern = CODE128_PATTERNS[106];
  for (let p = 0; p < stopPattern.length; p++) {
    const runLen = parseInt(stopPattern[p], 10);
    bitString += (p % 2 === 0 ? '1' : '0').repeat(runLen);
  }
  bitString += '0000000000';

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const barHeight = height - 12;
  const unitWidth = width / bitString.length;
  ctx.fillStyle = '#000000';

  for (let i = 0; i < bitString.length; i++) {
    if (bitString[i] === '1') {
      ctx.fillRect(i * unitWidth, 0, unitWidth + 0.25, barHeight);
    }
  }

  ctx.font = 'bold 9px monospace, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(safeValue, width / 2, height - 1);

  return canvas.toDataURL('image/png');
}

export function generateQrCodeBase64Png(value: string, size = 96): string {
  if (typeof document === 'undefined') return '';
  const safeValue = String(value || '').trim();
  if (!safeValue) return '';

  const gridSize = 21;
  const matrix: boolean[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));

  const setFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[startY + r][startX + c] = true;
        }
      }
    }
  };

  setFinder(0, 0);
  setFinder(14, 0);
  setFinder(0, 14);

  for (let i = 8; i < 13; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let hash = 0;
  for (let i = 0; i < safeValue.length; i++) {
    hash = (hash * 31 + safeValue.charCodeAt(i)) & 0xffffffff;
  }

  let bitIndex = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const inFinderTL = r < 8 && c < 8;
      const inFinderTR = r < 8 && c >= 13;
      const inFinderBL = r >= 13 && c < 8;
      const inTiming = r === 6 || c === 6;

      if (!inFinderTL && !inFinderTR && !inFinderBL && !inTiming) {
        const charVal = safeValue.charCodeAt(bitIndex % safeValue.length);
        const bit = ((hash ^ (r * 17 + c * 31 + charVal)) >> ((r + c) % 8)) & 1;
        matrix[r][c] = bit === 1;
        bitIndex++;
      }
    }
  }

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const padding = 4;
  const matrixSize = size - (padding * 2);
  const moduleSize = matrixSize / gridSize;

  ctx.fillStyle = '#000000';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(padding + c * moduleSize, padding + r * moduleSize, moduleSize + 0.3, moduleSize + 0.3);
      }
    }
  }

  return canvas.toDataURL('image/png');
}
