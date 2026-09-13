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

For `melodypay.eth`, use the ENSv2 Sepolia deployment addresses:

```text
ENSV2_OWNER=0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF
ENSV2_FACTORY=0x118bc31a50d559f7015a8da26d54b3b030cdb70f
ENSV2_USER_REGISTRY_IMPL=0x840fa461059862ea466a711e8c98c8de732061c0
ENSV2_RESOLVER_IMPL=0x7e4b2d59938930168024201752ee5503df402303
ENSV2_PARENT_REGISTRY=0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2
ENSV2_PARENT_LABEL=melodypay
ENSV2_PARENT_NAMEHASH=0x...
```

Compute `ENSV2_PARENT_NAMEHASH` as the ENS namehash of `melodypay.eth`.
The setup script deploys the UserRegistry and Permissioned Resolver, connects
the registry to `melodypay.eth`, deploys the MelodyPay registrar, and grants
the registrar registration/renewal roles:

```powershell
forge script contracts/script/SetupENSv2.s.sol:SetupENSv2 `
  --account melodypay-owner `
  --sender 0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF `
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com `
  --broadcast
```

The deployed Sepolia setup is:

```text
UserRegistry: 0xa1FAdf6a4c12b15Ea035Bb7E4dC821954f98e625
Resolver:     0x12d047B84F4bDCbacD975E21CA0297e5A53A051e
Registrar:    0xFB5508Dd6024D2Efd30D03c7be080F1521D976C8
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

`melodypay.eth` and `cafe.melodypay.eth` are now registered on Sepolia and
`cafe.melodypay.eth` resolves to the MelodyPay receiving address with Arc/USDC
profile records.
