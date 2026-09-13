# MelodyPay Pre-Booking & Priority Waitlist Smart Contract Design

**Date**: 2026-09-13  
**Status**: Approved  
**Target Network**: Base Mainnet (Chain ID `8453`)  
**Payment Asset**: Canonical Circle USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)  
**Pre-Booking Price**: 1.00 USDC (`1_000_000` units, 6 decimals)  
**Treasury Recipient**: `0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`  

---

## 1. Executive Summary

MelodyPay is replacing the legacy ENS subname registrar with a streamlined, high-conversion **Pre-Booking & Priority Waitlist Smart Contract** (`MelodyPayPrebooking.sol`). 

Users pay **1 USDC** on Base Mainnet to secure first-batch hardware allocation for the ESP32-S3 air-gapped acoustic sound wallet. The contract maintains the authoritative on-chain count of pre-booked users (`totalPrebookings`) and assigns sequential queue numbers (`#001`, `#002`, ...). 

User emails remain **100% off-chain** for strict privacy. Upon on-chain confirmation, an automated confirmation email with subject **`Prebooked`** is dispatched via Resend, and the user is redirected to the `/receipt` page where the photorealistic thermal POS printer outputs an elongated receipt stamped with their queue number and payment proof.

---

## 2. Architecture & Invariants

```
               [ User Web Browser ]
                         |
       1. Approve 1 USDC | 2. Calls prebook()
                         v
       [ MelodyPayPrebooking.sol on Base ]
                         |
      -----------------------------------------
      |                                       |
      | 1 USDC SafeERC20                      | State updates:
      v                                       | - totalPrebookings += 1
[ MelodyPay Treasury ]                        | - userQueueNumber[user] = queueNumber
0x0E69...BCF                                  | Emits:
                                              | - Prebooked(queueNumber, user, 1e6, block.timestamp)
                         |
                         v
        [ On-Chain Confirmation in Browser ]
                         |
        -----------------------------------
        |                                 |
        v                                 v
[ Resend Email Dispatcher ]     [ Thermal Receipt Page ]
Subject: "Prebooked"            /receipt with Queue #
Body: Queue #, Tx Hash, Base    "PAID WITH MELODYPAY"
```

### Core Invariants:
1. **Zero-Custody Treasury Settlement**: 100% of the 1 USDC pre-booking fee is transferred directly from `msg.sender` to the immutable `treasury` address (`0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`). The contract holds zero balance.
2. **Deterministic Monotonic Queue**: `totalPrebookings` starts at `0` and increments by exactly `1` on every valid pre-booking. The assigned `queueNumber` is permanent and irreversible.
3. **Double-Booking Policy**: Configured to ensure 1 hardware reservation per wallet (`require(userQueueNumber[msg.sender] == 0, "Already prebooked")`), with an optional batch-booking override if configured.
4. **Absolute Privacy**: Zero email strings, IPFS hashes, or personal identifiers are stored or emitted on-chain.
5. **Emergency Circuit Breaker**: Standard OpenZeppelin `Pausable` and `Ownable2Step` allow the contract owner to pause deposits in emergency scenarios.

---

## 3. Smart Contract Specification (`MelodyPayPrebooking.sol`)

### 3.1 Interfaces & Dependencies
- `IERC20`: Standard ERC-20 interface for Base USDC (`transferFrom`, `balanceOf`).
- `SafeERC20`: OpenZeppelin safe wrapper against non-standard return values.
- `Ownable2Step`: Secure 2-step ownership transfer.
- `Pausable`: Circuit breaker mechanism.
- `ReentrancyGuard`: Guard against reentrant calls during token transfer.

### 3.2 State Variables
```solidity
IERC20 public immutable usdc;
address public immutable treasury;
uint256 public constant PREBOOK_PRICE = 1_000_000; // 1.00 USDC (6 decimals)

uint256 public totalPrebookings;
mapping(address => uint256) public userQueueNumber;
mapping(uint256 => address) public queueUser;
```

### 3.3 Events
```solidity
event Prebooked(
    uint256 indexed queueNumber,
    address indexed user,
    uint256 amount,
    uint256 timestamp
);
```

### 3.4 Key Functions
- `function prebook() external nonReentrant whenNotPaused returns (uint256 queueNumber)`:
  - Verifies user has not already pre-booked.
  - Executes `usdc.safeTransferFrom(msg.sender, treasury, PREBOOK_PRICE)`.
  - Increments `totalPrebookings`.
  - Records `userQueueNumber[msg.sender] = queueNumber` and `queueUser[queueNumber] = msg.sender`.
  - Emits `Prebooked`.
- `function getQueueCount() external view returns (uint256)`:
  - Returns `totalPrebookings` for live frontend counter display.
- `function getUserQueue(address user) external view returns (uint256)`:
  - Returns user's assigned queue number, or `0` if not pre-booked.

---

## 4. Email Handling Specification (Resend)

- **Provider**: Resend (`https://api.resend.com/emails`)
- **Subject**: `Prebooked`
- **Sender**: `MelodyPay <prebook@melodypay.eth>` or verified sending domain (with graceful local fallback).
- **Template Payload**:
  ```json
  {
    "to": "user@example.com",
    "subject": "Prebooked",
    "html": "..."
  }
  ```
- **Email Content**:
  - Congratulations banner on reserving the ESP32-S3 air-gapped sound terminal.
  - Prominent **Queue Number Badge**: e.g., `#042`.
  - **Payment Proof**: 1.00 USDC on Base Mainnet.
  - **Transaction Hash**: Direct hyperlink to `https://basescan.org/tx/{txHash}`.
  - **Wallet Address**: Truncated payer address (`0x36aF...509A`).
  - Next Steps: Notification that priority manufacturing updates will be sent to this email before general public release.

---

## 5. Web Application Integration

### 5.1 Pre-Booking Page (`Register.tsx` → Pre-Book Flow)
- Form inputs:
  - Wallet connection button (auto-detects Base network `8453`, prompt to switch if on another chain).
  - Email input field with validation.
  - Price indicator: `1.00 USDC` on Base Mainnet.
  - Live waitlist counter banner: `"Join X early builders already in queue"`.
- Action:
  1. Checks USDC allowance; if `< 1_000_000`, requests 1-click `approve`.
  2. Calls `prebook()` on `MelodyPayPrebooking`.
  3. Awaits transaction receipt; parses `Prebooked` event for `queueNumber`.
  4. Triggers Resend email dispatch with subject `Prebooked`.
  5. Saves `melodypay_last_receipt` in `localStorage` and navigates to `/receipt`.

### 5.2 Receipt Page (`PaymentReceipt.tsx`)
- Displays the photorealistic thermal POS printer with smooth mechanical paper feed animation.
- Header: `MELODYPAY PAYMENT RECEIPT`.
- Status: `✓ PRE-BOOKING CONFIRMED & QUEUE ALLOCATED`.
- Amount: `1.00 USDC`.
- Metadata rows:
  - `RECEIPT NO:` `WAITLIST-BASE-{queueNumber}`
  - `QUEUE POSITION:` `#{queueNumber}`
  - `DATE & TIME:` ISO formatted timestamp.
  - `SETTLEMENT ASSET:` `Native USDC`.
  - `NETWORK:` `Base Mainnet (8453)`.
  - `PAYER WALLET:` Truncated user address.
  - `MERCHANT VAULT:` `0x0E69...BCF`.
  - `TX HASH:` Truncated hash with BaseScan external link.
- Footer: `PAID WITH MELODYPAY`.

---

## 6. Testing & Quality Assurance

1. **Foundry Smart Contract Tests (`contracts/test/MelodyPayPrebooking.t.sol`)**:
   - Tests successful 1 USDC pre-booking with SafeERC20 transfer to treasury.
   - Tests queue increment from 1 to N.
   - Tests double-booking prevention.
   - Tests allowance and balance failure scenarios.
   - Tests pause/unpause emergency controls.
2. **Vitest Web Integration Tests (`tests/prebooking-flow.test.ts`)**:
   - Validates prebooking schema, email dispatch payload structure, subject (`Prebooked`), and receipt formatting.
