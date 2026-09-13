// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {MelodyPaySubnameRegistrar} from "../src/MelodyPaySubnameRegistrar.sol";

contract MockPaymentToken is IERC20 {
    function totalSupply() external pure returns (uint256) { return 0; }
    function balanceOf(address) external pure returns (uint256) { return type(uint256).max; }
    function allowance(address, address) external pure returns (uint256) { return type(uint256).max; }
    function approve(address, uint256) external pure returns (bool) { return true; }
    function transfer(address, uint256) external pure returns (bool) { return true; }
    function transferFrom(address, address, uint256) external pure returns (bool) { return true; }
}

contract MockPermissionedRegistry {
    mapping(uint256 => IPermissionedRegistry.State) internal states;
    uint256 internal nextTokenId = 1;

    function getState(uint256 anyId) external view returns (IPermissionedRegistry.State memory) {
        return states[anyId];
    }

    function register(
        string calldata label,
        address owner,
        IRegistry,
        address,
        uint256,
        uint64 expiry
    ) external returns (uint256 tokenId) {
        uint256 labelId = uint256(keccak256(bytes(label)));
        tokenId = nextTokenId++;
        states[labelId] = IPermissionedRegistry.State({
            status: IPermissionedRegistry.Status.REGISTERED,
            expiry: expiry,
            latestOwner: owner,
            tokenId: tokenId,
            resource: labelId
        });
    }

    function renew(uint256 anyId, uint64 newExpiry) external {
        states[anyId].expiry = newExpiry;
    }
}

contract MelodyPaySubnameRegistrarTest {
    MockPaymentToken internal token;
    MockPermissionedRegistry internal registry;
    MelodyPaySubnameRegistrar internal registrar;

    function setUp() public {
        token = new MockPaymentToken();
        registry = new MockPermissionedRegistry();
        registrar = new MelodyPaySubnameRegistrar(
            IPermissionedRegistry(address(registry)),
            IERC20(address(token)),
            address(0xBEEF),
            5_000_000,
            30 days
        );
    }

    function testPrice() public {
        setUp();
        require(registrar.getPrice(365 days) == 5_000_000, "annual price mismatch");
        require(registrar.getPrice(30 days) > 0, "minimum price must be nonzero");
    }

    function testRegisterAndRenew() public {
        setUp();
        uint64 duration = 365 days;
        uint256 tokenId = registrar.register("cafe", address(0xCAFE), address(0x1234), duration);
        require(tokenId == 1, "token id mismatch");
        require(!registrar.isAvailable("cafe"), "registered name remains available");

        registrar.renew("cafe", duration);
        IPermissionedRegistry.State memory state = registry.getState(uint256(keccak256(bytes("cafe"))));
        require(state.expiry > block.timestamp + duration, "renewal did not extend expiry");
    }

    function testRejectsZeroOwnerAndResolver() public {
        setUp();
        (bool ownerOk,) = address(registrar).call(
            abi.encodeCall(registrar.register, ("owner", address(0), address(0x1234), uint64(30 days)))
        );
        require(!ownerOk, "zero owner accepted");
        (bool resolverOk,) = address(registrar).call(
            abi.encodeCall(registrar.register, ("resolver", address(0xCAFE), address(0), uint64(30 days)))
        );
        require(!resolverOk, "zero resolver accepted");
    }

    function testRejectsShortDuration() public {
        setUp();
        (bool ok,) = address(registrar).call(
            abi.encodeCall(registrar.register, ("short", address(0xCAFE), address(0x1234), uint64(1 days)))
        );
        require(!ok, "short registration accepted");
    }
}
