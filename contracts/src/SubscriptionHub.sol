// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {TopicRegistry} from "./TopicRegistry.sol";

/// @title SubscriptionHub
/// @notice On-chain subscription registry for Casid topics (webhooks are off-chain; targets can be contracts).
contract SubscriptionHub {
    struct Subscription {
        uint256 topicId;
        address subscriber;
        address target; // optional contract to call via TriggerExecutor
        bytes32 webhookCommit; // keccak256(webhookUrl) — URL never stored on-chain
        uint64 createdAt;
        bool active;
        uint256 credit; // prepaid units / wei for future metering
    }

    TopicRegistry public immutable registry;
    address public owner;
    uint256 public nextSubId = 1;
    uint256 public minCredit;

    mapping(uint256 => Subscription) public subscriptions;
    mapping(address => uint256[]) public subsBySubscriber;

    event Subscribed(
        uint256 indexed subId,
        uint256 indexed topicId,
        address indexed subscriber,
        address target,
        bytes32 webhookCommit
    );
    event Unsubscribed(uint256 indexed subId);
    event CreditDeposited(uint256 indexed subId, uint256 amount);
    event CreditConsumed(uint256 indexed subId, uint256 amount);

    error TopicInactive();
    error NotSubscriber();
    error SubNotFound();
    error SubInactive();
    error InsufficientCredit();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _registry) {
        registry = TopicRegistry(_registry);
        owner = msg.sender;
    }

    function setMinCredit(uint256 _min) external onlyOwner {
        minCredit = _min;
    }

    function subscribe(uint256 topicId, address target, bytes32 webhookCommit)
        external
        payable
        returns (uint256 subId)
    {
        if (!registry.isActive(topicId)) revert TopicInactive();
        if (msg.value < minCredit) revert InsufficientCredit();

        subId = nextSubId++;
        subscriptions[subId] = Subscription({
            topicId: topicId,
            subscriber: msg.sender,
            target: target,
            webhookCommit: webhookCommit,
            createdAt: uint64(block.timestamp),
            active: true,
            credit: msg.value
        });
        subsBySubscriber[msg.sender].push(subId);

        emit Subscribed(subId, topicId, msg.sender, target, webhookCommit);
        if (msg.value > 0) emit CreditDeposited(subId, msg.value);
    }

    function depositCredit(uint256 subId) external payable {
        Subscription storage s = subscriptions[subId];
        if (s.createdAt == 0) revert SubNotFound();
        if (s.subscriber != msg.sender) revert NotSubscriber();
        s.credit += msg.value;
        emit CreditDeposited(subId, msg.value);
    }

    function unsubscribe(uint256 subId) external {
        Subscription storage s = subscriptions[subId];
        if (s.createdAt == 0) revert SubNotFound();
        if (s.subscriber != msg.sender) revert NotSubscriber();
        s.active = false;
        uint256 refund = s.credit;
        s.credit = 0;
        emit Unsubscribed(subId);
        if (refund > 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    /// @notice Coordinator / executor consumes credit after a successful delivery.
    function consumeCredit(uint256 subId, uint256 amount) external onlyOwner {
        Subscription storage s = subscriptions[subId];
        if (!s.active) revert SubInactive();
        if (s.credit < amount) revert InsufficientCredit();
        s.credit -= amount;
        emit CreditConsumed(subId, amount);
    }

    function getSubscription(uint256 subId) external view returns (Subscription memory) {
        if (subscriptions[subId].createdAt == 0) revert SubNotFound();
        return subscriptions[subId];
    }

    function getSubsBySubscriber(address subscriber) external view returns (uint256[] memory) {
        return subsBySubscriber[subscriber];
    }
}
