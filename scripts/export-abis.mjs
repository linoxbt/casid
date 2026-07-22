#!/usr/bin/env bun
/**
 * Export Foundry ABIs into packages/core/abis for TS consumers.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outDir = join(root, "packages/core/abis");
mkdirSync(outDir, { recursive: true });

const contracts = [
  "TopicRegistry",
  "ProofVerifier",
  "SubscriptionHub",
  "TriggerExecutor",
  "MockFdcVerification",
  "MockFtsoV2",
];

for (const name of contracts) {
  const path = join(root, `contracts/out/${name}.sol/${name}.json`);
  if (!existsSync(path)) {
    console.warn("missing", path);
    continue;
  }
  const art = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(
    join(outDir, `${name}.json`),
    JSON.stringify({ contractName: name, abi: art.abi, bytecode: art.bytecode?.object }, null, 2),
  );
  console.log("exported", name);
}

writeFileSync(
  join(outDir, "index.json"),
  JSON.stringify({ contracts, generatedAt: new Date().toISOString() }, null, 2),
);
console.log("done →", outDir);
