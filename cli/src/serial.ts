import { ReadlineParser } from "@serialport/parser-readline";
import { SerialPort } from "serialport";

export interface ApiResponse<T = unknown> {
  id: number;
  ok: boolean;
  result?: T;
  error?: string;
}

export class DeviceApiError extends Error {
  constructor(message: string, public readonly response?: ApiResponse) {
    super(message);
    this.name = "DeviceApiError";
  }
}

export interface DeviceConnection {
  readonly path: string;
  request<T>(operation: string, params?: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
}

export function parseApiResponse(line: string): ApiResponse | null {
  try {
    const value = JSON.parse(line) as ApiResponse;
    return typeof value.id === "number" && typeof value.ok === "boolean" ? value : null;
  } catch {
    return null;
  }
}

export async function listSerialPorts(): ReturnType<typeof SerialPort.list> {
  return SerialPort.list();
}

export async function connectDevice(path: string, timeoutMs = 3000): Promise<DeviceConnection> {
  const port = new SerialPort({ path, baudRate: 115200, autoOpen: false });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let nextId = 1;
  let closed = false;

  const rejectPending = (error: Error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  parser.on("data", (line: string) => {
    const response = parseApiResponse(line.trim());
    if (!response) return;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.ok) request.resolve(response.result);
    else request.reject(new DeviceApiError(response.error ?? "Device request failed", response));
  });

  port.on("error", (error) => rejectPending(error));
  port.on("close", () => {
    closed = true;
    rejectPending(new Error("Device disconnected"));
  });

  await new Promise<void>((resolve, reject) => {
    port.open((error) => (error ? reject(error) : resolve()));
  });

  return {
    path,
    async request<T>(operation: string, params?: Record<string, unknown>): Promise<T> {
      if (closed) throw new Error("Device is disconnected");
      const id = nextId++;
      const request = new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      });
      const timer = setTimeout(() => {
        const pendingRequest = pending.get(id);
        if (!pendingRequest) return;
        pending.delete(id);
        pendingRequest.reject(new Error(`Device request timed out: ${operation}`));
      }, timeoutMs);
      try {
        await new Promise<void>((resolve, reject) => {
          port.write(`api ${JSON.stringify({ id, op: operation, params })}\r\n`, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        return await request;
      } finally {
        clearTimeout(timer);
      }
    },
    async close() {
      if (closed) return;
      await new Promise<void>((resolve) => port.close(() => resolve()));
    },
  };
}
