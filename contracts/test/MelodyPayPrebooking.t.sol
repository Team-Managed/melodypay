// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MelodyPayPrebooking} from "../src/MelodyPayPrebooking.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
    function roll(uint256 newBlockNumber) external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
}

contract MockUSDC is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function totalSupply() external pure override returns (uint256) {
        return 1_000_000_000e6;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MelodyPayPrebookingTest {
    address private constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    Vm internal constant vm = Vm(VM_ADDRESS);

    MelodyPayPrebooking public prebooking;
    MockUSDC public usdc;

    address public treasury = address(0xE36f3d4Bd0a6bbdd940404C6323c1121b2666176);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        prebooking = new MelodyPayPrebooking(address(usdc), treasury);

        usdc.mint(alice, 10_000_000); // 10 USDC
        usdc.mint(bob, 10_000_000);   // 10 USDC
    }

    function test_Prebook_Success() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        uint256 qNum = prebooking.prebook();
        vm.stopPrank();

        require(qNum == 1, "Queue number should be 1");
        require(prebooking.totalPrebookings() == 1, "Total prebookings should be 1");
        require(prebooking.getUserQueue(alice) == 1, "Alice queue should be 1");
        require(prebooking.hasPrebooked(alice), "Alice should have prebooked");
        require(prebooking.queueUser(1) == alice, "Queue 1 user should be Alice");
        require(usdc.balanceOf(treasury) == 1_000_000, "Treasury should have 1 USDC");
        require(usdc.balanceOf(alice) == 9_000_000, "Alice should have 9 USDC remaining");
    }

    function test_SequentialQueueNumbers() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        uint256 q1 = prebooking.prebook();
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(prebooking), 1_000_000);
        uint256 q2 = prebooking.prebook();
        vm.stopPrank();

        require(q1 == 1, "Alice should be #1");
        require(q2 == 2, "Bob should be #2");
        require(prebooking.getQueueCount() == 2, "Queue count should be 2");
        require(usdc.balanceOf(treasury) == 2_000_000, "Treasury should have 2 USDC");
    }

    function test_RevertIf_AlreadyPrebooked() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 2_000_000);
        prebooking.prebook();

        bool failed = false;
        try prebooking.prebook() {
            failed = false;
        } catch Error(string memory reason) {
            failed = (keccak256(bytes(reason)) == keccak256(bytes("Already prebooked")));
        } catch {
            failed = true;
        }
        vm.stopPrank();

        require(failed, "Duplicate prebook did not revert as expected");
    }

    function test_RevertIf_InsufficientAllowance() public {
        vm.startPrank(alice);
        // Do not approve USDC
        bool failed = false;
        try prebooking.prebook() {
            failed = false;
        } catch {
            failed = true;
        }
        vm.stopPrank();

        require(failed, "Prebook without allowance did not revert");
    }

    function test_RevertIf_Paused() public {
        prebooking.pause();
        require(prebooking.paused(), "Should be paused");

        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        bool failed = false;
        try prebooking.prebook() {
            failed = false;
        } catch {
            failed = true;
        }
        vm.stopPrank();

        require(failed, "Prebook while paused did not revert");

        prebooking.unpause();
        require(!prebooking.paused(), "Should be unpaused");

        vm.startPrank(alice);
        prebooking.prebook();
        vm.stopPrank();

        require(prebooking.totalPrebookings() == 1, "Prebook after unpause should succeed");
    }

    function test_UpdateTreasury() public {
        address newTreasury = address(0x9999);
        prebooking.setTreasury(newTreasury);
        require(prebooking.treasury() == newTreasury, "Treasury update failed");
    }
}
