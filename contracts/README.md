# MelodyPay Smart Contracts

All Solidity code belongs in this directory. The current MVP does not require a smart contract: it supports native EVM transfers and restricts ERC-20 handling to standard `transfer(address,uint256)` calls on verified token profiles.

Do not add EIP-3009, approvals, swaps, or arbitrary calldata here without a new protocol and security review. Future contracts should use a standard Solidity project layout under `contracts/src/`, with tests and deployment scripts kept inside this directory.
