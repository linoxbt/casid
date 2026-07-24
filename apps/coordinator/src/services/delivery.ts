import {
  signWebhookPayload,
  type AttestedEvent,
  type Subscription,
  type WebhookDelivery,
} from "@casid/core";
import type { Store } from "../lib/store";
import {
  activeSubsForTopic,
  getDelivery,
  recordDelivery,
  updateDeliveryStatus,
} from "../lib/store";

export async function deliverToSubscribers(
  store: Store,
  event: AttestedEvent,
  signingSecret: string,
): Promise<WebhookDelivery[]> {
  const subs = activeSubsForTopic(store, event.topicUri);
  const concurrency = Math.max(1, Number(process.env.WEBHOOK_CONCURRENCY ?? 5));
  const results: WebhookDelivery[] = [];

  for (let i = 0; i < subs.length; i += concurrency) {
    const chunk = subs.slice(i, i + concurrency);
    results.push(...(await Promise.all(chunk.map((sub) => deliverOne(store, sub, event, signingSecret)))));
  }

  return results;
}

async function deliverOne(
  store: Store,
  sub: Subscription,
  event: AttestedEvent,
  signingSecret: string,
): Promise<WebhookDelivery> {
  const id = crypto.randomUUID();
  const bodyObj = {
    id: event.id,
    type: "casid.event.verified",
    topicUri: event.topicUri,
    topicId: event.topicId,
    proofHash: event.proofHash,
    eventCommitment: event.eventCommitment,
    attestationType: event.attestationType,
    payload: event.payload,
    createdAt: event.createdAt,
  };
  const body = JSON.stringify(bodyObj);
  const signature = await signWebhookPayload(signingSecret, body);

  const delivery: WebhookDelivery = {
    id,
    subscriptionId: sub.id,
    eventId: event.id,
    status: "pending",
    attempts: 0,
    signature,
  };
  recordDelivery(store, delivery);

  if (!sub.webhookUrl) {
    updateDeliveryStatus(store, id, "failed", {
      lastError: "No webhook URL",
      signature,
    });
    return getDelivery(store, id)!;
  }

  const maxAttempts = Math.max(1, Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 3));
  let lastError = "unknown delivery error";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(sub.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Casid-Signature": signature,
          "X-Casid-Event-Id": event.id,
          "User-Agent": "Casid-Coordinator/0.2",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        updateDeliveryStatus(store, id, "delivered", {
          attempts: attempt,
          deliveredAt: new Date().toISOString(),
          signature,
        });
        return getDelivery(store, id)!;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  updateDeliveryStatus(store, id, "failed", {
    attempts: maxAttempts,
    lastError,
    signature,
  });

  return getDelivery(store, id)!;
}
