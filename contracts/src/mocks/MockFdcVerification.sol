// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFdcVerification} from "../interfaces/IFdcVerification.sol";
import {IPayment} from "../interfaces/IPayment.sol";

/// @notice Demo FDC verifier: accepts any proof with a non-empty merkle proof.
contract MockFdcVerification is IFdcVerification {
    function verifyPayment(IPayment.Proof calldata _proof) external pure returns (bool) {
        return _proof.merkleProof.length > 0;
    }
}
