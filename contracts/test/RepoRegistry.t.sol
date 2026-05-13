// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {RepoRegistry} from "../src/RepoRegistry.sol";
import {RepoToken} from "../src/RepoToken.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RepoRegistryTest is Test {
    RepoRegistry registry;

    address treasury = makeAddr("treasury");
    address oracle = makeAddr("oracle");
    address deployer = makeAddr("deployer");
    address attacker = makeAddr("attacker");

    uint256 constant DEPLOY_COST = 1.1 ether;
    uint256 constant REPO_ID = 123456789;

    function setUp() public {
        registry = new RepoRegistry(treasury, oracle);
        vm.deal(deployer, 10 ether);
        vm.deal(attacker, 10 ether);
    }

    // ─── Happy path ──────────────────────────────────────────────────────────

    function test_deployToken() public {
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));

        assertTrue(registry.isDeployed(REPO_ID));
        RepoRegistry.TokenInfo memory info = registry.getToken(REPO_ID);
        assertEq(info.deployer, deployer);
        assertNotEq(info.token, address(0));
        assertNotEq(info.bondingCurve, address(0));
        assertNotEq(info.claimContract, address(0));
    }

    function test_tokenDistribution() public {
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));

        RepoRegistry.TokenInfo memory info = registry.getToken(REPO_ID);
        IERC20 token = IERC20(info.token);

        assertEq(token.balanceOf(info.bondingCurve), 850_000_000 * 10 ** 18);
        assertEq(token.balanceOf(info.claimContract), 100_000_000 * 10 ** 18);
        assertEq(token.balanceOf(treasury), 50_000_000 * 10 ** 18);
        assertEq(token.balanceOf(address(registry)), 0); // nothing left in registry
    }

    function test_launchFeeToTreasury() public {
        uint256 before = treasury.balance;
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));
        assertEq(treasury.balance, before + 0.1 ether);
    }

    function test_curveSeedToCurve() public {
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));

        address curve = registry.getBondingCurve(REPO_ID);
        assertEq(curve.balance, 1 ether);
    }

    function test_excessRefunded() public {
        uint256 before = deployer.balance;
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST + 0.5 ether}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));
        assertEq(deployer.balance, before - DEPLOY_COST);
    }

    // ─── Anti-fake guarantee ─────────────────────────────────────────────────

    function test_cannotDeployTwice() public {
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));

        vm.prank(attacker);
        vm.expectRevert("Token already deployed for this repo");
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "Fake Token", "FAKE", bytes32(0));
    }

    function test_differentRepoIdAllowed() public {
        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "Token A", "AAA", bytes32(0));

        vm.prank(deployer);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID + 1, "Token B", "BBB", bytes32(0));

        assertTrue(registry.isDeployed(REPO_ID));
        assertTrue(registry.isDeployed(REPO_ID + 1));
    }

    // ─── Input validation ────────────────────────────────────────────────────

    function test_insufficientFeeReverts() public {
        vm.prank(deployer);
        vm.expectRevert("Send 1.1 0G to deploy");
        registry.deployToken{value: 0.5 ether}(REPO_ID, "MyRepo Token", "MRT", bytes32(0));
    }

    function test_emptyNameReverts() public {
        vm.prank(deployer);
        vm.expectRevert("Invalid token name");
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "", "MRT", bytes32(0));
    }

    function test_emptySymbolReverts() public {
        vm.prank(deployer);
        vm.expectRevert("Invalid token symbol");
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "MyRepo Token", "", bytes32(0));
    }
}
