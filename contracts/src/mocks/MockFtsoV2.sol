// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFtsoV2} from "../interfaces/IFtsoV2.sol";

/// @notice Configurable mock FTSO for local tests and demos.
contract MockFtsoV2 is IFtsoV2 {
    mapping(bytes21 => uint256) public pricesWei;
    mapping(bytes21 => uint64) public timestamps;

    function setPriceWei(bytes21 feedId, uint256 priceWei) external {
        pricesWei[feedId] = priceWei;
        timestamps[feedId] = uint64(block.timestamp);
    }

    function getFeedById(bytes21 _feedId)
        external
        view
        returns (uint256 value, int8 decimals, uint64 timestamp)
    {
        return (pricesWei[_feedId] / 1e10, 8, timestamps[_feedId]);
    }

    function getFeedByIdInWei(bytes21 _feedId)
        external
        view
        returns (uint256 value, uint64 timestamp)
    {
        return (pricesWei[_feedId], timestamps[_feedId]);
    }
}
