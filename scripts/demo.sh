#!/usr/bin/env bash
# Casid judge/demo walkthrough
set -euo pipefail
API="${COORDINATOR_URL:-http://localhost:4100}"

echo "== health =="
curl -s "$API/health" | python3 -m json.tool

echo ""
echo "== meta (Flare registry) =="
curl -s "$API/v1/meta" | python3 -c "
import sys,json
m=json.load(sys.stdin)
print('network:', m['network'])
print('protocol:', m.get('protocol'))
print('fdc mode:', m.get('fdc',{}).get('mode'))
"

echo ""
echo "== end-to-end mock payment demo =="
curl -s -X POST "$API/v1/demo/run" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d['message'])
print('topic:', d['topic']['uri'])
print('proofHash:', d['event']['proofHash'])
print('deliveries:', len(d['deliveries']))
print('composition:', d.get('composition'))
print('onChain:', d.get('onChain',{}).get('mode'), d.get('onChain',{}).get('txHash','')[:18] if d.get('onChain',{}).get('txHash') else '')
"

echo ""
echo "== live FDC AddressValidity prepare =="
curl -s -X POST "$API/v1/fdc/live/address-validity" \
  -H 'content-type: application/json' \
  -d '{"address":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe","submit":false}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('message:', d.get('message'))
print('prepare status:', d.get('prepare',{}).get('status'))
print('abiEncodedRequest:', (d.get('prepare',{}).get('abiEncodedRequest') or '')[:66]+'...')
print('steps:', d.get('steps'))
print('error:', d.get('error'))
"

echo ""
echo "== composition after payment + ftso =="
curl -s -X POST "$API/v1/attest/ftso" -H 'content-type: application/json' \
  -d '{"topicUri":"topic://ftso/price/XRP-USD/threshold/gte/0.50","observedPrice":0.62}' >/dev/null
COMP=$(curl -s "$API/v1/topics" | python3 -c "import sys,json; ts=json.load(sys.stdin)['topics']; print(next(t['uri'] for t in ts if t['kind']=='COMPOSITION'))")
curl -s -X POST "$API/v1/composition/evaluate" -H 'content-type: application/json' \
  -d "{\"topicUri\":\"$COMP\"}" | python3 -m json.tool

echo ""
echo "== casid contracts (Coston2) =="
curl -s "$API/v1/meta" | python3 -c "
import sys,json
m=json.load(sys.stdin)
for k,v in (m.get('contracts') or {}).items():
    print(f'  {k}: {v}')
print('explorer: https://coston2-explorer.flare.network')
"

echo ""
echo "Demo complete."
echo "  Console:   http://localhost:3100"
echo "  Contracts: http://localhost:3100/contracts"
echo "  Docs:      http://localhost:3100/docs"
