// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;
// 
// import {MelodyPaySubnameRegistrar} from "../src/MelodyPaySubnameRegistrar.sol";
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
//     function envOr(string calldata name, bytes32 defaultValue) external view returns (bytes32);
// }
// 
// /**
//  * @title DeployRegistrar
//  * @notice Foundry script for deploying MelodyPaySubnameRegistrar to Ethereum Sepolia.
//  * @dev Usage:
//  *      forge script script/DeployRegistrar.s.sol:DeployRegistrar --rpc-url sepolia --broadcast
//  */
// contract DeployRegistrar is Script {
//     // Official ENS contracts on Sepolia
//     address public constant SEPOLIA_NAME_WRAPPER = 0x0635513f179D50A207757E05759CbD106d7dFcE8;
//     address public constant SEPOLIA_PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;
//     address public constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
//     address public constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
//     address payable public constant PROJECT_TREASURY = payable(0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF);
// 
//     function run() external returns (MelodyPaySubnameRegistrar registrar) {
//         // Calculate namehash of "melodypay.eth"
//         bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256(bytes("eth"))));
//         bytes32 melodypayNode = keccak256(abi.encodePacked(ethNode, keccak256(bytes("melodypay"))));
// 
//         address nameWrapper = vm().envOr("ENS_NAME_WRAPPER", SEPOLIA_NAME_WRAPPER);
//         address resolver = vm().envOr("ENS_RESOLVER", SEPOLIA_PUBLIC_RESOLVER);
//         address priceFeed = vm().envOr("CHAINLINK_FEED", SEPOLIA_ETH_USD_FEED);
//         address usdc = vm().envOr("USDC_ADDRESS", SEPOLIA_USDC);
//         bytes32 rootNode = vm().envOr("ROOT_NODE", melodypayNode);
// 
//         vm().startBroadcast();
// 
//         registrar = new MelodyPaySubnameRegistrar(
//             rootNode,
//             usdc,
//             nameWrapper,
//             resolver,
//             priceFeed,
//             PROJECT_TREASURY
//         );
// 
//         vm().stopBroadcast();
//     }
// }
