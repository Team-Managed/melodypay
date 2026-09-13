type RpcRequest = {
  method?: string;
  body?: unknown;
};

type RpcResponse = {
  status: (code: number) => RpcResponse;
  setHeader: (name: string, value: string) => RpcResponse;
  send: (body: string) => void;
};

export default async function handler(req: RpcRequest, res: RpcResponse) {
  if (req.method !== "POST") {
    res.status(405).setHeader("allow", "POST").send(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const upstream = await fetch("https://rpc.testnet.arc.io", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });
    const body = await upstream.text();
    res.status(upstream.status).setHeader("content-type", "application/json").send(body);
  } catch (error) {
    res.status(502).setHeader("content-type", "application/json").send(JSON.stringify({
      error: error instanceof Error ? error.message : "Arc RPC unavailable",
    }));
  }
}
