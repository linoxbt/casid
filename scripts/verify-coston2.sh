#!/usr/bin/env bash
# Re-verify Casid contracts on Coston2 explorer (Blockscout-compatible API)
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export FLARESCAN_API_KEY="${FLARESCAN_API_KEY:-dummy}"
VERIFY_URL="https://coston2-explorer.flare.network/api/"
RPC="https://coston2-api.flare.network/ext/C/rpc"

PV_ARGS=$(cast abi-encode "constructor(address,bool)" 0xc9442a9542e4A931bc2bA207b31B98EA57C4a53B true)
SH_ARGS=$(cast abi-encode "constructor(address)" 0xe132a226382E3A872d558c8c576f0aaeF864bE7C)
TE_ARGS=$(cast abi-encode "constructor(address,address,address,address)" \
  0x787c170ad57D650D2BeE947A25c22F677B22bd87 \
  0xe132a226382E3A872d558c8c576f0aaeF864bE7C \
  0xAd5dD33d2F753891A18A970361C81a87c401f31d \
  0xFBAD05CFcF1329fBCe5B9d95e618Ebe5A6d23853)

verify() {
  local addr=$1 contract=$2 args=${3:-}
  echo "=== $contract ==="
  if [[ -n "$args" ]]; then
    forge verify-contract "$addr" "$contract" --chain 114 --rpc-url "$RPC" \
      --verifier blockscout --verifier-url "$VERIFY_URL" \
      --compiler-version 0.8.25 --num-of-optimizations 200 \
      --constructor-args "$args" --watch
  else
    forge verify-contract "$addr" "$contract" --chain 114 --rpc-url "$RPC" \
      --verifier blockscout --verifier-url "$VERIFY_URL" \
      --compiler-version 0.8.25 --num-of-optimizations 200 --watch
  fi
}

verify 0xc9442a9542e4A931bc2bA207b31B98EA57C4a53B src/mocks/MockFdcVerification.sol:MockFdcVerification
verify 0xFBAD05CFcF1329fBCe5B9d95e618Ebe5A6d23853 src/mocks/MockFtsoV2.sol:MockFtsoV2
verify 0xe132a226382E3A872d558c8c576f0aaeF864bE7C src/TopicRegistry.sol:TopicRegistry
verify 0x787c170ad57D650D2BeE947A25c22F677B22bd87 src/ProofVerifier.sol:ProofVerifier "$PV_ARGS"
verify 0xAd5dD33d2F753891A18A970361C81a87c401f31d src/SubscriptionHub.sol:SubscriptionHub "$SH_ARGS"
verify 0x29e1f57044ce6C22Db362222e4a66da78F5acd3e src/TriggerExecutor.sol:TriggerExecutor "$TE_ARGS"
