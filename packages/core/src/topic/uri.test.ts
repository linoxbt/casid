import { describe, expect, test } from "bun:test";
import {
  buildFtsoThresholdUri,
  buildPaymentUri,
  parseTopicUri,
  topicFromSpec,
} from "./uri";

describe("topic URI", () => {
  test("payment uri roundtrip", () => {
    const uri = buildPaymentUri("XRPL", "rN7n7otQDd6FczFgLdlqtyMVrn3qMHpasx");
    expect(uri).toBe("topic://payment/xrp/rN7n7otQDd6FczFgLdlqtyMVrn3qMHpasx");
    const parsed = parseTopicUri(uri);
    expect(parsed.kind).toBe("PAYMENT");
    if (parsed.spec.kind === "PAYMENT") {
      expect(parsed.spec.chain).toBe("XRPL");
      expect(parsed.spec.destination).toBe("rN7n7otQDd6FczFgLdlqtyMVrn3qMHpasx");
    }
  });

  test("ftso threshold uri", () => {
    const uri = buildFtsoThresholdUri("XRP/USD", "gte", 0.5);
    expect(uri).toContain("threshold/gte/0.5");
    const parsed = parseTopicUri(uri);
    expect(parsed.kind).toBe("FTSO_THRESHOLD");
    if (parsed.spec.kind === "FTSO_THRESHOLD") {
      expect(parsed.spec.feed).toBe("XRP/USD");
      expect(parsed.spec.op).toBe("gte");
      expect(parsed.spec.threshold).toBe(0.5);
    }
  });

  test("composition from spec", () => {
    const parsed = topicFromSpec({
      kind: "COMPOSITION",
      op: "and",
      children: [
        { kind: "PAYMENT", chain: "XRPL", destination: "rDemo" },
        { kind: "FTSO_THRESHOLD", feed: "XRP/USD", op: "gte", threshold: 0.5 },
      ],
    });
    expect(parsed.kind).toBe("COMPOSITION");
    expect(parsed.uri).toContain("composition/and");
  });

  test("invalid uri throws", () => {
    expect(() => parseTopicUri("http://nope")).toThrow();
  });
});
