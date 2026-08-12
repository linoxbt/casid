// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IPayment} from "./IPayment.sol";

/// @notice Matches the real, deployed Flare FdcVerification contract's surface
/// for the attestation types Casid consumes on-chain. The real contract takes
/// typed proof structs (confirmed against the live Coston2 implementation ABI
/// at 0x6E33205293aE1C6dcC91249951A5A67C863918A7) — it does NOT accept opaque
/// bytes. Only Payment is wired today; other attestation types aren't
/// consumed on-chain by Casid yet.
interface IFdcVerification {
    /// @notice Verify a Payment attestation Merkle proof against the relayed root.
    function verifyPayment(IPayment.Proof calldata _proof) external view returns (bool);
}
