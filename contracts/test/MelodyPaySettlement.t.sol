// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// pragma solidity ^0.8.24;
// 
// import {MelodyPaySettlement} from "../src/MelodyPaySettlement.sol";
// import {IMelodyPaySettlement} from "../src/interfaces/IMelodyPaySettlement.sol";
// 
// interface Vm {
//     function warp(uint256 newTimestamp) external;
//     function prank(address msgSender) external;
// }
// 
// contract MelodyPaySettlementTest {
//     address private constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
//     Vm internal constant vm = Vm(VM_ADDRESS);
// 
//     address internal constant ARC_CANONICAL_USDC = 0x3600000000000000000000000000000000000000;
//     address payable internal constant PROJECT_TREASURY = payable(0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF);
// 
//     MelodyPaySettlement internal settlement;
//     address internal alice;
//     address internal bob;
// 
//     function setUp() public {
//         alice = address(0xA11CE);
//         bob = address(0xB0B);
// 
//         settlement = new MelodyPaySettlement(ARC_CANONICAL_USDC, PROJECT_TREASURY);
//     }
// 
//     function test_InitialState() public view {
//         require(address(settlement.usdcToken()) == ARC_CANONICAL_USDC, "usdcToken mismatch");
//         require(address(settlement.usdcAuthorization()) == ARC_CANONICAL_USDC, "usdcAuth mismatch");
//         require(settlement.defaultTreasury() == PROJECT_TREASURY, "treasury mismatch");
//         require(settlement.owner() == address(this), "owner mismatch");
//         require(!settlement.paused(), "should not be paused initially");
//     }
// 
//     function test_SetDefaultTreasury() public {
//         address newTreasury = address(0x9999);
//         settlement.setDefaultTreasury(newTreasury);
//         require(settlement.defaultTreasury() == newTreasury, "treasury update failed");
//     }
// 
//     function test_SetDefaultTreasury_RevertZeroAddress() public {
//         try settlement.setDefaultTreasury(address(0)) {
//             revert("Expected revert on zero address");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(errorSelector == IMelodyPaySettlement.ZeroAddress.selector, "Wrong error selector");
//         }
//     }
// 
//     function test_PauseAndUnpause() public {
//         settlement.pause();
//         require(settlement.paused(), "should be paused");
//         settlement.unpause();
//         require(!settlement.paused(), "should be unpaused");
//     }
// 
//     function test_NonOwnerCannotModifySettings() public {
//         vm.prank(alice);
//         try settlement.pause() {
//             revert("Non-owner should not be able to pause");
//         } catch {}
// 
//         vm.prank(alice);
//         try settlement.setDefaultTreasury(alice) {
//             revert("Non-owner should not be able to set treasury");
//         } catch {}
//     }
// 
//     function test_ValidationReverts_ZeroAmount() public {
//         try settlement.settlePayment(
//             alice,
//             bob,
//             0, // zero amount
//             0,
//             block.timestamp + 100,
//             bytes32(uint256(1)),
//             bytes32(0),
//             0,
//             bytes32(0),
//             bytes32(0)
//         ) {
//             revert("Expected revert on zero amount");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(errorSelector == IMelodyPaySettlement.ZeroAmount.selector, "Wrong error selector");
//         }
//     }
// 
//     function test_ValidationReverts_Expired() public {
//         uint256 expiredTime = block.timestamp - 1;
//         try settlement.settlePayment(
//             alice,
//             bob,
//             1_000_000,
//             0,
//             expiredTime,
//             bytes32(uint256(1)),
//             bytes32(0),
//             0,
//             bytes32(0),
//             bytes32(0)
//         ) {
//             revert("Expected revert on expired authorization");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(errorSelector == IMelodyPaySettlement.AuthorizationExpired.selector, "Wrong error selector");
//         }
//     }
// 
//     function test_ValidationReverts_NotYetValid() public {
//         uint256 futureTime = block.timestamp + 1000;
//         try settlement.settlePayment(
//             alice,
//             bob,
//             1_000_000,
//             futureTime,
//             futureTime + 100,
//             bytes32(uint256(1)),
//             bytes32(0),
//             0,
//             bytes32(0),
//             bytes32(0)
//         ) {
//             revert("Expected revert on not yet valid authorization");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(errorSelector == IMelodyPaySettlement.AuthorizationNotYetValid.selector, "Wrong error selector");
//         }
//     }
// 
//     function test_TwoStepOwnershipTransfer() public {
//         settlement.transferOwnership(alice);
//         require(settlement.owner() == address(this), "owner should not change before acceptance");
//         require(settlement.pendingOwner() == alice, "pending owner should be alice");
// 
//         vm.prank(alice);
//         settlement.acceptOwnership();
//         require(settlement.owner() == alice, "owner should now be alice");
//         require(settlement.pendingOwner() == address(0), "pending owner should be cleared");
//     }
// }
