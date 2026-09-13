# MelodyPay Smart Contracts

This directory contains the smart contract architecture for MelodyPay.

## Contracts

### 1. ENS Merchant Subname Registrar (Ethereum Sepolia)
- **Contract**: `src/MelodyPaySubnameRegistrar.sol`
- **Purpose**: Issues verifiable merchant identities under `melodypay.eth` (e.g. `cafe.melodypay.eth`) as ERC-1155 wrapped NFTs using the official ENS NameWrapper (`0x0635513f179D50A207757E05759CbD106d7dFcE8`).
- **Payment Options**: Dual payment support for 1.0 USDC (6 decimals) or native ETH via Chainlink AggregatorV3 (`0x694AA1769357215DE4FAC081bf1f309aDC325306`), with exact refunds for excess native payment.
- **Treasury / Beneficiary**: Proceeds forward directly to `0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`.
- **Fuses**: Subnames are minted with `PARENT_CANNOT_CONTROL` (fuse `65536`), granting merchants complete autonomy over their subname records.
- **Resolver**: Configures the default public resolver (`0x8FADE66B79cC9f707aB26799354482EB93a5B7dD`) to resolve forward address queries to the merchant's payment address.

### 2. Acoustic Sound Settlement Contract (Arc Network)
- **Contract**: `src/MelodyPaySettlement.sol`
- **Purpose**: Settles acoustic sound payments authorized via EIP-3009 using Arc's canonical native USDC precompile (`0x3600000000000000000000000000000000000000`).
- **POS Integration**: Provides POS invoice/order tracking (`orderId => settlement nonce`), dual replay protection, and emits `SoundPaymentSettled` receipt events for terminals and printers.
- **Dual Flow**: Supports direct peer-to-peer (`transferWithAuthorization`) and receiver-routed (`receiveWithAuthorization`) settlement.

### 3. Priority Hardware Waitlist Pre-Booking (Base Mainnet)
- **Contract**: `src/MelodyPayPrebooking.sol`
- **Deployed Address (Base Mainnet)**: [`0x06E86FeeAdd4c0767080235fa82EF87e0fBBCcff`](https://basescan.org/address/0x06E86FeeAdd4c0767080235fa82EF87e0fBBCcff)
- **Deployment Transaction**: [`0x9b61462fc75d84632e4a2e6ca7767bd7d54a7b1536f4656dc9a9a68d3ee987a5`](https://basescan.org/tx/0x9b61462fc75d84632e4a2e6ca7767bd7d54a7b1536f4656dc9a9a68d3ee987a5)
- **Purpose**: Fixed-price (1.00 USDC) non-custodial pre-booking and priority waitlist contract for the MelodyPay HardWallet (Air-Gapped Acoustic Sound Terminal).
- **Treasury Recipient**: Proceeds forward directly to `0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF`.
- **On-Chain Queue Count**: Maintains monotonic `totalPrebookings` counter and assigns sequential queue numbers (`#001`, `#002`, ...).
- **Privacy**: User emails remain 100% off-chain; confirmation emails with subject `Prebooked` are dispatched off-chain.

## Testing

Run the test suite:
```bash
# Run unit tests
forge test --root contracts

# Run Sepolia fork tests
forge test --root contracts --fork-url https://ethereum-sepolia-rpc.publicnode.com
```

## Deployment

Deploy the hardware pre-booking contract to Base Mainnet:
```bash
forge script script/DeployPrebooking.s.sol:DeployPrebooking --rpc-url https://mainnet.base.org --broadcast
```

Deploy the subname registrar to Sepolia:
```bash
forge script script/DeployRegistrar.s.sol:DeployRegistrar --rpc-url sepolia --broadcast
```

Deploy the settlement contract to Arc Testnet:
```bash
forge script script/DeploySettlement.s.sol:DeploySettlement --rpc-url https://rpc.testnet.arc.io --broadcast
```
