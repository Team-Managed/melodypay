import type { DeviceConnection } from "./serial.js";

export interface DeviceInfo {
  api_version: number;
  firmware: string;
  chip: string;
  cores: number;
  audio: boolean;
  display: boolean;
}

export interface DeviceStatus {
  wallet_state: number;
  active_chain_id: number;
  display_connected: boolean;
  audio_available: boolean;
  address_derivation: boolean;
  signing: boolean;
  private_key_export: boolean;
  development_key_backend: boolean;
}

export class DeviceClient {
  constructor(private readonly connection: DeviceConnection) {}

  info(): Promise<DeviceInfo> {
    return this.connection.request<DeviceInfo>("device.info");
  }

  status(): Promise<DeviceStatus> {
    return this.connection.request<DeviceStatus>("device.status");
  }

  capabilities(): Promise<DeviceStatus> {
    return this.connection.request<DeviceStatus>("wallet.capabilities");
  }

  configureChain(chainId: number): Promise<{ active_chain_id: number }> {
    return this.connection.request("wallet.configure", { chain_id: chainId });
  }

  displayText(text: string): Promise<Record<string, never>> {
    return this.connection.request("display.text", { text });
  }

  audioSelfTest(): Promise<Record<string, never>> {
    return this.connection.request("audio.self_test");
  }

  ggwaveSelfTest(): Promise<{ result: number }> {
    return this.connection.request("ggwave.self_test");
  }

  close(): Promise<void> {
    return this.connection.close();
  }
}
