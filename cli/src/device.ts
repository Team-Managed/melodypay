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

export interface WalletAddress {
  address: string;
}

export interface SignedTransaction {
  raw_transaction: string;
}

export interface CryptoSelfTestResult {
  status: "passed" | "failed";
}

export interface NativeTransferSignRequest extends Record<string, unknown> {
  chain_id: string;
  nonce: string;
  max_priority_fee_per_gas: string;
  max_fee_per_gas: string;
  gas_limit: string;
  to: string;
  value: string;
  data: "0x";
  timeout_seconds?: number;
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

  configureChain(chainId: number): Promise<{ active_chain_id: number; name: string; symbol: string }> {
    return this.connection.request("wallet.configure", { chain_id: chainId });
  }

  address(): Promise<WalletAddress> {
    return this.connection.request("wallet.address");
  }

  cryptoSelfTest(): Promise<CryptoSelfTestResult> {
    return this.connection.request("wallet.crypto_self_test");
  }

  signEip1559(request: NativeTransferSignRequest): Promise<SignedTransaction> {
    return this.connection.request("wallet.sign", request);
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

  waitForApproval(timeoutSeconds = 10): Promise<{ decision: "approved" | "timeout" }> {
    return this.connection.request("wallet.wait_approval", { timeout_seconds: timeoutSeconds });
  }

  close(): Promise<void> {
    return this.connection.close();
  }
}
