import { parseTopicUri } from "@casid/core";
import type { Store } from "../lib/store";
import { findTopicByUri, listEvents } from "../lib/store";

/**
 * Evaluate AND/OR compositions against recent verified child events.
 * MVP: looks at in-window verified events for child payment/ftso topics.
 */
export function evaluateComposition(
  store: Store,
  compositionUri: string,
  windowMs = 15 * 60 * 1000,
): {
  satisfied: boolean;
  op: "and" | "or";
  children: Array<{ uri: string; kind: string; matched: boolean }>;
} {
  const topic = findTopicByUri(store, compositionUri);
  if (!topic || topic.kind !== "COMPOSITION") {
    throw new Error("Not a composition topic");
  }

  // URI form: topic://composition/and/payment/xrp/...+ftso/price/...
  const body = compositionUri.replace(/^topic:\/\/composition\//, "");
  const slash = body.indexOf("/");
  const op = (slash === -1 ? "and" : body.slice(0, slash)).toLowerCase() as
    | "and"
    | "or";
  const rest = slash === -1 ? "" : body.slice(slash + 1);
  const childPaths = rest.split("+").filter(Boolean);
  const childUris = childPaths.map((p) =>
    p.startsWith("topic://") ? p : `topic://${p}`,
  );

  const cutoff = Date.now() - windowMs;
  const recent = listEvents(store, 200).filter(
    (e) => e.verified && new Date(e.createdAt).getTime() >= cutoff,
  );

  const children = childUris.map((uri) => {
    let kind = "UNKNOWN";
    try {
      kind = parseTopicUri(uri).kind;
    } catch {
      /* */
    }
    const matched = recent.some((e) => e.topicUri === uri);
    return { uri, kind, matched };
  });

  const satisfied =
    op === "and"
      ? children.every((c) => c.matched)
      : children.some((c) => c.matched);

  return { satisfied, op, children };
}
