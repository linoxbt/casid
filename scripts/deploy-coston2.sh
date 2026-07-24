#!/usr/bin/env bash
# Deploy Casid contracts to Flare Coston2.
# Prerequisites:
#   1. Fund deployer with C2FLR: https://faucet.flare.network/coston2
#   2. export DEPLOYER_PRIVATE_KEY=0x...
#   3. forge + cast installed
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts"

RPC="${FLARE_RPC_URL:-https://coston2-api.flare.network/ext/C/rpc}"
KEY="${DEPLOYER_PRIVATE_KEY:-}"

if [[ -z "$KEY" && -f /root/.casid/deployer.json ]]; then
  KEY=$(python3 -c "import json;print(json.load(open('/root/.casid/deployer.json'))['privateKey'])")
fi

if [[ -z "$KEY" ]]; then
  echo "Set DEPLOYER_PRIVATE_KEY or create /root/.casid/deployer.json"
  exit 1
fi

ADDR=$(cast wallet address --private-key "$KEY")
BAL=$(cast balance "$ADDR" --rpc-url "$RPC")
echo "Deployer: $ADDR"
echo "Balance:  $BAL wei"

if [[ "$BAL" == "0" ]]; then
  echo ""
  echo "No C2FLR. Fund this address:"
  echo "  https://faucet.flare.network/coston2"
  echo "  Address: $ADDR"
  exit 2
fi

echo "Deploying Casid with live Flare protocol addresses..."
export CASID_USE_MOCKS=false
export FDC_VERIFICATION_ADDRESS="${FDC_VERIFICATION_ADDRESS:-$(cast call 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019 'getContractAddressByName(string)(address)' FdcVerification --rpc-url "$RPC")}" 
export FTSO_V2_ADDRESS="${FTSO_V2_ADDRESS:-$(cast call 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019 'getContractAddressByName(string)(address)' FtsoV2 --rpc-url "$RPC")}" 
forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --private-key "$KEY" \
  --broadcast \
  -vv | tee /tmp/casid-coston2-deploy.log

# Parse addresses from logs
OUT="$ROOT/deployments/coston2.json"
python3 - <<'PY' /tmp/casid-coston2-deploy.log "$OUT" "$ADDR"
import re, sys, json, datetime
log = open(sys.argv[1]).read()
out = sys.argv[2]
deployer = sys.argv[3]
def grab(name):
    m = re.search(rf"{name}=?\s*(0x[a-fA-F0-9]{{40}})", log)
    return m.group(1) if m else None
data = {
  "network": "coston2",
  "chainId": 114,
  "rpc": "https://coston2-api.flare.network/ext/C/rpc",
  "deployer": deployer,
  "deployedAt": datetime.datetime.utcnow().isoformat() + "Z",
  "contracts": {
    "TopicRegistry": grab("TOPIC_REGISTRY_ADDRESS"),
    "ProofVerifier": grab("PROOF_VERIFIER_ADDRESS"),
    "SubscriptionHub": grab("SUBSCRIPTION_HUB_ADDRESS"),
    "TriggerExecutor": grab("TRIGGER_EXECUTOR_ADDRESS"),
  },
  "explorer": "https://coston2-explorer.flare.network",
}
# also try space-separated forge console2 format
for line in log.splitlines():
    for key, field in [
        ("TOPIC_REGISTRY_ADDRESS", "TopicRegistry"),
        ("PROOF_VERIFIER_ADDRESS", "ProofVerifier"),
        ("SUBSCRIPTION_HUB_ADDRESS", "SubscriptionHub"),
        ("TRIGGER_EXECUTOR_ADDRESS", "TriggerExecutor"),
    ]:
        if key in line and "0x" in line:
            m = re.search(r"(0x[a-fA-F0-9]{40})", line)
            if m and not data["contracts"].get(field):
                data["contracts"][field] = m.group(1)

open(out, "w").write(json.dumps(data, indent=2))
print("Wrote", out)
print(json.dumps(data, indent=2))
PY

echo ""
echo "Wire env:"
echo "  export TOPIC_REGISTRY_ADDRESS=..."
echo "  export TRIGGER_EXECUTOR_ADDRESS=..."
echo "  export FLARE_CHAIN_ID=114"
echo "  export FLARE_RPC_URL=$RPC"
echo "  export DEPLOYER_PRIVATE_KEY=..."
