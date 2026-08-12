/**
 * Notice: portions of the design implemented in this file are the subject of pending
 * United States patent applications by Cadenza Labs. See ../PATENTS.md for the
 * §287(a) virtual-marking landing page and the applicable licence terms.
 *
 * Cadenza Stream — per-event micropayment streaming on top of the AP2 mandate
 * primitives. Implements per-event and batched settlement modes (channel mode
 * is Phase 2; not in v0.1).
 *
 * Mandate chain:
 *   StreamingIntent (signed by user) → StreamMandate[i] (signed by agent)
 *     → StreamSettlementMandate (signed by provider, batched) → Kaspa tx
 *
 * Each StreamMandate carries the cumulative session state. Each settlement
 * commits the latest StreamMandate to chain and pays the incremental amount
 * (cumulativeCost - lastSettledCost).
 */

import { canonicalJson } from "./canonical.js";
import { sha256Hex, signEd25519 } from "./crypto.js";
import { mandateHash } from "./mandates.js";
import type { KaspaAdapter, SettlementTxData } from "./adapter/types.js";
import type {
  Principal,
  MandateType,
  VCProof,
  VerifiableCredential,
  StreamingIntentMandate,
  StreamingIntentMandateSubject,
  StreamMandate,
  StreamMandateSubject,
  StreamSettlementMandate,
  StreamSettlementMandateSubject,
  StreamSettlementResult,
  StreamSessionSummary,
} from "./types.js";

const VC_CONTEXT = [
  "https://www.w3.org/2018/credentials/v1",
  "https://w3id.org/security/suites/ed25519-2020/v1",
  "https://cadenza.pay/credentials/v1",
];

function nonce(): string {
  return sha256Hex(`${Date.now()}-${Math.random()}-${process.hrtime.bigint()}`).slice(0, 16);
}

function makeVC<S extends object>(
  type: MandateType,
  issuer: Principal,
  subject: S,
): VerifiableCredential<S> {
  const issuanceDate = new Date().toISOString();
  const body = {
    "@context": VC_CONTEXT,
    type: ["VerifiableCredential", type] as ["VerifiableCredential", MandateType],
    issuer: issuer.did,
    issuanceDate,
    credentialSubject: subject,
  };
  const message = Buffer.from(canonicalJson(body), "utf8");
  const signature = signEd25519(message, issuer.privateKey);
  const proof: VCProof = {
    type: "Ed25519Signature2020",
    created: issuanceDate,
    proofPurpose: "assertionMethod",
    verificationMethod: `${issuer.did}#key-1`,
    signatureValue: signature.toString("base64"),
  };
  return { ...body, proof };
}

export function createStreamingIntentMandate(
  user: Principal,
  agent: Principal,
  provider: Principal,
  params: {
    rate: { unit: string; pricePerUnit: string };
    spendCap: string;
    asset: string;
    expiresAt: string;
  },
): StreamingIntentMandate {
  return makeVC<StreamingIntentMandateSubject>("StreamingIntentMandate", user, {
    user: user.did,
    agent: agent.did,
    provider: provider.did,
    rate: params.rate,
    spendCap: params.spendCap,
    asset: params.asset,
    expiresAt: params.expiresAt,
    nonce: nonce(),
  });
}

export function createStreamMandate(
  agent: Principal,
  streamingIntent: StreamingIntentMandate,
  params: {
    sequenceNumber: number;
    cumulativeUnits: string;
    cumulativeCost: string;
  },
): StreamMandate {
  return makeVC<StreamMandateSubject>("StreamMandate", agent, {
    streamingIntentHash: mandateHash(streamingIntent),
    sequenceNumber: params.sequenceNumber,
    cumulativeUnits: params.cumulativeUnits,
    cumulativeCost: params.cumulativeCost,
    timestamp: new Date().toISOString(),
    nonce: nonce(),
  });
}

export function createStreamSettlementMandate(
  provider: Principal,
  streamingIntent: StreamingIntentMandate,
  streamMandate: StreamMandate,
  params: {
    fromSequence: number;
    toSequence: number;
    chain: string;
    amount: string;
    recipient: string;
  },
): StreamSettlementMandate {
  const intentSubject = streamingIntent.credentialSubject;
  const streamSubject = streamMandate.credentialSubject;
  return makeVC<StreamSettlementMandateSubject>(
    "StreamSettlementMandate",
    provider,
    {
      streamingIntentHash: mandateHash(streamingIntent),
      streamMandateHash: mandateHash(streamMandate),
      fromSequence: params.fromSequence,
      toSequence: params.toSequence,
      chain: params.chain,
      asset: intentSubject.asset,
      amount: params.amount,
      recipient: params.recipient,
      cumulativeUnits: streamSubject.cumulativeUnits,
      cumulativeCost: streamSubject.cumulativeCost,
      expiresAt: intentSubject.expiresAt,
      nonce: nonce(),
    },
  );
}

/* ─── StreamSession ──────────────────────────────────────────────── */

export type SettlementTrigger =
  | { events: number }
  | { amount: string }
  | { ms: number };

export interface StreamSessionParams {
  user: Principal;
  agent: Principal;
  provider: Principal;
  rate: { unit: string; pricePerUnit: string };
  spendCap: string;
  asset: string;
  chain: string;
  expiresAfterMs?: number;
  triggers?: SettlementTrigger[];
}

export class StreamSession {
  readonly sessionId: string;
  readonly streamingIntent: StreamingIntentMandate;

  private user: Principal;
  private agent: Principal;
  private provider: Principal;
  private adapter: KaspaAdapter;
  private chain: string;
  private triggers: SettlementTrigger[];

  private eventCount = 0;
  private eventsAtLastSettle = 0;
  private cumulativeUnits = 0;
  private cumulativeCost = 0;
  private sequenceNumber = 0;
  private lastSettledSequence = 0;
  private lastSettledCost = 0;
  private lastSettledAt: number;
  private settlements: StreamSettlementResult[] = [];
  private streamMandates: StreamMandate[] = [];
  private settling = false;
  private closed = false;

  constructor(adapter: KaspaAdapter, params: StreamSessionParams) {
    this.user = params.user;
    this.agent = params.agent;
    this.provider = params.provider;
    this.adapter = adapter;
    this.chain = params.chain;
    this.triggers = params.triggers ?? [];

    const expiresAt = new Date(
      Date.now() + (params.expiresAfterMs ?? 60 * 60 * 1000),
    ).toISOString();

    this.streamingIntent = createStreamingIntentMandate(
      params.user,
      params.agent,
      params.provider,
      {
        rate: params.rate,
        spendCap: params.spendCap,
        asset: params.asset,
        expiresAt,
      },
    );
    this.sessionId = mandateHash(this.streamingIntent).slice(0, 16);
    this.lastSettledAt = Date.now();
  }

  /**
   * Record one or more units of consumption (e.g. tokens, seconds, calls).
   * Updates cumulative state and checks settlement triggers.
   */
  async recordEvent(event: { units: number }): Promise<void> {
    if (this.closed) throw new Error("Session is closed");
    if (this.settling) {
      // Settlement in progress; the event is still recorded but won't trigger
      // a re-entrant settlement.
    }

    const intent = this.streamingIntent.credentialSubject;
    const newUnits = this.cumulativeUnits + event.units;
    const newCost = newUnits * Number.parseFloat(intent.rate.pricePerUnit);

    if (newCost > Number.parseFloat(intent.spendCap) + 1e-9) {
      throw new Error(
        `Event would exceed Streaming Intent spendCap (${newCost.toFixed(4)} > ${intent.spendCap})`,
      );
    }

    this.cumulativeUnits = newUnits;
    this.cumulativeCost = newCost;
    this.eventCount += 1;

    if (this.shouldSettle()) {
      await this.settle();
    }
  }

  /**
   * Force a settlement now (if there's any outstanding balance to settle).
   * Returns the settlement result, or null if nothing was outstanding.
   */
  async settle(): Promise<StreamSettlementResult | null> {
    if (this.settling) return null;
    if (this.cumulativeCost - this.lastSettledCost < 0.0000001) return null;

    this.settling = true;
    try {
      this.sequenceNumber += 1;
      const streamMandate = createStreamMandate(
        this.agent,
        this.streamingIntent,
        {
          sequenceNumber: this.sequenceNumber,
          cumulativeUnits: this.cumulativeUnits.toString(),
          cumulativeCost: this.cumulativeCost.toFixed(6),
        },
      );
      this.streamMandates.push(streamMandate);

      const settlementAmount = this.cumulativeCost - this.lastSettledCost;
      const settlementMandate = createStreamSettlementMandate(
        this.provider,
        this.streamingIntent,
        streamMandate,
        {
          fromSequence: this.lastSettledSequence + 1,
          toSequence: this.sequenceNumber,
          chain: this.chain,
          amount: settlementAmount.toFixed(6),
          recipient: this.provider.did,
        },
      );

      const txData: SettlementTxData = {
        chain: this.chain,
        asset: this.streamingIntent.credentialSubject.asset,
        amount: settlementAmount.toFixed(6),
        recipient: this.provider.did,
        mandateHashes: {
          // We reuse the SettlementTxData mandateHashes shape: intent/cart/payment
          // maps to streamingIntent/streamMandate/settlement for streaming.
          intent: mandateHash(this.streamingIntent),
          cart: mandateHash(streamMandate),
          payment: mandateHash(settlementMandate),
        },
      };
      const txHash = await this.adapter.submitSettlement(txData);

      const result: StreamSettlementResult = {
        txHash,
        chain: this.chain,
        asset: this.streamingIntent.credentialSubject.asset,
        amount: settlementAmount.toFixed(6),
        cumulativeAmount: this.cumulativeCost.toFixed(6),
        fromSequence: this.lastSettledSequence + 1,
        toSequence: this.sequenceNumber,
        mandateHashes: {
          streamingIntent: mandateHash(this.streamingIntent),
          streamMandate: mandateHash(streamMandate),
          settlement: mandateHash(settlementMandate),
        },
      };

      this.lastSettledSequence = this.sequenceNumber;
      this.lastSettledCost = this.cumulativeCost;
      this.lastSettledAt = Date.now();
      this.eventsAtLastSettle = this.eventCount;
      this.settlements.push(result);
      return result;
    } finally {
      this.settling = false;
    }
  }

  /** Close the session: final settlement of any outstanding balance. */
  async close(): Promise<StreamSessionSummary> {
    if (this.closed) {
      return this.summary();
    }
    await this.settle();
    this.closed = true;
    return this.summary();
  }

  summary(): StreamSessionSummary {
    return {
      sessionId: this.sessionId,
      totalEvents: this.eventCount,
      totalUnits: this.cumulativeUnits.toString(),
      totalCost: this.cumulativeCost.toFixed(6),
      settledAmount: this.lastSettledCost.toFixed(6),
      unsettledAmount: (this.cumulativeCost - this.lastSettledCost).toFixed(6),
      settlements: this.settlements,
    };
  }

  private shouldSettle(): boolean {
    const unsettledCost = this.cumulativeCost - this.lastSettledCost;
    const unsettledEvents = this.eventCount - this.eventsAtLastSettle;
    const elapsed = Date.now() - this.lastSettledAt;

    for (const trigger of this.triggers) {
      if ("events" in trigger && unsettledEvents >= trigger.events) return true;
      if (
        "amount" in trigger &&
        unsettledCost >= Number.parseFloat(trigger.amount) - 1e-9
      )
        return true;
      if ("ms" in trigger && elapsed >= trigger.ms) return true;
    }
    return false;
  }
}
