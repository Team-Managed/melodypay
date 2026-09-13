# MelodyPay Smart Contracts

This directory contains the testnet-only ENSv2 merchant subname registrar.
It does not custody customer payment funds and is unrelated to Arc USDC
`receiveWithAuthorization` settlement, which calls the canonical Arc USDC
contract directly.

## ENSv2 Setup

Install the official ENSv2 contracts before building:

```powershell
forge install ensdomains/contracts-v2
forge install foundry-rs/forge-std
forge build --root contracts
forge test --root contracts
```

The registrar requires a deployed ENSv2 UserRegistry whose owner grants it
`ROLE_REGISTRAR` and `ROLE_RENEW` on `ROOT_RESOURCE`. The parent name must
also point to that UserRegistry through `setSubregistry()`; otherwise names
will register but will not resolve.

## Deploy

Set these testnet environment variables:

```text
ENSV2_USER_REGISTRY=...
ENSV2_PAYMENT_TOKEN=...
ENSV2_BENEFICIARY=...
ENSV2_ANNUAL_PRICE=5000000
ENSV2_MIN_DURATION=2592000
```

Then deploy on Sepolia:

```powershell
forge script contracts/script/DeployRegistrar.s.sol:DeployRegistrar `
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com `
  --broadcast
```

## Claim A Subname

After deployment and role authorization, a user approves the testnet payment
token and registers a label. `ENSV2_OWNER` is the wallet that receives the
subname, and `ENSV2_RESOLVER` must be an ENSv2 Permissioned Resolver owned or
authorized by that wallet.

```text
ENSV2_REGISTRAR=...
ENSV2_LABEL=cafe
ENSV2_OWNER=...
ENSV2_RESOLVER=...
ENSV2_DURATION=31536000
```

```powershell
forge script contracts/script/RegisterSubname.s.sol:RegisterSubname `
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com `
  --broadcast
```

The parent `melodypay.eth` name has not yet been claimed on Sepolia. That
must be done first with the ENSv2 ETH Registrar, followed by UserRegistry and
resolver setup, before `cafe.melodypay.eth` can resolve.
