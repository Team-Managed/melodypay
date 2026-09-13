# MelodyPay

> Sound-based crypto payments on the Monad testnet. Sign transactions completely offline and broadcast them over audio.

## Hardware Wallet Track

The original PWA is the proof of concept for MelodyPay's receiver-driven sound payment flow. The current Continuity-track work moves signing onto an ESP32-S3 hardware wallet:

- Keyless online receiver requests chain, amount, nonce, and fees.
- Offline wallet displays the payment and requires a physical approval.
- Signed EVM transactions return over ggwave audio.
- Receiver validates and broadcasts without holding the sender's private key.

See `docs/architecture.md`, `docs/hardware-wiring.md`, and `docs/demo-script.md` for the new work. The firmware is currently a development scaffold and is not safe for real funds.

MelodyPay is a PWA that enables air-gapped cryptocurrency transactions on the **Monad testnet** using [ggwave](https://github.com/ggerganov/ggwave) — an open-source data-over-sound library. The sender keeps their private key completely offline while the receiver (with internet access) handles broadcasting the final signed transaction to the chain.

**Live Demo:** [melody-pay.vercel.app](https://melody-pay.vercel.app)

---

## How It Works

MelodyPay splits the transaction flow across two roles — a **Sender** (offline) and a **Receiver** (online):

```
Sender (Air-Gapped)                Receiver (Online)
   │                                  │
   │  1. Broadcasts wallet address    │  Listening for sender...
   │─────────────────────────────────▶│
   │                                  │  2. Fetches nonce from Monad
   │                                  │  3. Broadcasts PAY|addr|amount|nonce
   │◀─────────────────────────────────│
   │  4. Signs tx OFFLINE (no network)│
   │  5. Broadcasts signed tx chunks  │
   │─────────────────────────────────▶│
   │                                  │  6. Reassembles chunks
   │                                  │  7. Verifies + submits to Monad
   │                                  │  8. Confirmed in <1 second
```

**Key properties:**
- The private key **never touches the internet**. All signing is done in-browser using only ethers.js.
- Nonce is fetched automatically — sender doesn't need to know it.
- Large signed transactions are split into chunks (TX1/N, TX2/N) to fit ggwave's 140-byte limit.
- Built on Monad testnet (Chain ID `10143`) with ~400ms blocks and sub-second finality.

---

## Historical AI Agent Mode (A2A)

MelodyPay includes an **agent-to-agent** demo where two AI agents transact over sound:

```
Customer Agent                     Barista Agent
   │                                  │  Listening...
   │  "Hi, I'll have a latte"        │
   │─────────────────────────────────▶│
   │                                  │  Gemini LLM: "That'll be 1.2 MON"
   │◀─────────────────────────────────│
   │  LLM decides to pay             │
   │  Broadcasts ADDR|0x...          │
   │─────────────────────────────────▶│
   │                                  │  Fetches nonce, broadcasts PAY
   │◀─────────────────────────────────│
   │  Signs & broadcasts signed tx   │
   │─────────────────────────────────▶│
   │                                  │  Submits to Monad ✅
   │                                  │  "Enjoy your coffee!"
   │◀─────────────────────────────────│
```

- **Barista Agent** — historical AI-powered barista demo that took orders and received MON payments
- **Customer Agent** — historical AI customer demo that ordered coffee and paid automatically
- This mode is not part of the current `receiver-web` client and does not require Gemini
- Half-duplex turn-taking over ggwave — same sound protocol as manual payments

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Routing | React Router v6 |
| Animation | Framer Motion 12, GSAP 3 |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Audio Protocol | ggwave (WASM) |
| Blockchain | ethers.js v6 → Monad Testnet |
| PWA | vite-plugin-pwa (offline support) |

---

## Project Structure

```
melody-pay/
├── receiver-web/            # React landing page + keyless payment receiver
│   ├── src/                 # Web application source
│   └── README.md
├── cli/                     # Interactive keyless operator terminal
├── esp32/                   # ESP-IDF hardware-wallet firmware
├── contracts/               # Solidity-only workspace
├── index.html               # Web entry point — loads ggwave.js globally
├── vite.config.ts           # Vite + PWA config
├── tailwind.config.js       # Tailwind theme
├── .env                     # local environment values (not committed)
├── public/
│   ├── ggwave.js            # ggwave WASM library
│   └── icons/               # PWA icons
└── receiver-web/src/
    ├── main.tsx             # React bootstrap
    ├── App.tsx              # Landing + receiver routes
    ├── components/          # UI components
    │   ├── InstallPrompt.tsx  # PWA install banner
    │   ├── Copy.tsx           # Animated text reveal
    │   ├── GsapColorCycle.tsx # Color-cycling animation
    │   └── TextSwap.tsx       # Word swap animation
    ├── core/                # Receiver audio and validation logic
    │   ├── ggwave.ts        # ggwave WASM wrapper (encode/decode)
    │   ├── broadcaster.ts   # Speaker output (play, playLoop, playChunked)
    │   ├── listener.ts      # Mic input (listen, chunkedListen)
    │   ├── tx-builder.ts    # Multi-chain validation and broadcasting
    │   ├── chains.ts        # Whitelisted EVM profiles
    │   └── payment-protocol.ts
    └── pages/
        ├── Home.tsx           # Landing page
        └── ReceivePayment.tsx # Keyless online receiver
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/kunalshah017/melody-pay.git
cd melody-pay
npm install
```

Create `.env`:
```
# Server-only email credentials. These must never use the VITE_ prefix.
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=sender@example.com
RESEND_API_KEY=your_resend_api_key

# Public client configuration. VITE_* values are visible in the browser.
VITE_PREBOOKING_CONTRACT_ADDRESS=0x06E86FeeAdd4c0767080235fa82EF87e0fBBCcff
```

Run:
```bash
npm run dev
```

Open at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Audio Protocol

| Message | Format | Direction |
|---|---|---|
| Sender address | `ADDR\|0xAbCd...` | Sender → Receiver |
| Payment request | `PAY\|<to>\|<amount>\|<nonce>` | Receiver → Sender |
| Signed tx chunk | `TX1/2\|<hex_data>` | Sender → Receiver |
| Agent message | `MSG\|<text>` | Either → Either |

- Max payload per ggwave burst: **140 bytes**
- Protocol: `GGWAVE_PROTOCOL_AUDIBLE_FASTEST` (~2.3s for 53 chars)
- Large signed transactions (~240 chars) split into 2 chunks

---

## Monad Testnet Config

```
Chain ID:     10143
RPC:          https://testnet-rpc.monad.xyz
Explorer:     https://testnet.monadscan.com
Gas:          150 gwei maxFeePerGas (Monad charges on gas_limit)
Block time:   ~400ms
Finality:     ~800ms
```

---

## Why Monad?

- **Sub-second finality** — hear the sound, see confirmation almost instantly
- **Near-zero gas** — micro-transactions via sound are practical
- **10,000 TPS** — handles many simultaneous sound-based payments
- **Charges on gas_limit** — we hardcode 21000 for transfers, keeping costs minimal

---

## Built for Monad Blitz Mumbai V3
