export const leadTypeValues = [
  "INDIVIDUAL",
  "CORPORATE",
  "SCHOOL",
  "WEDDING",
  "BIRTHDAY_PARTY",
  "TOUR_GROUP",
] as const;

export type LeadType = (typeof leadTypeValues)[number];

export const proposalStatusValues = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export type ProposalStatus = (typeof proposalStatusValues)[number];

export interface LeadProposalMeta {
  title?: string | null;
  summary?: string | null;
  quotedAmount?: number | null;
  validUntil?: string | null; // YYYY-MM-DD
  status?: ProposalStatus | null;
}

export interface LeadMeta {
  type?: LeadType | null;
  proposal?: LeadProposalMeta | null;
}

export function unpackLeadMeta(raw: string | null): { meta: LeadMeta; notes: string } {
  const text = raw ?? "";
  const [line, ...rest] = text.split("\n");
  if (!line.startsWith("CRM_META:")) {
    return { meta: {}, notes: text };
  }

  try {
    const parsed = JSON.parse(line.slice("CRM_META:".length)) as LeadMeta;
    return {
      meta: parsed ?? {},
      notes: rest.join("\n").trim(),
    };
  } catch {
    return { meta: {}, notes: text };
  }
}

export function packLeadMeta(meta: LeadMeta, notes?: string | null): string | null {
  const body = (notes ?? "").trim();
  const nextMeta: LeadMeta = {};

  if (meta.type) nextMeta.type = meta.type;
  if (meta.proposal) nextMeta.proposal = meta.proposal;

  const hasMeta = Object.keys(nextMeta).length > 0;
  if (!hasMeta) return body || null;

  const prefix = `CRM_META:${JSON.stringify(nextMeta)}`;
  return body ? `${prefix}\n${body}` : prefix;
}
