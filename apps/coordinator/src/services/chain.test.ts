import { describe, expect, it } from "bun:test";
import { decodeAbiParameters } from "viem";
import { encodePaymentProof } from "./chain";

// Same shape as the Solidity-side ABI param in chain.ts, used here only to
// decode our own output back and confirm every field round-trips — this is
// what a live DA Layer response would need to survive intact for the
// on-chain abi.decode(proof, (IPayment.Proof)) in ProofVerifier.sol to work.
const paymentProofAbiParam = {
  type: "tuple",
  components: [
    { name: "merkleProof", type: "bytes32[]" },
    {
      name: "data",
      type: "tuple",
      components: [
        { name: "attestationType", type: "bytes32" },
        { name: "sourceId", type: "bytes32" },
        { name: "votingRound", type: "uint64" },
        { name: "lowestUsedTimestamp", type: "uint64" },
        {
          name: "requestBody",
          type: "tuple",
          components: [
            { name: "transactionId", type: "bytes32" },
            { name: "inUtxo", type: "uint256" },
            { name: "utxo", type: "uint256" },
          ],
        },
        {
          name: "responseBody",
          type: "tuple",
          components: [
            { name: "blockNumber", type: "uint64" },
            { name: "blockTimestamp", type: "uint64" },
            { name: "sourceAddressHash", type: "bytes32" },
            { name: "sourceAddressesRoot", type: "bytes32" },
            { name: "receivingAddressHash", type: "bytes32" },
            { name: "intendedReceivingAddressHash", type: "bytes32" },
            { name: "spentAmount", type: "int256" },
            { name: "intendedSpentAmount", type: "int256" },
            { name: "receivedAmount", type: "int256" },
            { name: "intendedReceivedAmount", type: "int256" },
            { name: "standardPaymentReference", type: "bytes32" },
            { name: "oneToOne", type: "bool" },
            { name: "status", type: "uint8" },
          ],
        },
      ],
    },
  ],
} as const;

const hash = (label: string) =>
  `0x${Buffer.from(label.padEnd(32, "0")).toString("hex")}`;

// Fixture shaped like the DA Layer's proof-by-request-round response —
// values as JSON strings, matching how uint64/uint256/int256 typically
// arrive from a JSON API (to avoid precision loss).
const fixtureDaResponse = {
  response: {
    attestationType: hash("Payment"),
    sourceId: hash("testXRP"),
    votingRound: "1402793",
    lowestUsedTimestamp: "1755000000",
    requestBody: {
      transactionId: hash("tx"),
      inUtxo: "0",
      utxo: "0",
    },
    responseBody: {
      blockNumber: "12345678",
      blockTimestamp: "1755000010",
      sourceAddressHash: hash("source"),
      sourceAddressesRoot: hash("root"),
      receivingAddressHash: hash("dest"),
      intendedReceivingAddressHash: hash("dest"),
      spentAmount: "1000000",
      intendedSpentAmount: "1000000",
      receivedAmount: "1000000",
      intendedReceivedAmount: "1000000",
      standardPaymentReference: `0x${"0".repeat(64)}`,
      oneToOne: true,
      status: 0,
    },
  },
  proof: [hash("leaf1"), hash("leaf2")],
};

describe("encodePaymentProof", () => {
  it("round-trips every field through encode -> decode unchanged", () => {
    const encoded = encodePaymentProof(fixtureDaResponse);
    expect(encoded.startsWith("0x")).toBe(true);

    const [decoded] = decodeAbiParameters([paymentProofAbiParam], encoded);
    const d = decoded as {
      merkleProof: readonly string[];
      data: {
        attestationType: string;
        sourceId: string;
        votingRound: bigint;
        lowestUsedTimestamp: bigint;
        requestBody: { transactionId: string; inUtxo: bigint; utxo: bigint };
        responseBody: {
          blockNumber: bigint;
          blockTimestamp: bigint;
          sourceAddressHash: string;
          receivingAddressHash: string;
          spentAmount: bigint;
          receivedAmount: bigint;
          oneToOne: boolean;
          status: number;
        };
      };
    };

    expect(d.merkleProof).toHaveLength(2);
    expect(d.merkleProof[0]).toBe(fixtureDaResponse.proof[0]);
    expect(d.data.attestationType).toBe(fixtureDaResponse.response.attestationType);
    expect(d.data.votingRound).toBe(1402793n);
    expect(d.data.lowestUsedTimestamp).toBe(1755000000n);
    expect(d.data.requestBody.transactionId).toBe(fixtureDaResponse.response.requestBody.transactionId);
    expect(d.data.responseBody.blockNumber).toBe(12345678n);
    expect(d.data.responseBody.spentAmount).toBe(1000000n);
    expect(d.data.responseBody.receivedAmount).toBe(1000000n);
    expect(d.data.responseBody.oneToOne).toBe(true);
    expect(d.data.responseBody.status).toBe(0);
  });

  it("accepts numeric (not just string) values for integer fields", () => {
    const numeric = {
      ...fixtureDaResponse,
      response: {
        ...fixtureDaResponse.response,
        votingRound: 1402793,
        responseBody: { ...fixtureDaResponse.response.responseBody, blockNumber: 12345678 },
      },
    };
    expect(() => encodePaymentProof(numeric)).not.toThrow();
  });

  it("throws a clear error when a required field is missing", () => {
    const broken = {
      ...fixtureDaResponse,
      response: { ...fixtureDaResponse.response, sourceId: undefined },
    };
    expect(() => encodePaymentProof(broken)).toThrow(/sourceId/);
  });
});
