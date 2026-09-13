// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeERC20} from "./common/SafeERC20.sol";
import {Ownable2Step} from "./common/Ownable2Step.sol";
import {Pausable} from "./common/Pausable.sol";
import {ReentrancyGuard} from "./common/ReentrancyGuard.sol";

/**
 * @title MelodyPayPrebooking
 * @notice Fixed-price (1 USDC) pre-booking and priority waitlist contract for the
 *         MelodyPay HardWallet (Air-Gapped Acoustic Sound Terminal).
 * @dev 100% of proceeds forward directly to the treasury wallet.
 *      Maintains an authoritative on-chain counter of pre-booked users.
 *      User contact data remains 100% off-chain for privacy.
 */
contract MelodyPayPrebooking is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical Base USDC Token
    IERC20 public immutable usdc;

    /// @notice Treasury Address receiving hardware pre-booking funds
    address public treasury;

    /// @notice Pre-booking price: exactly 1.00 USDC (6 decimals)
    uint256 public constant PREBOOK_PRICE = 1_000_000;

    /// @notice Maximum HardWallets that can be pre-booked in a single transaction
    uint256 public constant MAX_BATCH_QUANTITY = 50;

    /// @notice Total number of pre-booked HardWallet units across all users
    uint256 public totalPrebookings;

    /// @notice Total units pre-booked by a specific user address
    mapping(address => uint256) public userTotalUnits;

    /// @notice Mapping from user address to their first sequential queue number
    mapping(address => uint256) public userQueueNumber;

    /// @notice Mapping from queue number to user address
    mapping(uint256 => address) public queueUser;

    /// @notice Emitted when a user successfully completes a pre-booking
    event Prebooked(
        uint256 indexed queueNumber,
        address indexed user,
        uint256 totalCost,
        uint256 quantity,
        uint256 timestamp
    );

    /// @notice Emitted when the treasury address is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted when accidentally sent tokens are recovered
    event TokenRecovered(address indexed token, address indexed to, uint256 amount);

    constructor(address _usdc, address _treasury) Ownable2Step(msg.sender) {
        require(_usdc != address(0), "Zero USDC address");
        require(_treasury != address(0), "Zero treasury address");

        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * @notice Reserve priority hardware waitlist spots by paying 1.00 USDC per unit
     * @param quantity Number of HardWallet units to pre-book (1 to MAX_BATCH_QUANTITY)
     * @return startQueueNumber The first sequential priority queue position assigned in this reservation batch
     */
    function prebook(uint256 quantity) public nonReentrant whenNotPaused returns (uint256 startQueueNumber) {
        require(quantity > 0, "Quantity must be > 0");
        require(quantity <= MAX_BATCH_QUANTITY, "Exceeds max batch quantity");

        uint256 totalCost = quantity * PREBOOK_PRICE;

        // Effects: update internal state before external interactions (CEI pattern)
        startQueueNumber = totalPrebookings + 1;
        totalPrebookings += quantity;
        userTotalUnits[msg.sender] += quantity;

        // Record first queue number if not set yet
        if (userQueueNumber[msg.sender] == 0) {
            userQueueNumber[msg.sender] = startQueueNumber;
        }

        // Map every assigned queue number in batch to caller
        for (uint256 i = 0; i < quantity; ++i) {
            queueUser[startQueueNumber + i] = msg.sender;
        }

        // Interactions: forward USDC directly from caller to treasury
        usdc.safeTransferFrom(msg.sender, treasury, totalCost);

        emit Prebooked(startQueueNumber, msg.sender, totalCost, quantity, block.timestamp);
    }

    /**
     * @notice Backwards-compatible parameterless prebook (reserves 1 HardWallet)
     * @return queueNumber The sequential priority queue position assigned to the user
     */
    function prebook() external returns (uint256 queueNumber) {
        return prebook(1);
    }

    /**
     * @notice Check if a user has already pre-booked at least 1 unit
     */
    function hasPrebooked(address user) external view returns (bool) {
        return userTotalUnits[user] > 0 || userQueueNumber[user] != 0;
    }

    /**
     * @notice Get user's first assigned queue number
     */
    function getUserQueue(address user) external view returns (uint256) {
        return userQueueNumber[user];
    }

    /**
     * @notice Get total units pre-booked by a specific user address
     */
    function getUserUnits(address user) external view returns (uint256) {
        return userTotalUnits[user];
    }

    /**
     * @notice Get total count of pre-booked HardWallet units
     */
    function getQueueCount() external view returns (uint256) {
        return totalPrebookings;
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Zero treasury address");
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /**
     * @notice Emergency circuit breaker
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume pre-bookings
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Recover any ERC-20 tokens accidentally sent directly to this contract
     * @param token Address of the ERC-20 token to recover
     * @param to Recipient address for recovered tokens
     * @param amount Token amount to transfer
     */
    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero recipient address");
        IERC20(token).safeTransfer(to, amount);
        emit TokenRecovered(token, to, amount);
    }
}
