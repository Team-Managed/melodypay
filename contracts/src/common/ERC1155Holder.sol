// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// NOTE: Commented out - Not used by MelodyPayPrebooking.sol (used only by legacy ENS registrar)
// abstract contract ERC1155Holder {
//     function onERC1155Received(
//         address,
//         address,
//         uint256,
//         uint256,
//         bytes memory
//     ) public virtual returns (bytes4) {
//         return this.onERC1155Received.selector;
//     }
// 
//     function onERC1155BatchReceived(
//         address,
//         address,
//         uint256[] memory,
//         uint256[] memory,
//         bytes memory
//     ) public virtual returns (bytes4) {
//         return this.onERC1155BatchReceived.selector;
//     }
// 
//     function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
//         return interfaceId == 0xd9b67a26  // ERC1155Receiver
//             || interfaceId == 0x01ffc9a7; // ERC165
//     }
// }
