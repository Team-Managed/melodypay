import type { Backend, Cell, Position, Size } from "terminui";

const namedColors: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  gray: 90,
  "dark-gray": 90,
  "light-red": 91,
  "light-green": 92,
  "light-yellow": 93,
  "light-blue": 94,
  "light-magenta": 95,
  "light-cyan": 96,
  white: 97,
};

function styleCodes(cell: Cell): string {
  const codes: number[] = [];
  if ((cell.modifier & 1) !== 0) codes.push(1);
  if ((cell.modifier & 2) !== 0) codes.push(2);
  if (cell.fg.type === "rgb") codes.push(38, 2, cell.fg.r, cell.fg.g, cell.fg.b);
  else if (cell.fg.type === "indexed") codes.push(38, 5, cell.fg.index);
  else if (cell.fg.type !== "reset") codes.push(namedColors[cell.fg.type] ?? 39);
  return codes.length > 0 ? `\x1b[${codes.join(";")}m` : "";
}

export function createNodeBackend(): Backend {
  let cursor: Position = { x: 0, y: 0 };
  let cursorHidden = false;
  const output = process.stdout;

  return {
    size: (): Size => ({
      width: Math.max(40, output.columns || 80),
      height: Math.max(12, output.rows || 24),
    }),
    draw: (content) => {
      for (const item of content) {
        if (item.x === cursor.x && item.y === cursor.y) {
          output.write(`${styleCodes(item.cell)}${item.cell.symbol}\x1b[0m`);
        } else {
          output.write(`\x1b[${item.y + 1};${item.x + 1}H${styleCodes(item.cell)}${item.cell.symbol}\x1b[0m`);
        }
        cursor = { x: item.x + 1, y: item.y };
      }
    },
    flush: () => undefined,
    hideCursor: () => {
      if (!cursorHidden) {
        output.write("\x1b[?25l");
        cursorHidden = true;
      }
    },
    showCursor: () => {
      if (cursorHidden) {
        output.write("\x1b[?25h");
        cursorHidden = false;
      }
    },
    getCursorPosition: () => cursor,
    setCursorPosition: (position) => {
      cursor = position;
      output.write(`\x1b[${position.y + 1};${position.x + 1}H`);
    },
    clear: () => {
      output.write("\x1b[2J\x1b[H");
      cursor = { x: 0, y: 0 };
    },
  };
}

export function enterAlternateScreen() {
  process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l");
}

export function leaveAlternateScreen() {
  process.stdout.write("\x1b[?25h\x1b[?1049l");
}
