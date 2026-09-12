// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";
import {INameWrapper} from "./INameWrapper.sol";
import {IAddrResolver} from "./IAddrResolver.sol";
import {AggregatorV3Interface} from "./AggregatorV3Interface.sol";

interface IMelodyPaySubnameRegistrar {
    enum PaymentType { USDC, Native }

    // Custom Errors
    error ZeroAddress();
    error InvalidLabelLength();
    error InvalidLabelCharacters();
    error LabelNotAvailable(string label);
    error LabelNotRegistered(string label);
    error PaymentFailed();
    error InsufficientNativePayment(uint256 sent, uint256 required);
    error OraclePriceInvalid();
    error RefundFailed();

    // Events
    event NameRegistered(
        string label,
        bytes32 indexed subnode,
        address indexed owner,
        PaymentType paymentType,
        uint256 price,
        uint256 expiry
    );

    event NameRenewed(
        string label,
        bytes32 indexed subnode,
        PaymentType paymentType,
        uint256 price,
        uint256 newExpiry
    );

    event BeneficiaryUpdated(address indexed previousBeneficiary, address indexed newBeneficiary);
    event PriceFeedUpdated(address indexed previousFeed, address indexed newFeed);
    event ResolverUpdated(address indexed previousResolver, address indexed newResolver);
    event RegistrationFeeUpdated(uint256 previousFee, uint256 newFee);
    event SubnameFusesUpdated(uint32 previousFuses, uint32 newFuses);
    event MaxOracleStalenessUpdated(uint256 previousStaleness, uint256 newStaleness);

    function isAvailable(string calldata label) external view returns (bool);
    function getRequiredNativePayment() external view returns (uint256);
    function register(string calldata label, address merchantOwner) external;
    function registerWithNative(string calldata label, address merchantOwner) external payable;
    function renew(string calldata label) external;
    function renewWithNative(string calldata label) external payable;

    function rootNode() external view returns (bytes32);
    function usdc() external view returns (IERC20);
    function nameWrapper() external view returns (INameWrapper);
    function resolver() external view returns (IAddrResolver);
    function priceFeed() external view returns (AggregatorV3Interface);
    function beneficiary() external view returns (address payable);
    function registrationFeeUsdc() external view returns (uint256);
    function subnameFuses() external view returns (uint32);
    function maxOracleStaleness() external view returns (uint256);
}
