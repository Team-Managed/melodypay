# MelodyPay Arc, ENSv2, and Ledger Design

## Goal

Extend MelodyPay into a finalist-track-ready hardware payment product with Arc USDC EIP-3009 payments, ENSv2 merchant identity, Ledger signer compatibility, and a real ENSv2 subname registrar contract.

## Qualification Position

ETHGlobal's general rules do not require every finalist to contain custom Solidity. The contract is included because it is a meaningful ENSv2 integration, not as placeholder code. The project remains a Continuity submission and must disclose the pre-existing PWA and the new work separately.

## Sponsor Bundle

### Arc + USDC

Arc Testnet uses chain ID `5042002`. The official Arc USDC contract is `0x3600000000000000000000000000000000000000`. Arc's official implementation exposes canonical EIP-3009 methods and constants:

- `transferWithAuthorization`
- `receiveWithAuthorization`
- `authorizationState`
- `cancelAuthorization`
- `DOMAIN_SEPARATOR`
- `TRANSFER_WITH_AUTHORIZATION_TYPEHASH`
- `RECEIVE_WITH_AUTHORIZATION_TYPEHASH`

Live RPC verification confirmed the official EIP-3009 typehash values. Arc USDC uses 6 decimals through its ERC-20 interface; Arc's native USDC gas accounting uses 18-decimal precision. The product must keep these representations separate.

MelodyPay uses `receiveWithAuthorization` so the merchant receiver can submit the authorization and pay Arc gas. The hardware device signs EIP-712 data, not arbitrary calldata.

### ENSv2

ENSv2 is currently on Sepolia. Merchants receive human-readable subnames such as `cafe.melodypay.eth`. The receiver resolves the name, verifies the address, and displays both the name and full resolved address before creating a payment request.

ENSv2 text records store payment metadata such as supported chain, token, and receiver profile. Permissioned Resolver roles control profile writes. Resolution remains read-only in the receiver; the hardware wallet signs the resolved address and never trusts the name alone.

### Ledger

The CLI gains a Ledger signer backend using Ledger Device Management Kit / Ethereum signer tooling. This is an optional compatibility path while the ESP32 signer is experimental:

```text
MelodyPay signer backend = ESP32 sound wallet | Ledger clear-signing device
```

The receiver remains keyless. Ledger is used on the payer/operator side only and must visibly confirm the same chain, token, recipient, amount, and expiry shown by MelodyPay.

## Smart Contracts

MelodyPay utilizes two specialized contracts across chains:

1. `contracts/src/MelodyPaySubnameRegistrar.sol` (Ethereum Sepolia):
   Registers and renews merchant subnames (e.g. `cafe.melodypay.eth`) under `melodypay.eth` via official ENS NameWrapper. Collects a 1.0 USDC or native ETH registration fee (via Chainlink AggregatorV3 price feed) forwarded directly to project treasury (`0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`), issues emancipated ERC-1155 wrapped subnames (`PARENT_CANNOT_CONTROL = 65536`), configures PublicResolver forward records, and emits `NameRegistered` / `NameRenewed` events.

2. `contracts/src/MelodyPaySettlement.sol` (Arc Network):
   Settles acoustic sound payments authorized via EIP-3009 using Arc's canonical native USDC precompile (`0x3600000000000000000000000000000000000000`). Provides POS invoice/order tracking (`orderId => settlement nonce`), dual replay protection, and emits `SoundPaymentSettled` receipt events for terminals and printers. Supports both direct peer-to-peer (`transferWithAuthorization`) and receiver-routed (`receiveWithAuthorization`) settlement.

The contracts are non-custodial and do not store customer funds. ENS remains the source of truth for identity, while Arc settles payments natively.

## End-to-end Flow

```text
Merchant registers cafe.melodypay.eth on ENSv2 Sepolia
  -> resolver records Arc + USDC + merchant address

Receiver resolves merchant name and verifies address
  -> fetches Arc nonce/fee context and creates EIP-3009 authorization request

ESP32 or Ledger signer reviews typed data
  -> signs EIP-712 authorization after explicit approval

Receiver submits USDC.receiveWithAuthorization()
  -> Arc settles payment and emits AuthorizationUsed/Transfer
```

## Security Rules

- Never copy NONET's custom personal-sign contract.
- Use the canonical EIP-712 domain: token name, version, chain ID, verifying contract.
- Use per-authorizer random authorization nonces.
- Enforce `validBefore` and a short payment TTL.
- Use `receiveWithAuthorization` for merchant submission.
- Display the resolved address, not only the ENS name.
- Reject unknown token contracts and unknown chain IDs on the ESP32.
- Keep the receiver keyless.
- Keep the ESP32 production signer fail-closed until a reviewed secure-element backend exists.
- Never use the test registrar or MockUSDC for real value.

## Non-goals

- No EIP-3009 custom token deployed as a production asset.
- No arbitrary contract calls from the hardware wallet.
- No swaps, approvals, bridges, or Permit2 in the first integration.
- No Ledger dependency in the core ESP32 product path.
- No claim that ENSv2, Arc, or Ledger integration is production-secure before live tests and review.

## Evidence Required

- Sepolia transaction registering a MelodyPay merchant subname.
- Resolver records and a receiver lookup showing the verified merchant address.
- Arc Testnet EIP-3009 authorization with `AuthorizationUsed` and `Transfer` evidence.
- Hardware/Ledger review screen or clear-signing confirmation.
- Receiver/CLI output proving it paid gas and accepted the authorization.
- Public repo, architecture diagram, continuity disclosure, and sponsor-specific demo clips.
