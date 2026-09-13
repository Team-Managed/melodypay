// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {MelodyPaySubnameRegistrar} from "../src/MelodyPaySubnameRegistrar.sol";

contract DeployRegistrar is Script {
    function run() external returns (MelodyPaySubnameRegistrar registrar) {
        vm.startBroadcast();
        registrar = new MelodyPaySubnameRegistrar(
            IPermissionedRegistry(vm.envAddress("ENSV2_USER_REGISTRY")),
            IERC20(vm.envAddress("ENSV2_PAYMENT_TOKEN")),
            vm.envAddress("ENSV2_BENEFICIARY"),
            vm.envUint("ENSV2_ANNUAL_PRICE"),
            uint64(vm.envUint("ENSV2_MIN_DURATION"))
        );
        vm.stopBroadcast();
    }
}
