// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console2} from "forge-std/Test.sol";
import {TopicRegistry} from "../src/TopicRegistry.sol";
import {ProofVerifier} from "../src/ProofVerifier.sol";
import {SubscriptionHub} from "../src/SubscriptionHub.sol";
import {TriggerExecutor} from "../src/TriggerExecutor.sol";
import {MockFdcVerification} from "../src/mocks/MockFdcVerification.sol";
import {MockFtsoV2} from "../src/mocks/MockFtsoV2.sol";
import {TopicLib} from "../src/libraries/TopicLib.sol";

contract CasidTest is Test {
    TopicRegistry registry;
    ProofVerifier verifier;
    SubscriptionHub hub;
    TriggerExecutor executor;
    MockFtsoV2 ftso;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        MockFdcVerification mockFdc = new MockFdcVerification();
        ftso = new MockFtsoV2();
        ftso.setPriceWei(bytes21(bytes("XRP/USD")), 6e17); // $0.60

        registry = new TopicRegistry();
        verifier = new ProofVerifier(address(mockFdc), true);
        hub = new SubscriptionHub(address(registry));
        executor =
            new TriggerExecutor(address(verifier), address(registry), address(hub), address(ftso));
        verifier.setConsumer(address(executor));

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_createPaymentTopic() public {
        bytes32 schema =
            TopicLib.paymentSchemaHash(keccak256("XRPL"), keccak256("rAlice"));
        uint256 id = registry.createTopic(
            TopicLib.KIND_PAYMENT, schema, "topic://payment/xrp/rAlice"
        );
        assertEq(id, 1);
        assertTrue(registry.isActive(id));
    }

    function test_subscribeAndFireProof() public {
        bytes32 schema =
            TopicLib.paymentSchemaHash(keccak256("XRPL"), keccak256("rBob"));
        uint256 topicId = registry.createTopic(
            TopicLib.KIND_PAYMENT, schema, "topic://payment/xrp/rBob"
        );

        vm.prank(alice);
        uint256 subId = hub.subscribe{value: 0.01 ether}(
            topicId, address(0), keccak256("https://hooks.example.com/casid")
        );

        bytes memory proof = abi.encode("fdc-payment-proof-demo");
        bytes32 proofHash = keccak256(abi.encode("xrpl-tx-abc", uint256(1_000_000)));
        bytes32 eventCommitment = keccak256("payment-details");

        vm.expectEmit(true, true, true, false);
        emit TriggerExecutor.TriggerFired(topicId, subId, proofHash, address(0), eventCommitment);

        executor.fireWithProof(
            topicId,
            subId,
            TopicLib.KIND_PAYMENT,
            proof,
            proofHash,
            eventCommitment,
            ""
        );
    }

    function test_proofReplayReverts() public {
        bytes32 schema =
            TopicLib.paymentSchemaHash(keccak256("XRPL"), keccak256("rReplay"));
        uint256 topicId = registry.createTopic(
            TopicLib.KIND_PAYMENT, schema, "topic://payment/xrp/rReplay"
        );

        bytes memory proof = abi.encode("proof");
        bytes32 proofHash = keccak256("once");

        executor.fireWithProof(topicId, 0, TopicLib.KIND_PAYMENT, proof, proofHash, bytes32(0), "");

        vm.expectRevert(ProofVerifier.ProofAlreadyUsed.selector);
        executor.fireWithProof(topicId, 0, TopicLib.KIND_PAYMENT, proof, proofHash, bytes32(0), "");
    }

    function test_ftsoThresholdFire() public {
        bytes21 feedId = bytes21(bytes("XRP/USD"));
        bytes32 schema =
            TopicLib.ftsoThresholdSchemaHash(feedId, TopicLib.CompareOp.Gte, 5e17);
        uint256 topicId = registry.createTopic(
            TopicLib.KIND_FTSO_THRESHOLD,
            schema,
            "topic://ftso/price/XRP-USD/threshold/gte/0.50"
        );

        executor.fireFtsoThreshold(
            topicId, 0, feedId, TopicLib.CompareOp.Gte, 5e17, keccak256("price-event"), ""
        );
    }

    function test_ftsoThresholdNotMet() public {
        bytes21 feedId = bytes21(bytes("XRP/USD"));
        ftso.setPriceWei(feedId, 1e17); // $0.10
        bytes32 schema =
            TopicLib.ftsoThresholdSchemaHash(feedId, TopicLib.CompareOp.Gte, 5e17);
        uint256 topicId = registry.createTopic(
            TopicLib.KIND_FTSO_THRESHOLD,
            schema,
            "topic://ftso/price/XRP-USD/threshold/gte/0.50"
        );

        vm.expectRevert(TriggerExecutor.ThresholdNotMet.selector);
        executor.fireFtsoThreshold(
            topicId, 0, feedId, TopicLib.CompareOp.Gte, 5e17, bytes32(0), ""
        );
    }

    function test_compositionTopic() public {
        bytes32 s1 = TopicLib.paymentSchemaHash(keccak256("XRPL"), keccak256("rC"));
        uint256 t1 = registry.createTopic(TopicLib.KIND_PAYMENT, s1, "topic://payment/xrp/rC");
        bytes32 s2 = TopicLib.ftsoThresholdSchemaHash(
            bytes21(bytes("XRP/USD")), TopicLib.CompareOp.Gte, 1
        );
        uint256 t2 =
            registry.createTopic(TopicLib.KIND_FTSO_THRESHOLD, s2, "topic://ftso/price/XRP-USD/t");

        uint256[] memory children = new uint256[](2);
        children[0] = t1;
        children[1] = t2;
        uint256 comp = registry.createComposition(
            TopicLib.CompositionOp.And, children, "topic://composition/and/demo"
        );
        assertEq(registry.getCompositionChildren(comp).length, 2);
        assertTrue(registry.isActive(comp));
    }

    function test_tipUnlockDemo() public {
        vm.prank(alice);
        executor.depositTip{value: 1 ether}(bob);
        assertEq(executor.pendingTips(bob), 1 ether);

        uint256 before = bob.balance;
        vm.prank(bob);
        executor.claimTip();
        assertEq(bob.balance, before + 1 ether);
    }
}
