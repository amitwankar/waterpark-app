import "server-only";

import { headers as nextHeaders } from "next/headers";

import { db } from "@/lib/db";

export interface AuditParams {
  userId?: string | null;
  userRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userRole: params.userRole ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue !== undefined ? (params.oldValue as object) : undefined,
        newValue: params.newValue !== undefined ? (params.newValue as object) : undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to write audit log", error);
  }
}

export function getIp(request: { headers: { get(name: string): string | null } }): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip") ?? null;
}

export async function getRequestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const hdr = await nextHeaders();
  const ipAddress = hdr.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdr.get("x-real-ip") ?? null;
  const userAgent = hdr.get("user-agent") ?? null;
  return { ipAddress, userAgent };
}
