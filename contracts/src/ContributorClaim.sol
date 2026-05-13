// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IBondingCurve {
    function receiveTokens(uint256 amount) external;
}

contract ContributorClaim {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public immutable token;
    IBondingCurve public immutable bondingCurve;
    address public immutable oracle;   // backend signing key
    address public immutable treasury; // fallback if curve is graduated at sweep time
    uint256 public immutable repoId;
    uint256 public immutable deployedAt;

    uint256 public constant CLAIM_WINDOW = 90 days;

    // Claim type constants
    uint8 public constant TYPE_CONTRIBUTOR = 0;
    uint8 public constant TYPE_OWNER = 1;

    // Tracks used vouchers to prevent replay
    mapping(bytes32 => bool) public usedVouchers;

    bool public swept;
    uint256 public totalClaimed;

    event Claimed(address indexed claimant, uint256 amount, uint8 claimType);
    event Swept(uint256 amount, address indexed destination);

    constructor(
        address _token,
        address _bondingCurve,
        address _oracle,
        address _treasury,
        uint256 _repoId
    ) {
        token = IERC20(_token);
        bondingCurve = IBondingCurve(_bondingCurve);
        oracle = _oracle;
        treasury = _treasury;
        repoId = _repoId;
        deployedAt = block.timestamp;
    }

    // ─── Claim ───────────────────────────────────────────────────────────────
    //
    // Backend signs: keccak256(abi.encodePacked(chainId, repoId, claimant, amount, deadline, claimType))
    // Using EIP-191 personal_sign (prefixed hash).
    //
    // claimType: 0 = contributor, 1 = owner
    //
    function claim(
        address claimant,
        uint256 amount,
        uint256 deadline,
        uint8 claimType,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deployedAt + CLAIM_WINDOW, "Claim window expired");
        require(block.timestamp <= deadline, "Voucher expired");
        require(!swept, "Already swept");
        require(claimType == TYPE_CONTRIBUTOR || claimType == TYPE_OWNER, "Invalid claim type");
        require(amount > 0, "Amount must be > 0");

        bytes32 voucherHash = keccak256(
            abi.encodePacked(block.chainid, repoId, claimant, amount, deadline, claimType)
        );
        require(!usedVouchers[voucherHash], "Voucher already used");

        // Verify oracle signature (EIP-191)
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(voucherHash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == oracle, "Invalid oracle signature");

        usedVouchers[voucherHash] = true;
        totalClaimed += amount;

        token.safeTransfer(claimant, amount);

        emit Claimed(claimant, amount, claimType);
    }

    // ─── Sweep unclaimed after 90 days ───────────────────────────────────────
    //
    // Anyone can call this after the claim window expires.
    // Unclaimed tokens → bonding curve liquidity (pumps the token).
    // If curve is graduated, tokens go to treasury instead.
    //
    function sweepUnclaimed() external {
        require(block.timestamp > deployedAt + CLAIM_WINDOW, "Claim window not expired yet");
        require(!swept, "Already swept");

        swept = true;
        uint256 remaining = token.balanceOf(address(this));
        if (remaining == 0) return;

        // Approve and send to bonding curve liquidity
        // If curve is graduated/locked, fall back to treasury
        token.forceApprove(address(bondingCurve), remaining);
        try bondingCurve.receiveTokens(remaining) {
            emit Swept(remaining, address(bondingCurve));
        } catch {
            // Curve graduated or locked — send to treasury
            token.forceApprove(address(bondingCurve), 0); // revoke approval
            token.safeTransfer(treasury, remaining);
            emit Swept(remaining, treasury);
        }
    }

    function claimWindowEnd() external view returns (uint256) {
        return deployedAt + CLAIM_WINDOW;
    }

    function claimWindowExpired() external view returns (bool) {
        return block.timestamp > deployedAt + CLAIM_WINDOW;
    }
}
