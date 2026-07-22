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

/// @notice Deploy Casid core stack (demo mode with mock FDC/FTSO by default).
contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        bool useMocks = vm.envOr("CASID_USE_MOCKS", true);

        if (pk != 0) {
            vm.startBroadcast(pk);
        } else {
            vm.startBroadcast();
        }

        address fdcAddr;
        address ftsoAddr;

        if (useMocks) {
            MockFdcVerification mockFdc = new MockFdcVerification();
            MockFtsoV2 mockFtso = new MockFtsoV2();
            // FLR/USD-ish demo price: $0.02 = 2e16 wei units if 1e18 = $1
            mockFtso.setPriceWei(bytes21(bytes("FLR/USD")), 2e16);
            mockFtso.setPriceWei(bytes21(bytes("XRP/USD")), 55e16);
            fdcAddr = address(mockFdc);
            ftsoAddr = address(mockFtso);
            console2.log("MockFdcVerification", fdcAddr);
            console2.log("MockFtsoV2", ftsoAddr);
        } else {
            fdcAddr = vm.envAddress("FDC_VERIFICATION_ADDRESS");
            ftsoAddr = vm.envAddress("FTSO_V2_ADDRESS");
        }

        TopicRegistry registry = new TopicRegistry();
        ProofVerifier verifier = new ProofVerifier(fdcAddr, useMocks);
        SubscriptionHub hub = new SubscriptionHub(address(registry));
        TriggerExecutor executor =
            new TriggerExecutor(address(verifier), address(registry), address(hub), ftsoAddr);

        // Seed demo topics
        bytes32 paySchema = TopicLib.paymentSchemaHash(
            keccak256("XRPL"), keccak256(bytes("rCasidDemoDestination000000000001"))
        );
        uint256 paymentTopic = registry.createTopic(
            TopicLib.KIND_PAYMENT,
            paySchema,
            "topic://payment/xrp/rCasidDemoDestination000000000001"
        );

        bytes21 feedId = bytes21(bytes("XRP/USD"));
        bytes32 ftsoSchema =
            TopicLib.ftsoThresholdSchemaHash(feedId, TopicLib.CompareOp.Gte, 5e17); // >= $0.50
        uint256 ftsoTopic = registry.createTopic(
            TopicLib.KIND_FTSO_THRESHOLD,
            ftsoSchema,
            "topic://ftso/price/XRP-USD/threshold/gte/0.50"
        );

        uint256[] memory children = new uint256[](2);
        children[0] = paymentTopic;
        children[1] = ftsoTopic;
        uint256 compositionTopic = registry.createComposition(
            TopicLib.CompositionOp.And,
            children,
            "topic://composition/and/xrp-payment+xrp-price-gte-0.50"
        );

        console2.log("TopicRegistry", address(registry));
        console2.log("ProofVerifier", address(verifier));
        console2.log("SubscriptionHub", address(hub));
        console2.log("TriggerExecutor", address(executor));
        console2.log("paymentTopic", paymentTopic);
        console2.log("ftsoTopic", ftsoTopic);
        console2.log("compositionTopic", compositionTopic);

        vm.stopBroadcast();
    }
}
