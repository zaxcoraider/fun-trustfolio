// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RepoToken is ERC20 {
    uint256 public immutable repoId;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    constructor(uint256 _repoId, string memory name, string memory symbol, address registry)
        ERC20(name, symbol)
    {
        repoId = _repoId;
        _mint(registry, TOTAL_SUPPLY);
    }
}
