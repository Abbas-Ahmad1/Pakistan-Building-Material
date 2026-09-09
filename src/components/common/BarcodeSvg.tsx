import React from 'react';

interface BarcodeSvgProps {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Standard Code128-B barcode pattern generator in crisp SVG vector format.
 * Printable on 80mm thermal receipt printers and scannable by physical 1D/2D barcode guns.
 */
export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  width = 160,
  height = 42,
  showText = true,
  className = '',
}) => {
  if (!value) return null;

  // Code 128B pattern dictionary (107 standard patterns, 11 units each, 3 bars + 3 spaces)
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
    104: '211214', // Start B
    106: '2331112' // Stop
  };

  // Start with Start Code B (104)
  const codeIndices: number[] = [104];
  let checksum = 104;

  for (let i = 0; i < value.length; i++) {
    const ascii = value.charCodeAt(i);
    // ASCII 32 (' ') to 126 ('~') maps to code index ascii - 32
    const codeIdx = Math.max(0, Math.min(95, ascii - 32));
    codeIndices.push(codeIdx);
    checksum += codeIdx * (i + 1);
  }

  const checkChar = checksum % 103;
  codeIndices.push(checkChar);

  // Construct binary sequence (1 = bar, 0 = space)
  let bitString = '0000000000'; // quiet zone

  // Append patterns for characters
  for (const idx of codeIndices) {
    const pattern = CODE128_PATTERNS[idx] || '212222';
    for (let p = 0; p < pattern.length; p++) {
      const runLen = parseInt(pattern[p], 10);
      const isBar = p % 2 === 0;
      bitString += (isBar ? '1' : '0').repeat(runLen);
    }
  }

  // Stop character
  const stopPattern = CODE128_PATTERNS[106];
  for (let p = 0; p < stopPattern.length; p++) {
    const runLen = parseInt(stopPattern[p], 10);
    const isBar = p % 2 === 0;
    bitString += (isBar ? '1' : '0').repeat(runLen);
  }

  bitString += '0000000000'; // quiet zone

  // Convert bit string to SVG rectangles
  const totalUnits = bitString.length;
  const unitWidth = width / totalUnits;

  const rects: { x: number; width: number }[] = [];
  let currentRunStart: number | null = null;

  for (let i = 0; i < bitString.length; i++) {
    if (bitString[i] === '1') {
      if (currentRunStart === null) currentRunStart = i;
    } else {
      if (currentRunStart !== null) {
        rects.push({
          x: currentRunStart * unitWidth,
          width: (i - currentRunStart) * unitWidth,
        });
        currentRunStart = null;
      }
    }
  }

  if (currentRunStart !== null) {
    rects.push({
      x: currentRunStart * unitWidth,
      width: (bitString.length - currentRunStart) * unitWidth,
    });
  }

  const barHeight = showText ? height - 12 : height;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={width}
        height={barHeight}
        viewBox={`0 0 ${width} ${barHeight}`}
        className="block"
        style={{ shapeRendering: 'crispEdges' }}
      >
        <rect width={width} height={barHeight} fill="#ffffff" />
        {rects.map((r, idx) => (
          <rect
            key={idx}
            x={r.x}
            y={0}
            width={r.width}
            height={barHeight}
            fill="#000000"
          />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-[9px] tracking-widest text-stone-800 font-bold uppercase mt-0.5">
          {value}
        </span>
      )}
    </div>
  );
};
