// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ProofVerifier} from "./ProofVerifier.sol";
import {TopicRegistry} from "./TopicRegistry.sol";
import {SubscriptionHub} from "./SubscriptionHub.sol";
import {TopicLib} from "./libraries/TopicLib.sol";
import {IFtsoV2} from "./interfaces/IFtsoV2.sol";

/// @title TriggerExecutor
/// @notice Proof-gated execution: after FDC/mock proof acceptance, emit event and optional target call.
/// @dev Also supports pure FTSO threshold checks for price topics (no FDC proof required).
contract TriggerExecutor {
    ProofVerifier public immutable proofVerifier;
    TopicRegistry public immutable registry;
    SubscriptionHub public immutable hub;
    IFtsoV2 public ftsoV2;
    address public owner;

    /// @dev Optional tip token / native tip accounting for demo "unlock" flows
    mapping(address => uint256) public pendingTips;

    event TriggerFired(
        uint256 indexed topicId,
        uint256 indexed subId,
        bytes32 indexed proofHash,
        address target,
        bytes32 eventCommitment
    );
    event TipDeposited(address indexed beneficiary, uint256 amount);
    event TipClaimed(address indexed beneficiary, uint256 amount);
    event FtsoUpdated(address indexed ftso);

    error NotOwner();
    error TopicInactive();
    error SubMismatch();
    error ThresholdNotMet();
    error CallFailed();
    error NothingToClaim();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _proofVerifier, address _registry, address _hub, address _ftsoV2) {
        proofVerifier = ProofVerifier(_proofVerifier);
        registry = TopicRegistry(_registry);
        hub = SubscriptionHub(_hub);
        owner = msg.sender;
        if (_ftsoV2 != address(0)) {
            ftsoV2 = IFtsoV2(_ftsoV2);
        }
    }

    function setFtsoV2(address _ftso) external onlyOwner {
        if (_ftso == address(0)) revert ZeroAddress();
        ftsoV2 = IFtsoV2(_ftso);
        emit FtsoUpdated(_ftso);
    }

    /// @notice Fire a trigger with an FDC (or mock) attestation proof.
    /// @param topicId Registered topic
    /// @param subId Subscription (0 if none)
    /// @param attestationType TopicLib kind
    /// @param proof Opaque FDC proof bytes
    /// @param proofHash Unique event commitment (anti-replay)
    /// @param eventCommitment Application payload hash (e.g. payment details)
    /// @param targetCalldata Optional calldata if sub has a target
    function fireWithProof(
        uint256 topicId,
        uint256 subId,
        bytes32 attestationType,
        bytes calldata proof,
        bytes32 proofHash,
        bytes32 eventCommitment,
        bytes calldata targetCalldata
    ) external {
        if (!registry.isActive(topicId)) revert TopicInactive();

        proofVerifier.verifyAndConsume(attestationType, proof, proofHash);

        address target = address(0);
        if (subId != 0) {
            SubscriptionHub.Subscription memory sub = hub.getSubscription(subId);
            if (sub.topicId != topicId || !sub.active) revert SubMismatch();
            target = sub.target;
        }

        emit TriggerFired(topicId, subId, proofHash, target, eventCommitment);

        if (target != address(0) && targetCalldata.length > 0) {
            (bool ok,) = target.call(targetCalldata);
            if (!ok) revert CallFailed();
        }
    }

    /// @notice Fire when an FTSO feed crosses a threshold (price topic path).
    function fireFtsoThreshold(
        uint256 topicId,
        uint256 subId,
        bytes21 feedId,
        TopicLib.CompareOp op,
        uint256 thresholdWei,
        bytes32 eventCommitment,
        bytes calldata targetCalldata
    ) external {
        if (!registry.isActive(topicId)) revert TopicInactive();
        if (address(ftsoV2) == address(0)) revert ThresholdNotMet();

        (uint256 value,) = ftsoV2.getFeedByIdInWei(feedId);
        if (!TopicLib.compare(op, value, thresholdWei)) revert ThresholdNotMet();

        // Bind proof hash to feed snapshot to limit replay within same price
        bytes32 proofHash =
            keccak256(abi.encode(topicId, feedId, op, thresholdWei, value, block.number / 10));

        // Consume via mock-compatible path: encode value as "proof"
        bytes memory proof = abi.encode(value, block.timestamp);
        proofVerifier.verifyAndConsume(TopicLib.KIND_FTSO_THRESHOLD, proof, proofHash);

        address target = address(0);
        if (subId != 0) {
            SubscriptionHub.Subscription memory sub = hub.getSubscription(subId);
            if (sub.topicId != topicId || !sub.active) revert SubMismatch();
            target = sub.target;
        }

        emit TriggerFired(topicId, subId, proofHash, target, eventCommitment);

        if (target != address(0) && targetCalldata.length > 0) {
            (bool ok,) = target.call(targetCalldata);
            if (!ok) revert CallFailed();
        }
    }

    /// @notice Demo helper: deposit a tip unlocked by a future trigger consumer.
    function depositTip(address beneficiary) external payable {
        pendingTips[beneficiary] += msg.value;
        emit TipDeposited(beneficiary, msg.value);
    }

    function claimTip() external {
        uint256 amount = pendingTips[msg.sender];
        if (amount == 0) revert NothingToClaim();
        pendingTips[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert CallFailed();
        emit TipClaimed(msg.sender, amount);
    }

    receive() external payable {}
}
