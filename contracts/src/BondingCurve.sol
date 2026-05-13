// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable treasury;

    // Virtual AMM state (pump.fun style constant product)
    // invariant: virtualNativeReserve * tokenReserve = k
    uint256 public virtualNativeReserve;
    uint256 public tokenReserve;

    bool public graduated;

    uint256 public constant TOTAL_CURVE_TOKENS = 850_000_000 * 10 ** 18;
    // Graduate when 80% of curve tokens are sold (680M)
    uint256 public constant GRADUATION_THRESHOLD = 680_000_000 * 10 ** 18;
    uint256 public constant FEE_BPS = 100; // 1%
    uint256 public constant BPS = 10_000;

    event TokensBought(address indexed buyer, uint256 nativeIn, uint256 tokensOut, uint256 fee);
    event TokensSold(address indexed seller, uint256 tokensIn, uint256 nativeOut, uint256 fee);
    event Graduated(uint256 totalNativeRaised, uint256 remainingTokens, uint256 timestamp);
    event TokensReceived(uint256 amount);

    // Only set after graduation — native + tokens locked here until DEX integration
    uint256 public graduationNativeBalance;
    uint256 public graduationTokenBalance;

    constructor(address _token, address _treasury) payable {
        require(msg.value > 0, "Must seed curve with native");
        token = IERC20(_token);
        treasury = _treasury;
        // seed becomes the initial virtual reserve — backs early sell liquidity
        virtualNativeReserve = msg.value;
        tokenReserve = TOTAL_CURVE_TOKENS;
    }

    // ─── Buy ────────────────────────────────────────────────────────────────

    function buy(uint256 minTokensOut) external payable nonReentrant {
        require(!graduated, "Token graduated to DEX");
        require(msg.value > 0, "Send 0G to buy");

        uint256 fee = (msg.value * FEE_BPS) / BPS;
        uint256 nativeForCurve = msg.value - fee;

        // Constant product: tokensOut = tokenReserve * nativeIn / (virtualNativeReserve + nativeIn)
        uint256 tokensOut = (tokenReserve * nativeForCurve) / (virtualNativeReserve + nativeForCurve);
        require(tokensOut > 0, "Tokens out is zero");
        require(tokensOut >= minTokensOut, "Slippage exceeded");
        require(tokensOut <= tokenReserve, "Exceeds available tokens");

        virtualNativeReserve += nativeForCurve;
        tokenReserve -= tokensOut;

        _sendFee(fee);
        token.safeTransfer(msg.sender, tokensOut);

        emit TokensBought(msg.sender, msg.value, tokensOut, fee);

        uint256 tokensSold = TOTAL_CURVE_TOKENS - tokenReserve;
        if (tokensSold >= GRADUATION_THRESHOLD) {
            _graduate();
        }
    }

    // ─── Sell ───────────────────────────────────────────────────────────────

    function sell(uint256 tokenAmount, uint256 minNativeOut) external nonReentrant {
        require(!graduated, "Token graduated to DEX");
        require(tokenAmount > 0, "Amount must be > 0");

        // Constant product: nativeOut = virtualNativeReserve * tokensIn / (tokenReserve + tokensIn)
        uint256 grossNativeOut = (virtualNativeReserve * tokenAmount) / (tokenReserve + tokenAmount);
        require(grossNativeOut <= address(this).balance, "Insufficient curve liquidity");

        uint256 fee = (grossNativeOut * FEE_BPS) / BPS;
        uint256 nativeOut = grossNativeOut - fee;
        require(nativeOut >= minNativeOut, "Slippage exceeded");

        // Receive tokens from seller first (checks-effects-interactions)
        token.safeTransferFrom(msg.sender, address(this), tokenAmount);

        virtualNativeReserve -= grossNativeOut;
        tokenReserve += tokenAmount;

        _sendFee(fee);

        (bool sent,) = msg.sender.call{value: nativeOut}("");
        require(sent, "Native transfer failed");

        emit TokensSold(msg.sender, tokenAmount, nativeOut, fee);
    }

    // ─── Read helpers ────────────────────────────────────────────────────────

    function getTokensForNative(uint256 nativeAmount) external view returns (uint256) {
        if (graduated) return 0;
        uint256 fee = (nativeAmount * FEE_BPS) / BPS;
        uint256 nativeForCurve = nativeAmount - fee;
        return (tokenReserve * nativeForCurve) / (virtualNativeReserve + nativeForCurve);
    }

    function getNativeForTokens(uint256 tokenAmount) external view returns (uint256) {
        if (graduated) return 0;
        uint256 grossNative = (virtualNativeReserve * tokenAmount) / (tokenReserve + tokenAmount);
        uint256 fee = (grossNative * FEE_BPS) / BPS;
        return grossNative - fee;
    }

    // Returns current spot price in native per 1e18 tokens
    function getSpotPrice() external view returns (uint256) {
        if (tokenReserve == 0) return type(uint256).max;
        return (virtualNativeReserve * 10 ** 18) / tokenReserve;
    }

    function getProgress() external view returns (uint256 tokensSold, uint256 threshold) {
        tokensSold = TOTAL_CURVE_TOKENS - tokenReserve;
        threshold = GRADUATION_THRESHOLD;
    }

    // ─── Receive unclaimed tokens from ContributorClaim ─────────────────────

    function receiveTokens(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        tokenReserve += amount;
        emit TokensReceived(amount);
    }

    // ─── Graduation ──────────────────────────────────────────────────────────

    function _graduate() internal {
        graduated = true;
        graduationNativeBalance = address(this).balance;
        graduationTokenBalance = tokenReserve;
        // Phase 4+: send native + tokens to 0G DEX, burn LP tokens
        // For now: lock the curve, emit event, DEX integration comes later
        emit Graduated(graduationNativeBalance, graduationTokenBalance, block.timestamp);
    }

    function _sendFee(uint256 fee) internal {
        if (fee == 0) return;
        (bool sent,) = treasury.call{value: fee}("");
        require(sent, "Fee transfer failed");
    }

    receive() external payable {}
}
