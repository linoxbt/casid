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
  const results: WebhookDelivery[] = [];

  for (const sub of subs) {
    const delivery = await deliverOne(store, sub, event, signingSecret);
    results.push(delivery);
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
    mock: event.mock ?? false,
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

  if (sub.webhookUrl.startsWith("casid://log")) {
    console.log("[casid webhook]", body);
    updateDeliveryStatus(store, id, "delivered", {
      attempts: 1,
      deliveredAt: new Date().toISOString(),
      signature,
    });
    return getDelivery(store, id)!;
  }

  try {
    const res = await fetch(sub.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Casid-Signature": signature,
        "X-Casid-Event-Id": event.id,
        "User-Agent": "Casid-Coordinator/0.1",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      updateDeliveryStatus(store, id, "failed", {
        attempts: 1,
        lastError: `HTTP ${res.status}`,
        signature,
      });
    } else {
      updateDeliveryStatus(store, id, "delivered", {
        attempts: 1,
        deliveredAt: new Date().toISOString(),
        signature,
      });
    }
  } catch (err) {
    updateDeliveryStatus(store, id, "failed", {
      attempts: 1,
      lastError: err instanceof Error ? err.message : String(err),
      signature,
    });
  }

  return getDelivery(store, id)!;
}
