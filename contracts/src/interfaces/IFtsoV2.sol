// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal FTSO V2 feed consumer interface used by Casid price topics.
interface IFtsoV2 {
    function getFeedById(bytes21 _feedId)
        external
        view
        returns (uint256 value, int8 decimals, uint64 timestamp);

    function getFeedByIdInWei(bytes21 _feedId)
        external
        view
        returns (uint256 value, uint64 timestamp);
}
