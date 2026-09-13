// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MelodyPaySubnameRegistrar} from "../src/MelodyPaySubnameRegistrar.sol";

contract RegisterSubname is Script {
    function run() external {
        MelodyPaySubnameRegistrar registrar = MelodyPaySubnameRegistrar(vm.envAddress("ENSV2_REGISTRAR"));
        IERC20 token = IERC20(address(registrar.PAYMENT_TOKEN()));
        string memory label = vm.envString("ENSV2_LABEL");
        address owner = vm.envAddress("ENSV2_OWNER");
        address resolver = vm.envAddress("ENSV2_RESOLVER");
        uint64 duration = uint64(vm.envUint("ENSV2_DURATION"));
        uint256 price = registrar.getPrice(duration);

        vm.startBroadcast();
        token.approve(address(registrar), price);
        registrar.register(label, owner, resolver, duration);
        vm.stopBroadcast();
    }
}
