// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {RepoRegistry} from "../src/RepoRegistry.sol";
import {ContributorClaim} from "../src/ContributorClaim.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ContributorClaimTest is Test {
    RepoRegistry registry;
    ContributorClaim claim;
    BondingCurve curve;
    IERC20 token;

    address treasury = makeAddr("treasury");
    uint256 oraclePrivKey = 0xABCD1234; // test oracle private key
    address oracle;

    address contributor = makeAddr("contributor");
    address owner = makeAddr("owner");

    uint256 constant DEPLOY_COST = 1.1 ether;
    uint256 constant REPO_ID = 42;
    uint8 constant TYPE_CONTRIBUTOR = 0;
    uint8 constant TYPE_OWNER = 1;

    function setUp() public {
        oracle = vm.addr(oraclePrivKey);
        registry = new RepoRegistry(treasury, oracle);

        vm.deal(address(this), DEPLOY_COST);
        registry.deployToken{value: DEPLOY_COST}(REPO_ID, "Test Repo", "TEST", bytes32(0));

        RepoRegistry.TokenInfo memory info = registry.getToken(REPO_ID);
        claim = ContributorClaim(info.claimContract);
        curve = BondingCurve(payable(info.bondingCurve));
        token = IERC20(info.token);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _makeVoucher(address claimant, uint256 amount, uint256 deadline, uint8 claimType)
        internal
        view
        returns (bytes memory signature)
    {
        bytes32 voucherHash = keccak256(
            abi.encodePacked(block.chainid, REPO_ID, claimant, amount, deadline, claimType)
        );
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", voucherHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    // ─── Contributor claim ────────────────────────────────────────────────────

    function test_contributorClaim() public {
        uint256 amount = 10_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _makeVoucher(contributor, amount, deadline, TYPE_CONTRIBUTOR);

        vm.prank(contributor);
        claim.claim(contributor, amount, deadline, TYPE_CONTRIBUTOR, sig);

        assertEq(token.balanceOf(contributor), amount);
        assertEq(claim.totalClaimed(), amount);
    }

    // ─── Owner claim ──────────────────────────────────────────────────────────

    function test_ownerClaim() public {
        uint256 amount = 50_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _makeVoucher(owner, amount, deadline, TYPE_OWNER);

        vm.prank(owner);
        claim.claim(owner, amount, deadline, TYPE_OWNER, sig);

        assertEq(token.balanceOf(owner), amount);
    }

    // ─── Security: replay prevention ─────────────────────────────────────────

    function test_voucherCannotBeReused() public {
        uint256 amount = 5_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _makeVoucher(contributor, amount, deadline, TYPE_CONTRIBUTOR);

        vm.prank(contributor);
        claim.claim(contributor, amount, deadline, TYPE_CONTRIBUTOR, sig);

        // Try to use same voucher again
        vm.prank(contributor);
        vm.expectRevert("Voucher already used");
        claim.claim(contributor, amount, deadline, TYPE_CONTRIBUTOR, sig);
    }

    // ─── Security: invalid oracle signature ──────────────────────────────────

    function test_invalidSignatureReverts() public {
        uint256 amount = 5_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory fakeSig = _makeVoucher(contributor, amount + 1, deadline, TYPE_CONTRIBUTOR);

        // Use mismatched amount (sig is for amount+1, but claiming amount)
        vm.prank(contributor);
        vm.expectRevert("Invalid oracle signature");
        claim.claim(contributor, amount, deadline, TYPE_CONTRIBUTOR, fakeSig);
    }

    // ─── Expired voucher ─────────────────────────────────────────────────────

    function test_expiredVoucherReverts() public {
        uint256 amount = 5_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp - 1; // already expired
        bytes memory sig = _makeVoucher(contributor, amount, deadline, TYPE_CONTRIBUTOR);

        vm.prank(contributor);
        vm.expectRevert("Voucher expired");
        claim.claim(contributor, amount, deadline, TYPE_CONTRIBUTOR, sig);
    }

    // ─── Claim window expired ────────────────────────────────────────────────

    function test_claimAfterWindowReverts() public {
        uint256 amount = 5_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp + 200 days;
        bytes memory sig = _makeVoucher(contributor, amount, deadline, TYPE_CONTRIBUTOR);

        // Warp past 90-day claim window
        vm.warp(block.timestamp + 91 days);

        vm.prank(contributor);
        vm.expectRevert("Claim window expired");
        claim.claim(contributor, amount, deadline, TYPE_CONTRIBUTOR, sig);
    }

    // ─── Sweep unclaimed ─────────────────────────────────────────────────────

    function test_sweepBeforeWindowReverts() public {
        vm.expectRevert("Claim window not expired yet");
        claim.sweepUnclaimed();
    }

    function test_sweepAfterWindowSendsToCurve() public {
        uint256 claimBalance = token.balanceOf(address(claim));
        uint256 curveReserveBefore = curve.tokenReserve();

        vm.warp(block.timestamp + 91 days);
        claim.sweepUnclaimed();

        assertEq(token.balanceOf(address(claim)), 0);
        assertEq(curve.tokenReserve(), curveReserveBefore + claimBalance);
    }

    function test_sweepCannotBeCalledTwice() public {
        vm.warp(block.timestamp + 91 days);
        claim.sweepUnclaimed();

        vm.expectRevert("Already swept");
        claim.sweepUnclaimed();
    }

    function test_partialClaimThenSweep() public {
        // Claim some, then sweep the rest
        uint256 claimAmount = 10_000_000 * 10 ** 18;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _makeVoucher(contributor, claimAmount, deadline, TYPE_CONTRIBUTOR);

        vm.prank(contributor);
        claim.claim(contributor, claimAmount, deadline, TYPE_CONTRIBUTOR, sig);

        uint256 remainingInClaim = token.balanceOf(address(claim));
        uint256 curveReserveBefore = curve.tokenReserve();

        vm.warp(block.timestamp + 91 days);
        claim.sweepUnclaimed();

        assertEq(token.balanceOf(address(claim)), 0);
        assertEq(curve.tokenReserve(), curveReserveBefore + remainingInClaim);
        assertEq(token.balanceOf(contributor), claimAmount); // contributor kept their share
    }
}
