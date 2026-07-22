// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFdcVerification} from "./interfaces/IFdcVerification.sol";
import {TopicLib} from "./libraries/TopicLib.sol";

/// @title ProofVerifier
/// @notice Verifies FDC attestation proofs and enforces single-use (anti-replay).
/// @dev When FDC is unavailable (local/demo), owner may enable mock mode for integration tests.
contract ProofVerifier {
    IFdcVerification public fdcVerification;
    address public owner;
    bool public mockMode;

    /// @dev proofHash => consumed
    mapping(bytes32 => bool) public usedProofs;

    event ProofAccepted(
        bytes32 indexed proofHash, bytes32 indexed attestationType, address indexed submitter
    );
    event MockModeChanged(bool enabled);
    event FdcVerificationUpdated(address indexed fdc);

    error NotOwner();
    error ProofAlreadyUsed();
    error ProofInvalid();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _fdcVerification, bool _mockMode) {
        owner = msg.sender;
        mockMode = _mockMode;
        if (_fdcVerification != address(0)) {
            fdcVerification = IFdcVerification(_fdcVerification);
        }
    }

    function setFdcVerification(address _fdc) external onlyOwner {
        if (_fdc == address(0)) revert ZeroAddress();
        fdcVerification = IFdcVerification(_fdc);
        emit FdcVerificationUpdated(_fdc);
    }

    function setMockMode(bool enabled) external onlyOwner {
        mockMode = enabled;
        emit MockModeChanged(enabled);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @notice Verify and consume a proof. Returns true if valid and newly consumed.
    /// @param attestationType TopicLib kind or FDC type id
    /// @param proof ABI-encoded FDC proof payload (opaque to Casid)
    /// @param proofHash Unique hash binding the economic event (caller-defined commitment)
    function verifyAndConsume(bytes32 attestationType, bytes calldata proof, bytes32 proofHash)
        external
        returns (bool)
    {
        if (usedProofs[proofHash]) revert ProofAlreadyUsed();

        bool ok;
        if (mockMode) {
            // Demo path: accept non-empty proof with non-zero hash
            ok = proof.length > 0 && proofHash != bytes32(0);
        } else {
            ok = _verifyWithFdc(attestationType, proof);
        }

        if (!ok) revert ProofInvalid();

        usedProofs[proofHash] = true;
        emit ProofAccepted(proofHash, attestationType, msg.sender);
        return true;
    }

    /// @notice View-only check without consuming.
    function preview(bytes32 attestationType, bytes calldata proof, bytes32 proofHash)
        external
        view
        returns (bool valid, bool alreadyUsed)
    {
        alreadyUsed = usedProofs[proofHash];
        if (alreadyUsed || proofHash == bytes32(0)) {
            return (false, alreadyUsed);
        }
        if (mockMode) {
            return (proof.length > 0, false);
        }
        return (_verifyWithFdc(attestationType, proof), false);
    }

    function _verifyWithFdc(bytes32 attestationType, bytes calldata proof)
        internal
        view
        returns (bool)
    {
        if (address(fdcVerification) == address(0)) return false;

        if (attestationType == TopicLib.KIND_PAYMENT) {
            return fdcVerification.verifyPayment(proof);
        }
        if (attestationType == TopicLib.KIND_EVM_TX) {
            return fdcVerification.verifyEVMTransaction(proof);
        }
        if (attestationType == TopicLib.KIND_WEB2_JSON) {
            return fdcVerification.verifyWeb2Json(proof);
        }
        return fdcVerification.verifyAttestation(attestationType, proof);
    }
}
