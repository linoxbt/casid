// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title TopicLib
/// @notice Canonical topic identifiers and schema hashing for Casid attested topics.
library TopicLib {
    bytes32 internal constant KIND_PAYMENT = keccak256("PAYMENT");
    bytes32 internal constant KIND_FTSO_THRESHOLD = keccak256("FTSO_THRESHOLD");
    bytes32 internal constant KIND_WEB2_JSON = keccak256("WEB2_JSON");
    bytes32 internal constant KIND_EVM_TX = keccak256("EVM_TRANSACTION");
    bytes32 internal constant KIND_COMPOSITION = keccak256("COMPOSITION");
    bytes32 internal constant KIND_FASSET_LIFECYCLE = keccak256("FASSET_LIFECYCLE");

    enum CompareOp {
        Gt,
        Gte,
        Lt,
        Lte,
        Eq
    }

    enum CompositionOp {
        And,
        Or
    }

    struct TopicMeta {
        bytes32 kind;
        bytes32 schemaHash;
        string uri; // human-readable topic://...
        uint64 createdAt;
        address creator;
        bool active;
    }

    /// @notice Schema hash for a Payment topic (chain + destination commitment).
    function paymentSchemaHash(bytes32 chainId, bytes32 destinationHash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(KIND_PAYMENT, chainId, destinationHash));
    }

    /// @notice Schema hash for FTSO threshold topic.
    function ftsoThresholdSchemaHash(bytes21 feedId, CompareOp op, uint256 thresholdWei)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(KIND_FTSO_THRESHOLD, feedId, op, thresholdWei));
    }

    /// @notice Schema hash for a boolean composition of child topic IDs.
    function compositionSchemaHash(CompositionOp op, bytes32[] memory childTopicIds)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(KIND_COMPOSITION, op, childTopicIds));
    }

    function compare(CompareOp op, uint256 value, uint256 threshold) internal pure returns (bool) {
        if (op == CompareOp.Gt) return value > threshold;
        if (op == CompareOp.Gte) return value >= threshold;
        if (op == CompareOp.Lt) return value < threshold;
        if (op == CompareOp.Lte) return value <= threshold;
        return value == threshold;
    }
}
