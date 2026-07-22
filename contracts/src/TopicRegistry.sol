// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {TopicLib} from "./libraries/TopicLib.sol";

/// @title TopicRegistry
/// @notice Canonical registry of attested economic event topics on Casid.
/// @dev Topics are append-versioned; schema hashes are immutable once registered.
contract TopicRegistry {
    using TopicLib for *;

    uint256 public nextTopicId = 1;

    mapping(uint256 => TopicLib.TopicMeta) public topics;
    /// @dev topicId => child topic ids (for COMPOSITION kinds)
    mapping(uint256 => uint256[]) public compositionChildren;
    mapping(uint256 => TopicLib.CompositionOp) public compositionOp;
    /// @dev schemaHash => topicId (first registration wins for dedup lookups)
    mapping(bytes32 => uint256) public topicBySchema;
    /// @dev uri hash => topicId
    mapping(bytes32 => uint256) public topicByUriHash;

    event TopicCreated(
        uint256 indexed topicId,
        bytes32 indexed kind,
        bytes32 schemaHash,
        string uri,
        address indexed creator
    );
    event TopicStatusChanged(uint256 indexed topicId, bool active);

    error EmptyUri();
    error InvalidKind();
    error TopicNotFound();
    error NotCreator();
    error CompositionNeedsChildren();

    /// @notice Register a leaf topic (Payment, FTSO, Web2Json, etc.).
    function createTopic(bytes32 kind, bytes32 schemaHash, string calldata uri)
        external
        returns (uint256 topicId)
    {
        if (bytes(uri).length == 0) revert EmptyUri();
        if (kind == bytes32(0) || schemaHash == bytes32(0)) revert InvalidKind();

        topicId = nextTopicId++;
        topics[topicId] = TopicLib.TopicMeta({
            kind: kind,
            schemaHash: schemaHash,
            uri: uri,
            createdAt: uint64(block.timestamp),
            creator: msg.sender,
            active: true
        });

        if (topicBySchema[schemaHash] == 0) {
            topicBySchema[schemaHash] = topicId;
        }
        topicByUriHash[keccak256(bytes(uri))] = topicId;

        emit TopicCreated(topicId, kind, schemaHash, uri, msg.sender);
    }

    /// @notice Register a composition topic that fires when children match under AND/OR.
    function createComposition(
        TopicLib.CompositionOp op,
        uint256[] calldata childTopicIds,
        string calldata uri
    ) external returns (uint256 topicId) {
        if (bytes(uri).length == 0) revert EmptyUri();
        if (childTopicIds.length < 2) revert CompositionNeedsChildren();

        for (uint256 i = 0; i < childTopicIds.length; i++) {
            if (topics[childTopicIds[i]].createdAt == 0) revert TopicNotFound();
        }

        bytes32[] memory childHashes = new bytes32[](childTopicIds.length);
        for (uint256 i = 0; i < childTopicIds.length; i++) {
            childHashes[i] = bytes32(childTopicIds[i]);
        }
        bytes32 schemaHash = TopicLib.compositionSchemaHash(op, childHashes);

        topicId = nextTopicId++;
        topics[topicId] = TopicLib.TopicMeta({
            kind: TopicLib.KIND_COMPOSITION,
            schemaHash: schemaHash,
            uri: uri,
            createdAt: uint64(block.timestamp),
            creator: msg.sender,
            active: true
        });
        compositionOp[topicId] = op;
        for (uint256 i = 0; i < childTopicIds.length; i++) {
            compositionChildren[topicId].push(childTopicIds[i]);
        }

        if (topicBySchema[schemaHash] == 0) {
            topicBySchema[schemaHash] = topicId;
        }
        topicByUriHash[keccak256(bytes(uri))] = topicId;

        emit TopicCreated(topicId, TopicLib.KIND_COMPOSITION, schemaHash, uri, msg.sender);
    }

    function setActive(uint256 topicId, bool active) external {
        TopicLib.TopicMeta storage t = topics[topicId];
        if (t.createdAt == 0) revert TopicNotFound();
        if (t.creator != msg.sender) revert NotCreator();
        t.active = active;
        emit TopicStatusChanged(topicId, active);
    }

    function getTopic(uint256 topicId) external view returns (TopicLib.TopicMeta memory) {
        if (topics[topicId].createdAt == 0) revert TopicNotFound();
        return topics[topicId];
    }

    function getCompositionChildren(uint256 topicId) external view returns (uint256[] memory) {
        return compositionChildren[topicId];
    }

    function isActive(uint256 topicId) external view returns (bool) {
        return topics[topicId].active && topics[topicId].createdAt != 0;
    }
}
