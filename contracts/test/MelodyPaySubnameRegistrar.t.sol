// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// pragma solidity ^0.8.24;
// 
// import {MelodyPaySubnameRegistrar} from "../src/MelodyPaySubnameRegistrar.sol";
// import {IMelodyPaySubnameRegistrar} from "../src/interfaces/IMelodyPaySubnameRegistrar.sol";
// import {IERC20} from "../src/interfaces/IERC20.sol";
// import {INameWrapper} from "../src/interfaces/INameWrapper.sol";
// import {IAddrResolver} from "../src/interfaces/IAddrResolver.sol";
// import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";
// 
// interface Vm {
//     function warp(uint256 newTimestamp) external;
//     function roll(uint256 newBlockNumber) external;
//     function prank(address msgSender) external;
//     function startPrank(address msgSender) external;
//     function stopPrank() external;
//     function deal(address account, uint256 newBalance) external;
//     function createSelectFork(string calldata urlOrAlias) external returns (uint256);
// }
// 
// contract MelodyPaySubnameRegistrarTest {
//     address private constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
//     Vm internal constant vm = Vm(VM_ADDRESS);
// 
//     // Sepolia Verified Addresses
//     address internal constant SEPOLIA_NAME_WRAPPER = 0x0635513f179D50A207757E05759CbD106d7dFcE8;
//     address internal constant SEPOLIA_PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;
//     address internal constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
//     address internal constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
//     address payable internal constant PROJECT_TREASURY = payable(0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF);
// 
//     MelodyPaySubnameRegistrar internal registrar;
//     bytes32 internal rootNode;
//     address internal owner;
//     address internal alice;
//     address internal bob;
// 
//     function setUp() public {
//         owner = address(this);
//         alice = address(0xA11CE);
//         bob = address(0xB0B);
// 
//         bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256(bytes("eth"))));
//         rootNode = keccak256(abi.encodePacked(ethNode, keccak256(bytes("melodypay"))));
// 
//         registrar = new MelodyPaySubnameRegistrar(
//             rootNode,
//             SEPOLIA_USDC,
//             SEPOLIA_NAME_WRAPPER,
//             SEPOLIA_PUBLIC_RESOLVER,
//             SEPOLIA_ETH_USD_FEED,
//             PROJECT_TREASURY
//         );
//     }
// 
//     // --- Availability & Label Validation Tests ---
// 
//     function test_LabelValidation_ValidLabels() public view {
//         // Correct labels should pass format checks (they will return true if not taken)
//         // In local non-fork tests, NameWrapper returns (0, 0, 0), so available returns true
//         require(registrar.isAvailable("cafe"), "cafe should be valid");
//         require(registrar.isAvailable("store-1"), "store-1 should be valid");
//         require(registrar.isAvailable("merch123"), "merch123 should be valid");
//     }
// 
//     function test_LabelValidation_TooShort() public view {
//         require(!registrar.isAvailable("a"), "single char too short");
//         require(!registrar.isAvailable("ab"), "2 chars too short");
//     }
// 
//     function test_LabelValidation_TooLong() public view {
//         require(
//             !registrar.isAvailable("abcdefghijklmnopqrstuvwxyz01234567"), // 33 chars
//             "label > 32 chars should not be available"
//         );
//     }
// 
//     function test_LabelValidation_DisallowedCharacters() public view {
//         require(!registrar.isAvailable("Cafe"), "uppercase should be rejected");
//         require(!registrar.isAvailable("cafe_shop"), "underscore should be rejected");
//         require(!registrar.isAvailable("cafe.eth"), "dots should be rejected");
//         require(!registrar.isAvailable("cafe!"), "punctuation should be rejected");
//         require(!registrar.isAvailable("cafe shop"), "space should be rejected");
//     }
// 
//     // --- Admin Configuration & Security Tests ---
// 
//     function test_InitialState() public view {
//         require(registrar.rootNode() == rootNode, "rootNode mismatch");
//         require(address(registrar.usdc()) == SEPOLIA_USDC, "usdc mismatch");
//         require(address(registrar.nameWrapper()) == SEPOLIA_NAME_WRAPPER, "nameWrapper mismatch");
//         require(address(registrar.resolver()) == SEPOLIA_PUBLIC_RESOLVER, "resolver mismatch");
//         require(address(registrar.priceFeed()) == SEPOLIA_ETH_USD_FEED, "priceFeed mismatch");
//         require(registrar.beneficiary() == PROJECT_TREASURY, "treasury mismatch");
//         require(registrar.registrationFeeUsdc() == 1_000_000, "default fee mismatch");
//         require(registrar.subnameFuses() == 65536, "default fuses mismatch");
//         require(registrar.maxOracleStaleness() == 86400, "default staleness mismatch");
//         require(registrar.owner() == address(this), "owner mismatch");
//     }
// 
//     function test_SetBeneficiary() public {
//         address payable newTreasury = payable(address(0x1234567890123456789012345678901234567890));
//         registrar.setBeneficiary(newTreasury);
//         require(registrar.beneficiary() == newTreasury, "beneficiary update failed");
//     }
// 
//     function test_SetBeneficiary_RevertZeroAddress() public {
//         try registrar.setBeneficiary(payable(address(0))) {
//             revert("Expected revert on zero address");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(errorSelector == IMelodyPaySubnameRegistrar.ZeroAddress.selector, "Wrong error selector");
//         }
//     }
// 
//     function test_SetResolver() public {
//         address newResolver = address(0x9999);
//         registrar.setResolver(newResolver);
//         require(address(registrar.resolver()) == newResolver, "resolver update failed");
//     }
// 
//     function test_SetPriceFeed() public {
//         address newFeed = address(0x8888);
//         registrar.setPriceFeed(newFeed);
//         require(address(registrar.priceFeed()) == newFeed, "price feed update failed");
//     }
// 
//     function test_SetRegistrationFeeUsdc() public {
//         registrar.setRegistrationFeeUsdc(2_000_000);
//         require(registrar.registrationFeeUsdc() == 2_000_000, "fee update failed");
//     }
// 
//     function test_SetSubnameFuses() public {
//         registrar.setSubnameFuses(0);
//         require(registrar.subnameFuses() == 0, "fuses update failed");
//     }
// 
//     function test_SetMaxOracleStaleness() public {
//         registrar.setMaxOracleStaleness(3600);
//         require(registrar.maxOracleStaleness() == 3600, "staleness update failed");
//     }
// 
//     function test_PauseAndUnpause() public {
//         require(!registrar.paused(), "initially not paused");
//         registrar.pause();
//         require(registrar.paused(), "should be paused");
//         registrar.unpause();
//         require(!registrar.paused(), "should be unpaused");
//     }
// 
//     function test_NonOwnerCannotModifySettings() public {
//         vm.prank(alice);
//         try registrar.pause() {
//             revert("Non-owner should not be able to pause");
//         } catch {}
// 
//         vm.prank(alice);
//         try registrar.setBeneficiary(payable(alice)) {
//             revert("Non-owner should not be able to set beneficiary");
//         } catch {}
// 
//         vm.prank(alice);
//         try registrar.setRegistrationFeeUsdc(0) {
//             revert("Non-owner should not be able to set fee");
//         } catch {}
//     }
// 
//     function test_TwoStepOwnershipTransfer() public {
//         registrar.transferOwnership(alice);
//         require(registrar.owner() == address(this), "owner should not change before acceptance");
//         require(registrar.pendingOwner() == alice, "pending owner should be alice");
// 
//         vm.prank(alice);
//         registrar.acceptOwnership();
//         require(registrar.owner() == alice, "owner should now be alice");
//         require(registrar.pendingOwner() == address(0), "pending owner should be cleared");
//     }
// 
//     function test_ZeroAddressMerchantReverts() public {
//         try registrar.register("cafe", address(0)) {
//             revert("Expected revert for zero merchant address");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(errorSelector == IMelodyPaySubnameRegistrar.ZeroAddress.selector, "Wrong error selector");
//         }
//     }
// 
//     function test_GetRequiredNativePayment_LiveChainlink() public view {
//         uint256 requiredWei = registrar.getRequiredNativePayment();
//         // At ~$2,500/ETH, 1.0 USD should be around 4e14 wei (0.0004 ETH)
//         // Ensure reasonable bounds: between 1e13 wei (at $100k/ETH) and 1e16 wei (at $100/ETH)
//         require(requiredWei > 1e13, "requiredWei suspiciously low");
//         require(requiredWei < 1e16, "requiredWei suspiciously high");
// 
//         // Verify mathematical invariant: requiredWei * price == 1.0 USD
//         (, int256 price, , , ) = AggregatorV3Interface(SEPOLIA_ETH_USD_FEED).latestRoundData();
//         uint256 expectedWei = (1 ether * (10 ** 8)) / uint256(price);
//         require(requiredWei == expectedWei, "price calculation invariant failed");
//     }
// 
//     function test_RegisterWithNative_InsufficientPaymentReverts() public {
//         uint256 requiredWei = registrar.getRequiredNativePayment();
//         uint256 insufficientWei = requiredWei - 1;
// 
//         vm.deal(alice, 1 ether);
//         vm.prank(alice);
//         try registrar.registerWithNative{value: insufficientWei}("cafe", alice) {
//             revert("Expected revert on insufficient native payment");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(
//                 errorSelector == IMelodyPaySubnameRegistrar.InsufficientNativePayment.selector,
//                 "Wrong error selector"
//             );
//         }
//     }
// 
//     function test_RegistrationRevertsWhenPaused() public {
//         registrar.pause();
// 
//         vm.prank(alice);
//         try registrar.register("cafe", alice) {
//             revert("Expected revert when paused");
//         } catch {}
// 
//         vm.deal(alice, 1 ether);
//         vm.prank(alice);
//         try registrar.registerWithNative{value: 0.01 ether}("cafe", alice) {
//             revert("Expected revert when paused");
//         } catch {}
//     }
// 
//     function test_RenewRevertsForUnregisteredLabel() public {
//         vm.prank(alice);
//         try registrar.renew("unregistered-label") {
//             revert("Expected revert for unregistered label");
//         } catch (bytes memory lowLevelData) {
//             bytes4 errorSelector = bytes4(lowLevelData);
//             require(
//                 errorSelector == IMelodyPaySubnameRegistrar.LabelNotRegistered.selector,
//                 "Wrong error selector"
//             );
//         }
//     }
// 
//     function test_ERC1155InterfaceSupport() public view {
//         // ERC1155Receiver interface ID = 0xd9b67a26
//         require(registrar.supportsInterface(0xd9b67a26), "ERC1155Receiver not supported");
//         // ERC165 interface ID = 0x01ffc9a7
//         require(registrar.supportsInterface(0x01ffc9a7), "ERC165 not supported");
//     }
// }
