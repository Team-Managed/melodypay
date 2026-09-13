// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {MelodyPaySubnameRegistrar} from "../src/MelodyPaySubnameRegistrar.sol";

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data) external returns (address proxy);
}

contract SetupENSv2 is Script {
    uint256 private constant ALL_ROLES =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    uint256 private constant REGISTRAR_ROLES = (1 << 0) | (1 << 16);

    function run() external returns (
        address userRegistry,
        address resolver,
        address registrar
    ) {
        address owner = vm.envAddress("ENSV2_OWNER");
        address factory = vm.envAddress("ENSV2_FACTORY");
        address userRegistryImplementation = vm.envAddress("ENSV2_USER_REGISTRY_IMPL");
        address resolverImplementation = vm.envAddress("ENSV2_RESOLVER_IMPL");
        IPermissionedRegistry parentRegistry = IPermissionedRegistry(vm.envAddress("ENSV2_PARENT_REGISTRY"));
        string memory parentLabel = vm.envString("ENSV2_PARENT_LABEL");
        bytes32 parentNamehash = vm.envBytes32("ENSV2_PARENT_NAMEHASH");

        vm.startBroadcast();

        uint256 registrySalt = uint256(keccak256(abi.encode(
            keccak256(bytes("UserRegistry")), parentNamehash, uint256(0)
        )));
        userRegistry = IVerifiableFactory(factory).deployProxy(
            userRegistryImplementation,
            registrySalt,
            abi.encodeWithSignature("initialize(address,uint256)", owner, ALL_ROLES)
        );

        uint256 resolverSalt = uint256(keccak256(abi.encode(
            keccak256(bytes("OwnedResolver")), owner, uint256(0)
        )));
        resolver = IVerifiableFactory(factory).deployProxy(
            resolverImplementation,
            resolverSalt,
            abi.encodeWithSignature("initialize(address,uint256,bytes[])", owner, ALL_ROLES, new bytes[](0))
        );

        parentRegistry.setSubregistry(uint256(keccak256(bytes(parentLabel))), IRegistry(userRegistry));

        registrar = address(new MelodyPaySubnameRegistrar(
            IPermissionedRegistry(userRegistry),
            IERC20(vm.envAddress("ENSV2_PAYMENT_TOKEN")),
            vm.envAddress("ENSV2_BENEFICIARY"),
            vm.envUint("ENSV2_ANNUAL_PRICE"),
            uint64(vm.envUint("ENSV2_MIN_DURATION"))
        ));
        IPermissionedRegistry(userRegistry).grantRootRoles(REGISTRAR_ROLES, registrar);

        vm.stopBroadcast();
    }
}
