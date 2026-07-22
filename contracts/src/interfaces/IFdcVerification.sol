// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal interface matching Flare FDC verification surface used by Casid.
/// @dev On Coston2/Mainnet, wire to the deployed FdcVerification contract.
interface IFdcVerification {
    /// @notice Verify a Payment attestation Merkle proof against the relayed root.
    function verifyPayment(bytes calldata _proof) external view returns (bool);

    /// @notice Verify an EVMTransaction attestation.
    function verifyEVMTransaction(bytes calldata _proof) external view returns (bool);

    /// @notice Verify a Web2Json attestation.
    function verifyWeb2Json(bytes calldata _proof) external view returns (bool);

    /// @notice Generic attestation verification by type identifier.
    function verifyAttestation(bytes32 _attestationType, bytes calldata _proof)
        external
        view
        returns (bool);
}
