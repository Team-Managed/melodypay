// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// pragma solidity ^0.8.24;
// 
// import {IERC20} from "./interfaces/IERC20.sol";
// import {INameWrapper} from "./interfaces/INameWrapper.sol";
// import {IAddrResolver} from "./interfaces/IAddrResolver.sol";
// import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
// import {IMelodyPaySubnameRegistrar} from "./interfaces/IMelodyPaySubnameRegistrar.sol";
// import {ERC1155Holder} from "./common/ERC1155Holder.sol";
// import {ReentrancyGuard} from "./common/ReentrancyGuard.sol";
// import {Pausable} from "./common/Pausable.sol";
// import {Ownable2Step} from "./common/Ownable2Step.sol";
// import {SafeERC20} from "./common/SafeERC20.sol";
// 
// /**
//  * @title MelodyPaySubnameRegistrar
//  * @notice Production ENS subname registrar issuing merchant identities under `melodypay.eth`
//  * @dev Integrates with the official ENS NameWrapper (ERC-1155).
//  *      Merchants pay a registration fee in USDC (6 decimals) or native ETH via Chainlink Oracle,
//  *      which is forwarded directly to the project treasury.
//  *      Registered subnames receive emancipated fuses (PARENT_CANNOT_CONTROL) and default resolver routing.
//  *      Reference: https://docs.ens.domains/wrapper/creating-subname-registrar
//  */
// contract MelodyPaySubnameRegistrar is
//     IMelodyPaySubnameRegistrar,
//     ERC1155Holder,
//     ReentrancyGuard,
//     Pausable,
//     Ownable2Step
// {
//     using SafeERC20 for IERC20;
// 
//     // Default: 1.0 USDC = 1_000_000 base units (6 decimals)
//     uint256 public constant DEFAULT_REGISTRATION_FEE_USDC = 1_000_000;
// 
//     // Default fuse: 65536 = PARENT_CANNOT_CONTROL (emancipated subname)
//     uint32 public constant DEFAULT_SUBNAME_FUSES = 65536;
// 
//     // Default oracle staleness tolerance: 24 hours
//     uint256 public constant DEFAULT_MAX_ORACLE_STALENESS = 86400;
// 
//     // Root ENS node hash for `melodypay.eth`
//     bytes32 public immutable rootNode;
// 
//     IERC20 public immutable usdc;
//     INameWrapper public immutable nameWrapper;
//     IAddrResolver public resolver;
//     AggregatorV3Interface public priceFeed;
//     address payable public beneficiary;
// 
//     uint256 public registrationFeeUsdc = DEFAULT_REGISTRATION_FEE_USDC;
//     uint32 public subnameFuses = DEFAULT_SUBNAME_FUSES;
//     uint256 public maxOracleStaleness = DEFAULT_MAX_ORACLE_STALENESS;
// 
//     /**
//      * @notice Constructor
//      * @param _rootNode Namehash of root domain (e.g. namehash("melodypay.eth"))
//      * @param _usdc USDC token contract address
//      * @param _nameWrapper Official ENS NameWrapper contract address
//      * @param _resolver Default ENS Resolver address
//      * @param _priceFeed Chainlink ETH/USD Price Feed
//      * @param _beneficiary Initial beneficiary / treasury address
//      */
//     constructor(
//         bytes32 _rootNode,
//         address _usdc,
//         address _nameWrapper,
//         address _resolver,
//         address _priceFeed,
//         address payable _beneficiary
//     ) Ownable2Step(msg.sender) {
//         if (_usdc == address(0) || _nameWrapper == address(0) || _beneficiary == address(0)) {
//             revert ZeroAddress();
//         }
// 
//         rootNode = _rootNode;
//         usdc = IERC20(_usdc);
//         nameWrapper = INameWrapper(_nameWrapper);
//         resolver = IAddrResolver(_resolver);
//         priceFeed = AggregatorV3Interface(_priceFeed);
//         beneficiary = _beneficiary;
// 
//         emit BeneficiaryUpdated(address(0), _beneficiary);
//         emit ResolverUpdated(address(0), _resolver);
//         emit PriceFeedUpdated(address(0), _priceFeed);
//     }
// 
//     /**
//      * @notice Checks if a subname label is available for registration
//      * @param label The desired subname label (e.g. "cafe" for "cafe.melodypay.eth")
//      * @return True if valid format and not currently owned/active in NameWrapper
//      */
//     function isAvailable(string calldata label) public view returns (bool) {
//         if (!_isValidLabel(label)) {
//             return false;
//         }
// 
//         bytes32 subnode = _calculateSubnode(label);
//         (address owner, , uint64 expiry) = nameWrapper.getData(uint256(subnode));
// 
//         return (owner == address(0) || expiry < block.timestamp);
//     }
// 
//     /**
//      * @notice Calculates required native wei needed for the registration fee using Chainlink
//      * @return requiredWei Amount in wei corresponding to registrationFeeUsdc
//      */
//     function getRequiredNativePayment() public view returns (uint256 requiredWei) {
//         if (address(priceFeed) == address(0)) revert OraclePriceInvalid();
// 
//         (uint80 roundId, int256 price, , uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
//         if (price <= 0 || updatedAt == 0 || answeredInRound < roundId) revert OraclePriceInvalid();
//         if (block.timestamp > updatedAt && block.timestamp - updatedAt > maxOracleStaleness) {
//             revert OraclePriceInvalid();
//         }
// 
//         uint8 feedDecimals = priceFeed.decimals();
//         // requiredWei = (registrationFeeUsdc * 1 ether * (10 ** feedDecimals)) / (1e6 * price)
//         uint256 numerator = registrationFeeUsdc * 1 ether * (10 ** feedDecimals);
//         uint256 denominator = 1e6 * uint256(price);
//         return numerator / denominator;
//     }
// 
//     /**
//      * @notice Register a merchant subname paying with USDC
//      * @param label The desired subname label (e.g. "cafe")
//      * @param merchantOwner The address receiving subname ownership & resolver address record
//      */
//     function register(string calldata label, address merchantOwner) external nonReentrant whenNotPaused {
//         if (merchantOwner == address(0)) revert ZeroAddress();
//         if (!isAvailable(label)) revert LabelNotAvailable(label);
// 
//         bytes32 subnode = _calculateSubnode(label);
//         uint64 parentExpiry = _getParentExpiry();
// 
//         emit NameRegistered(
//             label,
//             subnode,
//             merchantOwner,
//             PaymentType.USDC,
//             registrationFeeUsdc,
//             parentExpiry
//         );
// 
//         _registerSubnodeInWrapper(label, subnode, merchantOwner, parentExpiry);
// 
//         usdc.safeTransferFrom(msg.sender, beneficiary, registrationFeeUsdc);
//     }
// 
//     /**
//      * @notice Register a merchant subname paying with native ETH via Chainlink oracle
//      * @param label The desired subname label
//      * @param merchantOwner The address receiving subname ownership & resolver address record
//      */
//     function registerWithNative(string calldata label, address merchantOwner) external payable nonReentrant whenNotPaused {
//         if (merchantOwner == address(0)) revert ZeroAddress();
//         if (!isAvailable(label)) revert LabelNotAvailable(label);
// 
//         uint256 requiredWei = getRequiredNativePayment();
//         if (msg.value < requiredWei) {
//             revert InsufficientNativePayment(msg.value, requiredWei);
//         }
// 
//         bytes32 subnode = _calculateSubnode(label);
//         uint64 parentExpiry = _getParentExpiry();
// 
//         emit NameRegistered(
//             label,
//             subnode,
//             merchantOwner,
//             PaymentType.Native,
//             requiredWei,
//             parentExpiry
//         );
// 
//         _registerSubnodeInWrapper(label, subnode, merchantOwner, parentExpiry);
// 
//         (bool sent, ) = beneficiary.call{value: requiredWei}("");
//         if (!sent) revert PaymentFailed();
// 
//         if (msg.value > requiredWei) {
//             uint256 refund = msg.value - requiredWei;
//             (bool refunded, ) = msg.sender.call{value: refund}("");
//             if (!refunded) revert RefundFailed();
//         }
//     }
// 
//     /**
//      * @notice Renew an existing merchant subname with USDC
//      * @param label The subname label to renew
//      */
//     function renew(string calldata label) external nonReentrant whenNotPaused {
//         if (!_isValidLabel(label)) revert InvalidLabelCharacters();
// 
//         bytes32 subnode = _calculateSubnode(label);
//         (address currentOwner, , ) = nameWrapper.getData(uint256(subnode));
//         if (currentOwner == address(0)) revert LabelNotRegistered(label);
// 
//         uint64 parentExpiry = _getParentExpiry();
//         bytes32 labelhash = keccak256(bytes(label));
// 
//         emit NameRenewed(
//             label,
//             subnode,
//             PaymentType.USDC,
//             registrationFeeUsdc,
//             parentExpiry
//         );
// 
//         nameWrapper.setChildExpiry(rootNode, labelhash, parentExpiry);
// 
//         usdc.safeTransferFrom(msg.sender, beneficiary, registrationFeeUsdc);
//     }
// 
//     /**
//      * @notice Renew an existing merchant subname with native ETH
//      * @param label The subname label to renew
//      */
//     function renewWithNative(string calldata label) external payable nonReentrant whenNotPaused {
//         if (!_isValidLabel(label)) revert InvalidLabelCharacters();
// 
//         bytes32 subnode = _calculateSubnode(label);
//         (address currentOwner, , ) = nameWrapper.getData(uint256(subnode));
//         if (currentOwner == address(0)) revert LabelNotRegistered(label);
// 
//         uint256 requiredWei = getRequiredNativePayment();
//         if (msg.value < requiredWei) {
//             revert InsufficientNativePayment(msg.value, requiredWei);
//         }
// 
//         uint64 parentExpiry = _getParentExpiry();
//         bytes32 labelhash = keccak256(bytes(label));
// 
//         emit NameRenewed(
//             label,
//             subnode,
//             PaymentType.Native,
//             requiredWei,
//             parentExpiry
//         );
// 
//         nameWrapper.setChildExpiry(rootNode, labelhash, parentExpiry);
// 
//         (bool sent, ) = beneficiary.call{value: requiredWei}("");
//         if (!sent) revert PaymentFailed();
// 
//         if (msg.value > requiredWei) {
//             uint256 refund = msg.value - requiredWei;
//             (bool refunded, ) = msg.sender.call{value: refund}("");
//             if (!refunded) revert RefundFailed();
//         }
//     }
// 
//     // --- Admin Configuration ---
// 
//     function setBeneficiary(address payable newBeneficiary) external onlyOwner {
//         if (newBeneficiary == address(0)) revert ZeroAddress();
//         address previousBeneficiary = beneficiary;
//         beneficiary = newBeneficiary;
//         emit BeneficiaryUpdated(previousBeneficiary, newBeneficiary);
//     }
// 
//     function setResolver(address newResolver) external onlyOwner {
//         if (newResolver == address(0)) revert ZeroAddress();
//         address previousResolver = address(resolver);
//         resolver = IAddrResolver(newResolver);
//         emit ResolverUpdated(previousResolver, newResolver);
//     }
// 
//     function setPriceFeed(address newFeed) external onlyOwner {
//         address previousFeed = address(priceFeed);
//         priceFeed = AggregatorV3Interface(newFeed);
//         emit PriceFeedUpdated(previousFeed, newFeed);
//     }
// 
//     function setRegistrationFeeUsdc(uint256 newFee) external onlyOwner {
//         uint256 previousFee = registrationFeeUsdc;
//         registrationFeeUsdc = newFee;
//         emit RegistrationFeeUpdated(previousFee, newFee);
//     }
// 
//     function setSubnameFuses(uint32 newFuses) external onlyOwner {
//         uint32 previousFuses = subnameFuses;
//         subnameFuses = newFuses;
//         emit SubnameFusesUpdated(previousFuses, newFuses);
//     }
// 
//     function setMaxOracleStaleness(uint256 newStaleness) external onlyOwner {
//         uint256 previousStaleness = maxOracleStaleness;
//         maxOracleStaleness = newStaleness;
//         emit MaxOracleStalenessUpdated(previousStaleness, newStaleness);
//     }
// 
//     function pause() external onlyOwner {
//         _pause();
//     }
// 
//     function unpause() external onlyOwner {
//         _unpause();
//     }
// 
//     // --- Internal Helpers ---
// 
//     function _getParentExpiry() internal view returns (uint64 parentExpiry) {
//         (, , parentExpiry) = nameWrapper.getData(uint256(rootNode));
//         if (parentExpiry != 0 && parentExpiry <= block.timestamp) {
//             revert OraclePriceInvalid();
//         }
//     }
// 
//     function _calculateSubnode(string calldata label) internal view returns (bytes32) {
//         bytes32 labelHash = keccak256(bytes(label));
//         return keccak256(abi.encodePacked(rootNode, labelHash));
//     }
// 
//     function _registerSubnodeInWrapper(
//         string calldata label,
//         bytes32 subnode,
//         address merchantOwner,
//         uint64 expiry
//     ) internal {
//         if (address(resolver) != address(0)) {
//             // 1. Temporarily acquire subnode to configure default forward resolution
//             nameWrapper.setSubnodeOwner(rootNode, label, address(this), 0, expiry);
//             resolver.setAddr(subnode, merchantOwner);
//             // 2. Wrap and transfer subnode record to merchant with specified fuses
//             nameWrapper.setSubnodeRecord(rootNode, label, merchantOwner, address(resolver), 0, subnameFuses, expiry);
//         } else {
//             nameWrapper.setSubnodeRecord(rootNode, label, merchantOwner, address(0), 0, subnameFuses, expiry);
//         }
//     }
// 
//     function _isValidLabel(string calldata label) internal pure returns (bool) {
//         bytes memory b = bytes(label);
//         if (b.length < 3 || b.length > 32) {
//             return false;
//         }
// 
//         for (uint256 i = 0; i < b.length; i++) {
//             bytes1 char = b[i];
//             bool isLower = (char >= 0x61 && char <= 0x7a); // a-z
//             bool isDigit = (char >= 0x30 && char <= 0x39); // 0-9
//             bool isHyphen = (char == 0x2d);                // -
//             if (!isLower && !isDigit && !isHyphen) {
//                 return false;
//             }
//         }
// 
//         return true;
//     }
// }
