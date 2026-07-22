// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFdcVerification} from "../interfaces/IFdcVerification.sol";

/// @notice Demo FDC verifier: accepts any non-empty proof.
contract MockFdcVerification is IFdcVerification {
    function verifyPayment(bytes calldata _proof) external pure returns (bool) {
        return _proof.length > 0;
    }

    function verifyEVMTransaction(bytes calldata _proof) external pure returns (bool) {
        return _proof.length > 0;
    }

    function verifyWeb2Json(bytes calldata _proof) external pure returns (bool) {
        return _proof.length > 0;
    }

    function verifyAttestation(bytes32, bytes calldata _proof) external pure returns (bool) {
        return _proof.length > 0;
    }
}
