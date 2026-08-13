import { describe, expect, it } from "bun:test";
import { selectNewPayments } from "./xrplWatcher";

const DEST = "rTestDestination";

function tx(overrides: Partial<{
  hash: string;
  TransactionType: string;
  Destination: string;
  TransactionResult: string;
  ledger_index: number;
}>) {
  return {
    tx: {
      hash: overrides.hash ?? "HASH1",
      TransactionType: overrides.TransactionType ?? "Payment",
      Destination: overrides.Destination ?? DEST,
      ledger_index: overrides.ledger_index ?? 100,
    },
    meta: { TransactionResult: overrides.TransactionResult ?? "tesSUCCESS" },
  };
}

describe("selectNewPayments", () => {
  it("matches a successful incoming Payment to the watched destination", () => {
    const { matched, nextLedgerIndex, nextTxHash } = selectNewPayments(
      [tx({ hash: "H1", ledger_index: 101 })],
      DEST,
      { lastLedgerIndex: 0 },
    );
    expect(matched).toEqual([{ hash: "H1" }]);
    expect(nextLedgerIndex).toBe(101);
    expect(nextTxHash).toBe("H1");
  });

  it("skips transactions to a different destination", () => {
    const { matched } = selectNewPayments(
      [tx({ hash: "H1", Destination: "rSomeoneElse" })],
      DEST,
      { lastLedgerIndex: 0 },
    );
    expect(matched).toEqual([]);
  });

  it("skips non-Payment transaction types", () => {
    const { matched } = selectNewPayments(
      [tx({ hash: "H1", TransactionType: "TrustSet" })],
      DEST,
      { lastLedgerIndex: 0 },
    );
    expect(matched).toEqual([]);
  });

  it("skips failed transactions", () => {
    const { matched } = selectNewPayments(
      [tx({ hash: "H1", TransactionResult: "tecPATH_DRY" })],
      DEST,
      { lastLedgerIndex: 0 },
    );
    expect(matched).toEqual([]);
  });

  it("dedupes the already-processed cursor tx hash so re-polling the same batch doesn't reattest it", () => {
    const { matched } = selectNewPayments(
      [tx({ hash: "H1", ledger_index: 101 })],
      DEST,
      { lastLedgerIndex: 100, lastTxHash: "H1" },
    );
    expect(matched).toEqual([]);
  });

  it("advances the ledger cursor across a mixed batch even when some entries don't match", () => {
    const { matched, nextLedgerIndex } = selectNewPayments(
      [tx({ hash: "H1", ledger_index: 101, Destination: "rSomeoneElse" }), tx({ hash: "H2", ledger_index: 105 })],
      DEST,
      { lastLedgerIndex: 100 },
    );
    expect(matched).toEqual([{ hash: "H2" }]);
    expect(nextLedgerIndex).toBe(105);
  });
});
