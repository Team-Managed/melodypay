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

export async function runOperatorUi(dashboard: DashboardSnapshot): Promise<OperatorAction> {
  const backend = createNodeBackend();
  const terminal = createTerminal(backend, { viewport: "fullscreen" });
  const input = process.stdin;
  let selected = 0;

  enterAlternateScreen();
  readline.emitKeypressEvents(input);
  input.setRawMode?.(true);
  input.resume();
  const onKeypress = (value: string, key: { name?: string; ctrl?: boolean }) => {
    if (key.ctrl && key.name === "c") input.emit("SIGINT");
    if (key.name === "up") selected = (selected + actions.length - 1) % actions.length;
    if (key.name === "down") selected = (selected + 1) % actions.length;
    renderScreen(terminal, dashboard, selected);
  };

  const result = await new Promise<OperatorAction>((resolve) => {
    let finished = false;
    const finish = (action: OperatorAction) => {
      if (finished) return;
      finished = true;
      resolve(action);
    };
    const originalListener = onKeypress;
    const listener = (value: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.name === "return" || key.name === "enter") finish(actions[selected].value);
      else if (key.name === "q" || key.name === "escape") finish("exit");
      else originalListener(value, key);
    };
    input.on("keypress", listener);
    renderScreen(terminal, dashboard, selected);
  });

  input.removeAllListeners("keypress");
  input.setRawMode?.(false);
  input.pause();
  leaveAlternateScreen();
  return result;
}
