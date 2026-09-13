// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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

    address public treasury = address(0x0E6937A18De79Ed54692E65F7A0DA5A81B8D7BCF);
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

    function test_BatchPrebook_Success() public {
        vm.startPrank(bob);
        usdc.approve(address(prebooking), 5_000_000);
        uint256 startQ = prebooking.prebook(5);
        vm.stopPrank();

        require(startQ == 1, "Start queue number should be 1");
        require(prebooking.totalPrebookings() == 5, "Total prebookings should be 5");
        require(prebooking.getUserUnits(bob) == 5, "Bob should have 5 units");
        require(prebooking.getUserQueue(bob) == 1, "Bob first queue should be 1");
        require(prebooking.hasPrebooked(bob), "Bob has prebooked");
        require(usdc.balanceOf(treasury) == 5_000_000, "Treasury should receive 5 USDC");
        require(usdc.balanceOf(bob) == 5_000_000, "Bob should have 5 USDC remaining");

        // Verify every queue position in batch is mapped to Bob
        for (uint256 i = 1; i <= 5; i++) {
            require(prebooking.queueUser(i) == bob, "Bob should own queue position in batch");
        }
    }

    function test_MultiplePrebookings_SameWallet() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 6_000_000);
        uint256 firstBatch = prebooking.prebook(2);
        uint256 secondBatch = prebooking.prebook(3);
        vm.stopPrank();

        require(firstBatch == 1, "First batch start queue should be 1");
        require(secondBatch == 3, "Second batch start queue should be 3");
        require(prebooking.totalPrebookings() == 5, "Total prebookings should be 5");
        require(prebooking.getUserUnits(alice) == 5, "Alice should have 5 units total");
        require(prebooking.getUserQueue(alice) == 1, "Alice original queue should remain 1");
        require(usdc.balanceOf(treasury) == 5_000_000, "Treasury should have 5 USDC");
        require(usdc.balanceOf(alice) == 5_000_000, "Alice should have 5 USDC remaining");

        require(prebooking.queueUser(1) == alice, "Queue 1 user should be Alice");
        require(prebooking.queueUser(2) == alice, "Queue 2 user should be Alice");
        require(prebooking.queueUser(3) == alice, "Queue 3 user should be Alice");
        require(prebooking.queueUser(4) == alice, "Queue 4 user should be Alice");
        require(prebooking.queueUser(5) == alice, "Queue 5 user should be Alice");
    }

    function test_RevertIf_ZeroQuantity() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 1_000_000);
        bool failed = false;
        try prebooking.prebook(0) {
            failed = false;
        } catch Error(string memory reason) {
            failed = (keccak256(bytes(reason)) == keccak256(bytes("Quantity must be > 0")));
        } catch {
            failed = true;
        }
        vm.stopPrank();

        require(failed, "Zero quantity prebook did not revert as expected");
    }

    function test_RevertIf_ExceedsMaxBatchQuantity() public {
        vm.startPrank(alice);
        usdc.approve(address(prebooking), 60_000_000);
        bool failed = false;
        try prebooking.prebook(51) {
            failed = false;
        } catch Error(string memory reason) {
            failed = (keccak256(bytes(reason)) == keccak256(bytes("Exceeds max batch quantity")));
        } catch {
            failed = true;
        }
        vm.stopPrank();

        require(failed, "Prebook exceeding 50 did not revert as expected");
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

    function test_RevertIf_UpdateTreasury_ZeroAddress() public {
        bool failed = false;
        try prebooking.setTreasury(address(0)) {
            failed = false;
        } catch {
            failed = true;
        }
        require(failed, "Setting treasury to zero address should revert");
    }

    function test_RevertIf_UpdateTreasury_NotOwner() public {
        vm.startPrank(alice);
        bool failed = false;
        try prebooking.setTreasury(address(0x9999)) {
            failed = false;
        } catch {
            failed = true;
        }
        vm.stopPrank();
        require(failed, "Non-owner should not be able to update treasury");
    }

    function test_RecoverToken_Success() public {
        // Simulate accidental transfer of tokens directly to prebooking contract
        usdc.mint(address(prebooking), 500_000); // 0.5 USDC
        require(usdc.balanceOf(address(prebooking)) == 500_000, "Contract should have balance");

        address rescueTarget = address(0x7777);
        prebooking.recoverToken(address(usdc), rescueTarget, 500_000);

        require(usdc.balanceOf(address(prebooking)) == 0, "Contract should have 0 balance after recovery");
        require(usdc.balanceOf(rescueTarget) == 500_000, "Rescue target should receive tokens");
    }

    function test_RevertIf_RecoverToken_NotOwner() public {
        usdc.mint(address(prebooking), 100_000);
        vm.startPrank(alice);
        bool failed = false;
        try prebooking.recoverToken(address(usdc), alice, 100_000) {
            failed = false;
        } catch {
            failed = true;
        }
        vm.stopPrank();
        require(failed, "Non-owner should not be able to recover tokens");
    }

    function test_RevertIf_RecoverToken_ZeroRecipient() public {
        usdc.mint(address(prebooking), 100_000);
        bool failed = false;
        try prebooking.recoverToken(address(usdc), address(0), 100_000) {
            failed = false;
        } catch {
            failed = true;
        }
        require(failed, "Recovering to zero address should revert");
    }

    function test_Ownable2Step_TransferAndAccept() public {
        address newOwner = address(0x8888);
        prebooking.transferOwnership(newOwner);
        require(prebooking.pendingOwner() == newOwner, "Pending owner should be newOwner");
        require(prebooking.owner() == address(this), "Owner should still be current owner");

        vm.startPrank(newOwner);
        prebooking.acceptOwnership();
        vm.stopPrank();

        require(prebooking.owner() == newOwner, "New owner should be active");
        require(prebooking.pendingOwner() == address(0), "Pending owner should be cleared");
    }
}
