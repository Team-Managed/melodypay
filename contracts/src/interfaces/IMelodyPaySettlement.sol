// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMelodyPaySettlement {
    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error AuthorizationExpired(uint256 validBefore, uint256 currentTimestamp);
    error AuthorizationNotYetValid(uint256 validAfter, uint256 currentTimestamp);
    error ReplayAttackDetected(address authorizer, bytes32 nonce);
    error OrderAlreadySettled(bytes32 orderId);
    error SettlementTransferFailed();

    // Events
    event SoundPaymentSettled(
        address indexed payer,
        address indexed recipient,
        uint256 value,
        bytes32 indexed nonce,
        bytes32 orderId,
        uint256 timestamp
    );

    event DefaultTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    function settlePayment(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes32 orderId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool);

    function settleWithTransferAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes32 orderId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool);

    function defaultTreasury() external view returns (address);
    function isSettled(address authorizer, bytes32 nonce) external view returns (bool);
    function orderToSettlement(bytes32 orderId) external view returns (bytes32);
}
