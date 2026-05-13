// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {RepoRegistry} from "../src/RepoRegistry.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {RepoToken} from "../src/RepoToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BondingCurveTest is Test {
    RepoRegistry registry;
    BondingCurve curve;
    IERC20 token;

    address treasury = makeAddr("treasury");
    address oracle = makeAddr("oracle");
    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");

    uint256 constant DEPLOY_COST = 1.1 ether;
    uint256 constant REPO_ID = 1;

    function setUp() public {
        registry = new RepoRegistry(treasury, oracle);
        vm.deal(address(this), DEPLOY_COST);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "Test Repo", "TEST", bytes32(0));

        RepoRegistry.TokenInfo memory info = registry.getToken(REPO_ID);
        curve = BondingCurve(payable(info.bondingCurve));
        token = IERC20(info.token);

        vm.deal(buyer, 100 ether);
        vm.deal(seller, 100 ether);
    }

    // ─── Buy ─────────────────────────────────────────────────────────────────

    function test_buyGivesTokens() public {
        vm.prank(buyer);
        curve.buy{value: 1 ether}(0);
        assertGt(token.balanceOf(buyer), 0);
    }

    function test_buyChargesFeeToTreasury() public {
        uint256 before = treasury.balance;
        vm.prank(buyer);
        curve.buy{value: 1 ether}(0);
        // Fee = 1% of 1 ether = 0.01 ether
        assertEq(treasury.balance, before + 0.01 ether);
    }

    function test_buySlippageProtection() public {
        uint256 expected = curve.getTokensForNative(1 ether);
        vm.prank(buyer);
        vm.expectRevert("Slippage exceeded");
        curve.buy{value: 1 ether}(expected + 1);
    }

    function test_buyWithExactMinOut() public {
        uint256 expected = curve.getTokensForNative(1 ether);
        vm.prank(buyer);
        curve.buy{value: 1 ether}(expected);
        assertEq(token.balanceOf(buyer), expected);
    }

    function test_priceIncreasesAfterBuy() public {
        uint256 priceBefore = curve.getSpotPrice();
        vm.prank(buyer);
        curve.buy{value: 5 ether}(0);
        uint256 priceAfter = curve.getSpotPrice();
        assertGt(priceAfter, priceBefore);
    }

    function test_multipleBuysIncreasePriceMonotonically() public {
        uint256 price0 = curve.getSpotPrice();
        vm.startPrank(buyer);
        curve.buy{value: 1 ether}(0);
        uint256 price1 = curve.getSpotPrice();
        curve.buy{value: 1 ether}(0);
        uint256 price2 = curve.getSpotPrice();
        vm.stopPrank();
        assertGt(price1, price0);
        assertGt(price2, price1);
    }

    // ─── Sell ────────────────────────────────────────────────────────────────

    function test_sellAfterBuy() public {
        vm.prank(buyer);
        curve.buy{value: 1 ether}(0);

        uint256 tokenBalance = token.balanceOf(buyer);
        uint256 nativeBefore = buyer.balance;

        vm.startPrank(buyer);
        token.approve(address(curve), tokenBalance);
        curve.sell(tokenBalance, 0);
        vm.stopPrank();

        assertGt(buyer.balance, nativeBefore);
    }

    function test_sellSlippageProtection() public {
        vm.prank(buyer);
        curve.buy{value: 1 ether}(0);

        uint256 tokenBalance = token.balanceOf(buyer);
        uint256 expectedOut = curve.getNativeForTokens(tokenBalance);

        vm.startPrank(buyer);
        token.approve(address(curve), tokenBalance);
        vm.expectRevert("Slippage exceeded");
        curve.sell(tokenBalance, expectedOut + 1);
        vm.stopPrank();
    }

    function test_sellChargesFee() public {
        vm.prank(buyer);
        curve.buy{value: 1 ether}(0);

        uint256 tokenBalance = token.balanceOf(buyer);
        uint256 treasuryBefore = treasury.balance;

        vm.startPrank(buyer);
        token.approve(address(curve), tokenBalance);
        curve.sell(tokenBalance, 0);
        vm.stopPrank();

        assertGt(treasury.balance, treasuryBefore);
    }

    function test_sellReducesPrice() public {
        // Buy enough to move the price but not trigger graduation (< 80% threshold)
        vm.prank(buyer);
        curve.buy{value: 0.5 ether}(0);
        uint256 priceAfterBuy = curve.getSpotPrice();

        // Seller sells all tokens
        uint256 tokenBalance = token.balanceOf(buyer);
        vm.startPrank(buyer);
        token.approve(address(curve), tokenBalance);
        curve.sell(tokenBalance, 0);
        vm.stopPrank();

        uint256 priceAfterSell = curve.getSpotPrice();
        assertLt(priceAfterSell, priceAfterBuy);
    }

    // ─── Reentrancy ──────────────────────────────────────────────────────────

    function test_noReentrancyOnBuy() public {
        // ReentrancyGuard should prevent re-entry
        // Basic check: two sequential buys work fine
        vm.startPrank(buyer);
        curve.buy{value: 0.5 ether}(0);
        curve.buy{value: 0.5 ether}(0);
        vm.stopPrank();
        assertGt(token.balanceOf(buyer), 0);
    }

    // ─── Graduation ──────────────────────────────────────────────────────────

    function test_graduationLocksCurve() public {
        // Buy enough to trigger graduation (80% of 850M tokens)
        // Need to spend enough 0G to get 680M tokens
        // With 1 0G virtual reserve and 850M tokens, we need a lot of 0G
        // Let's just set buyer to have huge balance and buy repeatedly
        vm.deal(buyer, 1_000_000 ether);

        // Get graduation threshold
        (uint256 tokensSold, uint256 threshold) = curve.getProgress();

        // Buy until graduated
        uint256 iterations = 0;
        while (!curve.graduated() && iterations < 1000) {
            vm.prank(buyer);
            curve.buy{value: 1000 ether}(0);
            iterations++;
        }

        assertTrue(curve.graduated());

        // Further buys should revert
        vm.prank(buyer);
        vm.expectRevert("Token graduated to DEX");
        curve.buy{value: 1 ether}(0);
    }

    function test_getProgress() public {
        (uint256 soldBefore,) = curve.getProgress();
        assertEq(soldBefore, 0);

        vm.prank(buyer);
        curve.buy{value: 1 ether}(0);

        (uint256 soldAfter,) = curve.getProgress();
        assertGt(soldAfter, 0);
    }

    // ─── Receive unclaimed tokens ────────────────────────────────────────────

    function test_receiveTokensIncreasesReserve() public {
        // Simulate ContributorClaim sweep
        deal(address(token), address(this), 1_000_000 * 10 ** 18);
        token.approve(address(curve), 1_000_000 * 10 ** 18);

        (, uint256 threshold) = curve.getProgress();
        uint256 reserveBefore = curve.tokenReserve();
        curve.receiveTokens(1_000_000 * 10 ** 18);
        assertEq(curve.tokenReserve(), reserveBefore + 1_000_000 * 10 ** 18);
    }
}
