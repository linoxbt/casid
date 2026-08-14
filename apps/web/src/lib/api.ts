const BASE =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ?? "http://localhost:4100";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.NEXT_PUBLIC_CASID_API_KEY;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export type Topic = {
  id: string;
  onChainId?: number;
  uri: string;
  kind: string;
  active: boolean;
  createdAt: string;
  pipeline?: string[];
  createdBy?: string;
};

export type Subscription = {
  id: string;
  topicUri: string;
  topicId?: number;
  webhookUrl?: string;
  targetAddress?: string;
  active: boolean;
  createdAt: string;
};

export type CasidEvent = {
  id: string;
  topicUri: string;
  topicId?: number;
  proofHash: string;
  eventCommitment: string;
  attestationType: string;
  payload: Record<string, unknown>;
  verified: boolean;
  createdAt: string;
};

export type Delivery = {
  id: string;
  subscriptionId: string;
  eventId: string;
  status: string;
  attempts: number;
  lastError?: string;
  deliveredAt?: string;
  signature?: string;
};

export const api = {
  health: () =>
    request<{
      ok: boolean;
      topics: number;
      subscriptions: number;
      events: number;
      deliveries: number;
      onChainVerification: "live" | "mock" | "unknown";
    }>("/health"),
  meta: () =>
    request<{
      name: string;
      tagline: string;
      version?: string;
      network: {
        chainId: number;
        rpc: string;
        name?: string;
        daLayer?: string;
        registry?: string;
      };
      protocol?: Record<string, string | undefined>;
      contracts: Record<string, string | null>;
      primitives: string[];
      fdc?: {
        mode: string;
        onChainVerification?: "live" | "mock" | "unknown";
        steps: string[];
        docs: string;
      };
    }>("/v1/meta"),
  evaluateComposition: (topicUri: string) =>
    request<{
      satisfied: boolean;
      op: string;
      children: Array<{ uri: string; kind: string; matched: boolean }>;
    }>("/v1/composition/evaluate", {
      method: "POST",
      body: JSON.stringify({ topicUri }),
    }),
  topics: () => request<{ topics: Topic[] }>("/v1/topics"),
  topic: (id: string) =>
    request<{ topic: Topic; pipeline: string[] }>(`/v1/topics/${encodeURIComponent(id)}`),
  createTopic: (uri: string, createdBy?: string) =>
    request<{
      topic: Topic;
      existed: boolean;
      onChainParams?: { kind: `0x${string}`; schemaHash: `0x${string}` };
    }>("/v1/topics", {
      method: "POST",
      body: JSON.stringify({ uri, createdBy }),
    }),
  setTopicCreator: (topicId: string, address: string) =>
    request<{ topic: Topic }>(`/v1/topics/${topicId}/creator`, {
      method: "PATCH",
      body: JSON.stringify({ address }),
    }),
  subscriptions: () =>
    request<{ subscriptions: Subscription[] }>("/v1/subscriptions"),
  subscribe: (body: {
    topicUri: string;
    webhookUrl?: string;
    targetAddress?: string;
  }) =>
    request<{ subscription: Subscription }>("/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  unsubscribe: (id: string) =>
    request<{ subscription: Subscription }>(`/v1/subscriptions/${id}`, {
      method: "DELETE",
    }),
  events: (limit?: number) =>
    request<{ events: CasidEvent[] }>(
      `/v1/events${limit ? `?limit=${limit}` : ""}`,
    ),
  deliveries: (limit?: number) =>
    request<{ deliveries: Delivery[] }>(
      `/v1/deliveries${limit ? `?limit=${limit}` : ""}`,
    ),
  attestPayment: (body: {
    topicUri: string;
    amount?: string;
    txHash?: string;
    fireOnChain?: boolean;
    waitRounds?: number;
  }) =>
    request<{
      status?: "pending_proof";
      error?: string;
      event?: CasidEvent;
      fdc: { steps?: string[]; proof?: unknown; prepare?: unknown; submit?: unknown };
      deliveries?: Delivery[];
      onChain?: { ok: boolean; mode?: string; txHash?: string; error?: string } | null;
    }>("/v1/attest/payment", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  attestFtso: (body: { topicUri: string; fireOnChain?: boolean }) =>
    request<{ event: CasidEvent; deliveries: Delivery[]; observedPrice: number }>("/v1/attest/ftso", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  liveFdcAddressValidity: (address?: string) =>
    request<{
      message?: string;
      prepare?: { status: string; abiEncodedRequest: string };
      steps?: string[];
      error?: string;
      casidEvent?: CasidEvent;
    }>("/v1/fdc/live/address-validity", {
      method: "POST",
      body: JSON.stringify({
        address: address ?? "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        submit: false,
      }),
    }),
};
