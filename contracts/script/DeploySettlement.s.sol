// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;
// 
// import {MelodyPaySettlement} from "../src/MelodyPaySettlement.sol";
// 
// // Minimal Foundry Script interface to avoid external forge-std lib dependency
// abstract contract Script {
//     address private constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
// 
//     function vm() internal pure returns (Vm vm_) {
//         return Vm(VM_ADDRESS);
//     }
// }
// 
// interface Vm {
//     function startBroadcast() external;
//     function stopBroadcast() external;
//     function envOr(string calldata name, address defaultValue) external view returns (address);
// }
// 
// /**
//  * @title DeploySettlement
//  * @notice Foundry script for deploying MelodyPaySettlement to Arc Network Testnet.
//  * @dev Usage:
//  *      forge script script/DeploySettlement.s.sol:DeploySettlement --rpc-url https://rpc.testnet.arc.io --broadcast
//  */
// contract DeploySettlement is Script {
//     // Canonical Arc Genesis native USDC precompile
//     address public constant ARC_CANONICAL_USDC = 0x3600000000000000000000000000000000000000;
//     address payable public constant PROJECT_TREASURY = payable(0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF);
// 
//     function run() external returns (MelodyPaySettlement settlement) {
//         address usdc = vm().envOr("ARC_USDC_ADDRESS", ARC_CANONICAL_USDC);
//         address treasury = vm().envOr("TREASURY_ADDRESS", PROJECT_TREASURY);
// 
//         vm().startBroadcast();
// 
//         settlement = new MelodyPaySettlement(usdc, treasury);
// 
//         vm().stopBroadcast();
//     }
// }
