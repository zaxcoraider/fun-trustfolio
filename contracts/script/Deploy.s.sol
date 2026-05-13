// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RepoRegistry} from "../src/RepoRegistry.sol";

contract Deploy is Script {
    function run() external {
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address oracle = vm.envAddress("ORACLE_ADDRESS");

        require(treasury != address(0), "Set TREASURY_ADDRESS in .env");
        require(oracle != address(0), "Set ORACLE_ADDRESS in .env");

        vm.startBroadcast();

        RepoRegistry registry = new RepoRegistry(treasury, oracle);

        console.log("RepoRegistry deployed at:", address(registry));
        console.log("Treasury:", treasury);
        console.log("Oracle:", oracle);

        vm.stopBroadcast();
    }
}
