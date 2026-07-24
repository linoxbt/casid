// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {TopicRegistry} from "../src/TopicRegistry.sol";
import {ProofVerifier} from "../src/ProofVerifier.sol";
import {SubscriptionHub} from "../src/SubscriptionHub.sol";
import {TriggerExecutor} from "../src/TriggerExecutor.sol";
import {MockFdcVerification} from "../src/mocks/MockFdcVerification.sol";
import {MockFtsoV2} from "../src/mocks/MockFtsoV2.sol";
import {TopicLib} from "../src/libraries/TopicLib.sol";

/// @notice Local/anvil deploy; writes addresses to stdout for env wiring.
contract DeployLocalScript is Script {
    function run() external {
        vm.startBroadcast();

        MockFdcVerification mockFdc = new MockFdcVerification();
        MockFtsoV2 mockFtso = new MockFtsoV2();
        mockFtso.setPriceWei(bytes21(bytes("XRP/USD")), 55e16);
        mockFtso.setPriceWei(bytes21(bytes("FLR/USD")), 2e16);

        TopicRegistry registry = new TopicRegistry();
        ProofVerifier verifier = new ProofVerifier(address(mockFdc), true);
        SubscriptionHub hub = new SubscriptionHub(address(registry));
        TriggerExecutor executor =
            new TriggerExecutor(address(verifier), address(registry), address(hub), address(mockFtso));
        verifier.setConsumer(address(executor));

        // Local deployment mirrors production seeding: no fake payment destinations.
        bytes21 feedId = bytes21(bytes("XRP/USD"));
        bytes32 ftsoSchema =
            TopicLib.ftsoThresholdSchemaHash(feedId, TopicLib.CompareOp.Gte, 5e17);
        uint256 ftsoTopic = registry.createTopic(
            TopicLib.KIND_FTSO_THRESHOLD,
            ftsoSchema,
            "topic://ftso/price/XRP-USD/threshold/gte/0.50"
        );

        console2.log("=== CASID DEPLOYMENT ===");
        console2.log("MockFdcVerification=", address(mockFdc));
        console2.log("MockFtsoV2=", address(mockFtso));
        console2.log("TOPIC_REGISTRY_ADDRESS=", address(registry));
        console2.log("PROOF_VERIFIER_ADDRESS=", address(verifier));
        console2.log("SUBSCRIPTION_HUB_ADDRESS=", address(hub));
        console2.log("TRIGGER_EXECUTOR_ADDRESS=", address(executor));
        console2.log("ftsoTopic=", ftsoTopic);

        vm.stopBroadcast();
    }
}
