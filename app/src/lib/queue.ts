import { randomUUID } from "crypto";

import { Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { sendEmail, sendSMS, sendWhatsApp } from "@/lib/messaging";

export type CampaignChannel = "SMS" | "WHATSAPP" | "EMAIL";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
export type SegmentType =
  | "ALL_GUESTS"
  | "TIER"
  | "TAG"
  | "INACTIVE"
  | "BIRTHDAY_MONTH"
  | "ANNIVERSARY_MONTH"
  | "LEAD_STAGE"
  | "LEAD_SOURCE"
  | "HIGH_SPENDERS"
  | "CUSTOM_MOBILE_LIST";

export interface CampaignRecipient {
  id: string;
  name: string;
  mobile?: string | null;
  email?: string | null;
  source: "guest" | "lead";
}

interface BasicRecipientRow {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
}

export interface CampaignData {
  id: string;
  name: string;
  channel: CampaignChannel;
  templateId: string;
  segmentType: SegmentType;
  segmentFilters: Record<string, unknown>;
  scheduledAt: string | null;
  status: CampaignStatus;
  targetCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignJobData {
  campaignId: string;
  recipient: CampaignRecipient;
}

const redisUrl = process.env.REDIS_BULL_URL ?? process.env.REDIS_URL;
const queueEnabled = process.env.NODE_ENV === "production" && Boolean(redisUrl);

const bullConnection = queueEnabled
  ? new IORedis(redisUrl as string, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  : null;

const campaignQueueName = "campaign-send";

export const campaignQueue = bullConnection
  ? new Queue<CampaignJobData>(campaignQueueName, {
      connection: bullConnection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 2,
        backoff: {
          type: "fixed",
          delay: 1_000,
        },
      },
    })
  : null;

let workerStarted = false;
let workerRef: Worker<CampaignJobData> | null = null;

const CAMPAIGN_IDS_KEY = "campaign:ids";

function campaignKey(campaignId: string): string {
  return `campaign:data:${campaignId}`;
}

function recipientKey(campaignId: string): string {
  return `campaign:recipients:${campaignId}`;
}

function templateRender(body: string, data: Record<string, unknown>): string {
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function setCampaign(campaign: CampaignData): Promise<void> {
  if (!bullConnection) return;
  await bullConnection.set(campaignKey(campaign.id), JSON.stringify(campaign));
  await bullConnection.sadd(CAMPAIGN_IDS_KEY, campaign.id);
}

export async function createCampaign(data: Omit<CampaignData, "id" | "createdAt" | "updatedAt" | "sentCount" | "deliveredCount" | "failedCount" | "targetCount" | "status">): Promise<CampaignData> {
  const now = new Date().toISOString();
  const campaign: CampaignData = {
    id: randomUUID(),
    name: data.name,
    channel: data.channel,
    templateId: data.templateId,
    segmentType: data.segmentType,
    segmentFilters: data.segmentFilters,
    scheduledAt: data.scheduledAt,
    status: "DRAFT",
    targetCount: 0,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await setCampaign(campaign);
  return campaign;
}

export async function getCampaign(campaignId: string): Promise<CampaignData | null> {
  if (!bullConnection) return null;
  const raw = await bullConnection.get(campaignKey(campaignId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignData;
  } catch {
    return null;
  }
}

export async function updateCampaign(campaignId: string, patch: Partial<CampaignData>): Promise<CampaignData | null> {
  const current = await getCampaign(campaignId);
  if (!current) return null;
  const next: CampaignData = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await setCampaign(next);
  return next;
}

export async function listCampaigns(): Promise<CampaignData[]> {
  if (!bullConnection) return [];
  const ids = await bullConnection.smembers(CAMPAIGN_IDS_KEY);
  if (ids.length === 0) return [];

  const raws = await bullConnection.mget(ids.map((id) => campaignKey(id)));
  return raws
    .filter((value): value is string => typeof value === "string")
    .map((value) => {
      try {
        return JSON.parse(value) as CampaignData;
      } catch {
        return null;
      }
    })
    .filter((value): value is CampaignData => value !== null)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export async function setCampaignRecipients(campaignId: string, recipients: CampaignRecipient[]): Promise<void> {
  if (!bullConnection) return;
  await bullConnection.set(recipientKey(campaignId), JSON.stringify(recipients));
}

export async function getCampaignRecipients(campaignId: string): Promise<CampaignRecipient[]> {
  if (!bullConnection) return [];
  const raw = await bullConnection.get(recipientKey(campaignId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CampaignRecipient[];
  } catch {
    return [];
  }
}

export async function resolveSegmentRecipients(
  segmentType: SegmentType,
  filters: Record<string, unknown>,
): Promise<CampaignRecipient[]> {
  if (segmentType === "ALL_GUESTS") {
    const guests = await db.guestProfile.findMany({
      select: { id: true, name: true, mobile: true, email: true },
      orderBy: { createdAt: "desc" },
    });
    return guests.map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  if (segmentType === "TIER") {
    const tier = String(filters.tier ?? "BRONZE");
    const guests = await db.guestProfile.findMany({
      where: { tier: tier as any },
      select: { id: true, name: true, mobile: true, email: true },
      orderBy: { createdAt: "desc" },
    });
    return guests.map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  if (segmentType === "TAG") {
    const tag = String(filters.tag ?? "").trim();
    if (!tag) return [];
    const guests = await db.guestProfile.findMany({
      where: { tags: { has: tag } },
      select: { id: true, name: true, mobile: true, email: true },
      orderBy: { createdAt: "desc" },
    });
    return guests.map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  if (segmentType === "INACTIVE") {
    const inactiveDays = Number(filters.inactiveDays ?? 90);
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
    const guests = await db.guestProfile.findMany({
      where: {
        OR: [
          { lastVisitDate: null },
          { lastVisitDate: { lt: cutoff } },
        ],
      },
      select: { id: true, name: true, mobile: true, email: true },
      orderBy: { createdAt: "desc" },
    });
    return guests.map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  if (segmentType === "BIRTHDAY_MONTH") {
    const month = Number(filters.month ?? new Date().getMonth() + 1);
    const guests = await db.guestProfile.findMany({
      where: { dob: { not: null } },
      select: { id: true, name: true, mobile: true, email: true, dob: true },
    });
    return guests
      .filter((guest: any) => guest.dob && new Date(guest.dob).getMonth() + 1 === month)
      .map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  if (segmentType === "ANNIVERSARY_MONTH") {
    const month = Number(filters.month ?? new Date().getMonth() + 1);
    const guests = await db.guestProfile.findMany({
      where: { anniversaryDate: { not: null } },
      select: { id: true, name: true, mobile: true, email: true, anniversaryDate: true },
    });
    return guests
      .filter((guest: any) => guest.anniversaryDate && new Date(guest.anniversaryDate).getMonth() + 1 === month)
      .map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  if (segmentType === "LEAD_STAGE") {
    const stage = String(filters.stage ?? "NEW");
    const leads = await db.lead.findMany({
      where: { isDeleted: false, stage: stage as any },
      select: { id: true, name: true, mobile: true, email: true },
    });
    return leads.map((lead: any) => ({ id: lead.id, name: lead.name, mobile: lead.mobile, email: lead.email, source: "lead" }));
  }

  if (segmentType === "LEAD_SOURCE") {
    const source = String(filters.source ?? "WEBSITE");
    const leads = await db.lead.findMany({
      where: { isDeleted: false, source: source as any },
      select: { id: true, name: true, mobile: true, email: true },
    });
    return leads.map((lead: any) => ({ id: lead.id, name: lead.name, mobile: lead.mobile, email: lead.email, source: "lead" }));
  }

  if (segmentType === "HIGH_SPENDERS") {
    const minSpend = Number(filters.minSpend ?? 5000);
    const guests = await db.guestProfile.findMany({
      where: {
        totalSpend: { gte: minSpend },
      },
      select: { id: true, name: true, mobile: true, email: true },
      orderBy: { totalSpend: "desc" },
    });
    return guests.map((guest: any) => ({ id: guest.id, name: guest.name, mobile: guest.mobile, email: guest.email, source: "guest" }));
  }

  const mobileList = Array.isArray(filters.mobiles) ? filters.mobiles : [];
  const sanitized = mobileList
    .map((value) => String(value).replace(/\D/g, "").slice(-10))
    .filter((value) => value.length === 10);

  if (sanitized.length === 0) return [];

  const guests = await db.guestProfile.findMany({
    where: { mobile: { in: sanitized } },
    select: { id: true, name: true, mobile: true, email: true },
  });

  const guestRows = guests as BasicRecipientRow[];
  const guestMap = new Map<string, BasicRecipientRow>(
    guestRows
      .filter((guest) => typeof guest.mobile === "string" && guest.mobile.length > 0)
      .map((guest) => [guest.mobile as string, guest]),
  );

  return sanitized.map((mobile, index) => {
    const guest = guestMap.get(mobile);
    if (guest) {
      return {
        id: guest.id,
        name: guest.name,
        mobile: guest.mobile,
        email: guest.email,
        source: "guest" as const,
      };
    }
    return {
      id: `custom-${index}-${mobile}`,
      name: `Mobile ${mobile}`,
      mobile,
      email: null,
      source: "lead" as const,
    };
  });
}

async function processCampaignJob(job: Job<CampaignJobData>): Promise<void> {
  const { campaignId, recipient } = job.data;

  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const template = await db.messageTemplate.findFirst({
    where: {
      id: campaign.templateId,
      isActive: true,
    },
    select: {
      id: true,
      subject: true,
      body: true,
      channel: true,
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const rendered = templateRender(template.body, {
    name: recipient.name,
    mobile: recipient.mobile,
    email: recipient.email,
    year: new Date().getFullYear(),
  });

  let sent = false;
  let errorMessage: string | null = null;

  if (campaign.channel === "SMS") {
    if (!recipient.mobile) throw new Error("Recipient mobile missing");
    const result = await sendSMS(recipient.mobile, rendered);
    sent = result.ok;
    errorMessage = result.error ?? null;
  } else if (campaign.channel === "WHATSAPP") {
    if (!recipient.mobile) throw new Error("Recipient mobile missing");
    const result = await sendWhatsApp(recipient.mobile, rendered);
    sent = result.ok;
    errorMessage = result.error ?? null;
  } else {
    if (!recipient.email) throw new Error("Recipient email missing");
    const result = await sendEmail(recipient.email, template.subject ?? campaign.name, rendered);
    sent = result.ok;
    errorMessage = result.error ?? null;
  }

  await db.communicationLog.create({
    data: {
      recipientMobile: recipient.mobile ?? null,
      recipientEmail: recipient.email ?? null,
      channel: campaign.channel,
      templateId: template.id,
      status: sent ? "SENT" : "FAILED",
      payload: toJsonValue({
        campaignId,
        recipient,
        body: rendered,
      }),
      sentAt: sent ? new Date() : null,
      errorMessage,
      referenceId: campaignId,
      referenceType: "campaign",
    },
  });

  const next = await updateCampaign(campaignId, {
    sentCount: campaign.sentCount + 1,
    deliveredCount: campaign.deliveredCount + (sent ? 1 : 0),
    failedCount: campaign.failedCount + (sent ? 0 : 1),
  });

  if (next && next.sentCount >= next.targetCount && next.targetCount > 0) {
    await updateCampaign(campaignId, { status: "SENT" });
  }

  if (!sent) {
    throw new Error(errorMessage ?? "Campaign delivery failed");
  }
}

export function ensureCampaignWorkerStarted(): void {
  if (!bullConnection) return;
  if (workerStarted) return;

  workerRef = new Worker<CampaignJobData>(campaignQueueName, processCampaignJob, {
    connection: bullConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  });

  workerRef.on("failed", (job: Job<CampaignJobData> | undefined, error: Error) => {
    console.error("[campaign worker] failed", {
      jobId: job?.id,
      campaignId: job?.data?.campaignId,
      error: error.message,
    });
  });

  workerStarted = true;
}

export async function enqueueCampaignJobs(campaignId: string, recipients: CampaignRecipient[]): Promise<number> {
  if (!campaignQueue) return 0;
  const jobs = recipients.map((recipient) => ({
    name: `campaign:${campaignId}`,
    data: { campaignId, recipient },
    opts: {
      jobId: `${campaignId}:${recipient.id}`,
    },
  }));

  if (jobs.length === 0) return 0;

  await campaignQueue.addBulk(jobs);
  return jobs.length;
}

export async function cancelCampaignJobs(campaignId: string): Promise<number> {
  if (!campaignQueue) return 0;
  const jobs: Job<CampaignJobData>[] = await campaignQueue.getJobs(["waiting", "delayed", "paused", "prioritized"]);
  const matched = jobs.filter((job: Job<CampaignJobData>) => job.data.campaignId === campaignId);
  await Promise.all(matched.map((job) => job.remove()));
  return matched.length;
}
