// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console2} from "forge-std/Script.sol";
import {ProofVerifier} from "../src/ProofVerifier.sol";
import {TriggerExecutor} from "../src/TriggerExecutor.sol";

/// @notice Flips the deployed ProofVerifier/TriggerExecutor off mock mode and
/// onto the real Flare FDC verifier / FTSOv2 feed.
///
/// This sends real transactions against already-deployed contracts — it is
/// NOT run automatically as part of any build/deploy step. Run it explicitly,
/// once you have a funded Coston2 deployer key that is the current contract
/// owner:
///
///   PROOF_VERIFIER_ADDRESS=0x787c170ad57D650D2BeE947A25c22F677B22bd87 \
///   TRIGGER_EXECUTOR_ADDRESS=0x29e1f57044ce6C22Db362222e4a66da78F5acd3e \
///   FDC_VERIFICATION_ADDRESS=0x906507E0B64bcD494Db73bd0459d1C667e14B933 \
///   FTSO_V2_ADDRESS=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d \
///   DEPLOYER_PRIVATE_KEY=0x... \
///   forge script script/SetLive.s.sol --rpc-url coston2 --broadcast
///
/// The FDC_VERIFICATION_ADDRESS / FTSO_V2_ADDRESS values above are the
/// Coston2 protocol addresses recorded in deployments/coston2.pending.json —
/// re-resolve from the Flare contract registry if they've since changed.
contract SetLiveScript is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proofVerifierAddr = vm.envAddress("PROOF_VERIFIER_ADDRESS");
        address triggerExecutorAddr = vm.envAddress("TRIGGER_EXECUTOR_ADDRESS");
        address fdcVerificationAddr = vm.envAddress("FDC_VERIFICATION_ADDRESS");
        address ftsoV2Addr = vm.envAddress("FTSO_V2_ADDRESS");

        ProofVerifier verifier = ProofVerifier(proofVerifierAddr);
        TriggerExecutor executor = TriggerExecutor(payable(triggerExecutorAddr));

        console2.log("Before: ProofVerifier.mockMode =", verifier.mockMode());

        vm.startBroadcast(pk);
        verifier.setFdcVerification(fdcVerificationAddr);
        verifier.setMockMode(false);
        executor.setFtsoV2(ftsoV2Addr);
        vm.stopBroadcast();

        console2.log("After: ProofVerifier.mockMode =", verifier.mockMode());
        console2.log("After: ProofVerifier.fdcVerification =", address(verifier.fdcVerification()));
        console2.log("After: TriggerExecutor.ftsoV2 =", address(executor.ftsoV2()));
    }
}
