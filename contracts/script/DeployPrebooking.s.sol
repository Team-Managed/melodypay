// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MelodyPayPrebooking} from "../src/MelodyPayPrebooking.sol";

// Minimal Foundry Script interface to avoid external forge-std lib dependency
abstract contract Script {
    address private constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));

    function vm() internal pure returns (Vm vm_) {
        return Vm(VM_ADDRESS);
    }
}

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envOr(string calldata name, address defaultValue) external view returns (address);
}

/**
 * @title DeployPrebooking
 * @notice Foundry deployment script for MelodyPayPrebooking on Base Sepolia Testnet or Base Mainnet.
 * @dev Usage on Base Sepolia Testnet:
 *      forge script script/DeployPrebooking.s.sol:DeployPrebooking --rpc-url https://sepolia.base.org --broadcast
 *      Usage on Base Mainnet:
 *      forge script script/DeployPrebooking.s.sol:DeployPrebooking --rpc-url https://mainnet.base.org --broadcast
 */
contract DeployPrebooking is Script {
    // Official Circle Native USDC on Base Sepolia Testnet (Chain ID 84532)
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // Official Circle Native USDC on Base Mainnet (Chain ID 8453)
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    // MelodyPay Official Treasury Wallet
    address public constant PROJECT_TREASURY = 0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176;

    function run() external returns (MelodyPayPrebooking prebooking) {
        // Default to Base Sepolia testnet USDC
        address usdc = vm().envOr("USDC_ADDRESS", BASE_SEPOLIA_USDC);
        address treasury = vm().envOr("TREASURY_ADDRESS", PROJECT_TREASURY);

        vm().startBroadcast();

        prebooking = new MelodyPayPrebooking(usdc, treasury);

        vm().stopBroadcast();
    }
}
