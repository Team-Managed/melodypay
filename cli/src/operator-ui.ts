import readline from "node:readline";
import {
  blockBordered,
  createLayout,
  createParagraph,
  createTerminal,
  createTitle,
  fillConstraint,
  frameRenderWidget,
  lengthConstraint,
  renderParagraph,
  splitLayout,
  terminalDraw,
  type Terminal,
} from "terminui";
import { formatBalanceRows, type BalanceRow } from "./balances.js";
import { createNodeBackend, enterAlternateScreen, leaveAlternateScreen } from "./terminal-backend.js";

export type OperatorAction = "dashboard" | "device" | "status" | "networks" | "payment" | "diagnostics" | "inspect" | "exit";

export interface DashboardSnapshot {
  address?: string;
  devicePath?: string;
  rows: readonly BalanceRow[];
}

export interface PromptOption<T> {
  value: T;
  label: string;
  hint?: string;
}

const actions: readonly { value: OperatorAction; label: string }[] = [
  { value: "dashboard", label: "Refresh dashboard" },
  { value: "device", label: "USB wallet manager" },
  { value: "status", label: "Wallet/device status" },
  { value: "payment", label: "Payment terminal" },
  { value: "diagnostics", label: "Audio/OLED diagnostics" },
  { value: "inspect", label: "Inspect signed transaction" },
  { value: "networks", label: "Network profiles" },
  { value: "exit", label: "Exit" },
];

function renderScreen(terminal: Terminal, dashboard: DashboardSnapshot, selected: number) {
  terminalDraw(terminal, (frame) => {
    const [header, body, footer] = splitLayout(
      createLayout([lengthConstraint(4), fillConstraint(1), lengthConstraint(2)]),
      frame.area,
    );
    const [dashboardArea, menuArea] = splitLayout(
      createLayout([fillConstraint(2), fillConstraint(1)]),
      body,
    );
    const menuText = actions.map((action, index) => `${index === selected ? ">" : " "} ${action.label}`).join("\n");
    const address = dashboard.address ?? "not connected";
    const device = dashboard.devicePath ?? "none";
    const headerText = `MelodyPay Wallet Dashboard\nAddress: ${address}\nDevice: ${device}`;

    frameRenderWidget(frame, renderParagraph(createParagraph(headerText, {
      block: blockBordered({ titles: [createTitle("MelodyPay")] }),
    })), header);
    frameRenderWidget(frame, renderParagraph(createParagraph(formatBalanceRows(dashboard.rows), {
      block: blockBordered({ titles: [createTitle("Balances")] }),
    })), dashboardArea);
    frameRenderWidget(frame, renderParagraph(createParagraph(menuText, {
      block: blockBordered({ titles: [createTitle("Operator menu")] }),
    })), menuArea);
    frameRenderWidget(frame, renderParagraph(createParagraph("Up/Down select   Enter open   Q exit", {
      block: blockBordered(),
    })), footer);
  });
}

type KeyHandler<T> = (value: string, key: readline.Key, finish: (result: T) => void) => void;

async function runInteractive<T>(render: (terminal: Terminal) => void, handleKey: KeyHandler<T>): Promise<T> {
  const backend = createNodeBackend();
  const terminal = createTerminal(backend, { viewport: "fullscreen" });
  const input = process.stdin;
  let listener: ((value: string, key: readline.Key) => void) | null = null;

  enterAlternateScreen();
  readline.emitKeypressEvents(input);
  input.setRawMode?.(true);
  input.resume();
  const result = await new Promise<T>((resolve) => {
    listener = (value, key) => handleKey(value, key, resolve);
    input.on("keypress", listener);
    render(terminal);
  });
  if (listener) input.off("keypress", listener);
  input.setRawMode?.(false);
  input.pause();
  leaveAlternateScreen();
  return result;
}

function renderPrompt(terminal: Terminal, title: string, body: string, footer: string) {
  terminalDraw(terminal, (frame) => {
    const [bodyArea, footerArea] = splitLayout(
      createLayout([fillConstraint(1), lengthConstraint(2)]),
      frame.area,
    );
    frameRenderWidget(frame, renderParagraph(createParagraph(body, {
      block: blockBordered({ titles: [createTitle(title)] }),
    })), bodyArea);
    frameRenderWidget(frame, renderParagraph(createParagraph(footer, {
      block: blockBordered(),
    })), footerArea);
  });
}

export async function promptText(message: string, placeholder = ""): Promise<string | null> {
  let value = "";
  let error = "";
  return runInteractive(
    (terminal) => renderPrompt(terminal, message, `${value || placeholder}${error ? `\n\nError: ${error}` : ""}`, "Type text   Enter submit   Esc cancel"),
    (inputValue, key, finish) => {
      if (key.name === "escape") return finish(null);
      if (key.name === "return" || key.name === "enter") {
        if (!value.trim()) {
          error = "A value is required";
          return;
        }
        return finish(value.trim());
      }
      if (key.name === "backspace") value = value.slice(0, -1);
      else if (inputValue && !key.ctrl && !key.meta && inputValue.length === 1) value += inputValue;
    },
  );
}

export async function promptSelect<T>(message: string, options: readonly PromptOption<T>[]): Promise<T | null> {
  let selected = 0;
  return runInteractive(
    (terminal) => {
      const body = options.map((option, index) => `${index === selected ? ">" : " "} ${option.label}${option.hint ? `  ${option.hint}` : ""}`).join("\n");
      renderPrompt(terminal, message, body, "Up/Down select   Enter confirm   Esc cancel");
    },
    (_value, key, finish) => {
      if (key.name === "escape") return finish(null);
      if (key.name === "up") selected = (selected + options.length - 1) % options.length;
      if (key.name === "down") selected = (selected + 1) % options.length;
      if (key.name === "return" || key.name === "enter") finish(options[selected].value);
    },
  );
}

export async function showInfo(title: string, body: string): Promise<void> {
  await runInteractive(
    (terminal) => renderPrompt(terminal, title, body, "Press Enter to continue"),
    (_value, key, finish) => {
      if (key.name === "return" || key.name === "enter" || key.name === "escape") finish(undefined);
    },
  );
}

export async function runOperatorUi(dashboard: DashboardSnapshot): Promise<OperatorAction> {
  let selected = 0;
  let activeTerminal: Terminal | null = null;
  return runInteractive(
    (terminal) => {
      activeTerminal = terminal;
      renderScreen(terminal, dashboard, selected);
    },
    (_value, key, finish) => {
      if (key.ctrl && key.name === "c") return finish("exit");
      if (key.name === "up") selected = (selected + actions.length - 1) % actions.length;
      if (key.name === "down") selected = (selected + 1) % actions.length;
      if (activeTerminal) renderScreen(activeTerminal, dashboard, selected);
      if (key.name === "return" || key.name === "enter") finish(actions[selected].value);
      else if (key.name === "q" || key.name === "escape") finish("exit");
    },
  );
}
