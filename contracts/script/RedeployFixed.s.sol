// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {ProofVerifier} from "../src/ProofVerifier.sol";
import {TriggerExecutor} from "../src/TriggerExecutor.sol";

/// @notice Redeploys ONLY ProofVerifier + TriggerExecutor with the fixed
/// IFdcVerification interface (typed IPayment.Proof struct instead of raw
/// bytes). TopicRegistry, SubscriptionHub, and FtsoV2 are unaffected by that
/// bug and are reused as-is — narrower than Deploy.s.sol, which redeploys
/// everything.
///
/// Required env: DEPLOYER_PRIVATE_KEY, TOPIC_REGISTRY_ADDRESS,
/// SUBSCRIPTION_HUB_ADDRESS, FDC_VERIFICATION_ADDRESS, FTSO_V2_ADDRESS
contract RedeployFixedScript is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address registry = vm.envAddress("TOPIC_REGISTRY_ADDRESS");
        address hub = vm.envAddress("SUBSCRIPTION_HUB_ADDRESS");
        address fdcVerification = vm.envAddress("FDC_VERIFICATION_ADDRESS");
        address ftsoV2 = vm.envAddress("FTSO_V2_ADDRESS");

        vm.startBroadcast(pk);

        ProofVerifier verifier = new ProofVerifier(fdcVerification, false);
        TriggerExecutor executor = new TriggerExecutor(address(verifier), registry, hub, ftsoV2);
        verifier.setConsumer(address(executor));

        vm.stopBroadcast();

        console2.log("ProofVerifier (fixed)", address(verifier));
        console2.log("TriggerExecutor (fixed)", address(executor));
        console2.log("mockMode", verifier.mockMode());
        console2.log("consumer", verifier.consumer());
    }
}
