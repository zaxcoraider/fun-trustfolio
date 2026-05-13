// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RepoToken} from "./RepoToken.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {ContributorClaim} from "./ContributorClaim.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RepoRegistry {
    struct TokenInfo {
        address token;
        address bondingCurve;
        address claimContract;
        address deployer;
        bytes32 imageHash;
        uint256 deployedAt;
    }

    mapping(uint256 => TokenInfo) private _tokens;

    address public immutable treasury;
    address public immutable oracle;

    // Fees
    uint256 public constant LAUNCH_FEE = 0.1 ether;   // goes to treasury
    uint256 public constant CURVE_SEED = 1 ether;      // seeds bonding curve virtual reserve
    uint256 public constant TOTAL_DEPLOY_COST = LAUNCH_FEE + CURVE_SEED;

    // Token distribution (must sum to TOTAL_SUPPLY)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public constant CURVE_ALLOCATION = 850_000_000 * 10 ** 18; // 85%
    uint256 public constant CLAIM_ALLOCATION = 100_000_000 * 10 ** 18; // 10% (owner 5% + contributors 5%)
    uint256 public constant TREASURY_ALLOCATION = 50_000_000 * 10 ** 18; // 5%

    event TokenDeployed(
        uint256 indexed repoId,
        address indexed token,
        address bondingCurve,
        address claimContract,
        address indexed deployer,
        bytes32 imageHash,
        uint256 timestamp
    );

    constructor(address _treasury, address _oracle) {
        require(_treasury != address(0), "Invalid treasury");
        require(_oracle != address(0), "Invalid oracle");
        treasury = _treasury;
        oracle = _oracle;
    }

    // ─── Deploy ──────────────────────────────────────────────────────────────

    function deployToken(
        uint256 repoId,
        string calldata name,
        string calldata symbol,
        bytes32 imageHash
    ) external payable {
        require(_tokens[repoId].token == address(0), "Token already deployed for this repo");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Invalid token name");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 16, "Invalid token symbol");
        require(msg.value >= TOTAL_DEPLOY_COST, "Send 1.1 0G to deploy");

        // 1. Deploy token — mints all supply to this contract
        RepoToken token = new RepoToken(repoId, name, symbol, address(this));

        // 2. Deploy bonding curve — seeded with CURVE_SEED for virtual reserve backing
        BondingCurve curve = new BondingCurve{value: CURVE_SEED}(address(token), treasury);

        // 3. Deploy claim contract
        ContributorClaim claim = new ContributorClaim(
            address(token),
            address(curve),
            oracle,
            treasury,
            repoId
        );

        // 4. Distribute tokens
        IERC20(address(token)).transfer(address(curve), CURVE_ALLOCATION);
        IERC20(address(token)).transfer(address(claim), CLAIM_ALLOCATION);
        IERC20(address(token)).transfer(treasury, TREASURY_ALLOCATION);

        // 5. Store in registry
        _tokens[repoId] = TokenInfo({
            token: address(token),
            bondingCurve: address(curve),
            claimContract: address(claim),
            deployer: msg.sender,
            imageHash: imageHash,
            deployedAt: block.timestamp
        });

        // 6. Send launch fee to treasury
        (bool feeSent,) = treasury.call{value: LAUNCH_FEE}("");
        require(feeSent, "Fee transfer failed");

        // 7. Refund excess
        uint256 excess = msg.value - TOTAL_DEPLOY_COST;
        if (excess > 0) {
            (bool refundSent,) = msg.sender.call{value: excess}("");
            require(refundSent, "Refund failed");
        }

        emit TokenDeployed(
            repoId,
            address(token),
            address(curve),
            address(claim),
            msg.sender,
            imageHash,
            block.timestamp
        );
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getToken(uint256 repoId) external view returns (TokenInfo memory) {
        return _tokens[repoId];
    }

    function isDeployed(uint256 repoId) external view returns (bool) {
        return _tokens[repoId].token != address(0);
    }

    function getTokenAddress(uint256 repoId) external view returns (address) {
        return _tokens[repoId].token;
    }

    function getBondingCurve(uint256 repoId) external view returns (address) {
        return _tokens[repoId].bondingCurve;
    }

    function getClaimContract(uint256 repoId) external view returns (address) {
        return _tokens[repoId].claimContract;
    }
}
