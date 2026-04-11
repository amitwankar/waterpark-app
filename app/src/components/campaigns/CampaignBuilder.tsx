"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SegmentPreview } from "@/components/campaigns/SegmentPreview";
import { SegmentSelector, type SegmentType } from "@/components/campaigns/SegmentSelector";
import { TemplateGrid } from "@/components/campaigns/TemplateGrid";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export interface CampaignBuilderTemplate {
  id: string;
  name: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  subject: string | null;
  body: string;
  variables: string[];
  isActive: boolean;
}

export interface CampaignBuilderProps {
  templates: CampaignBuilderTemplate[];
}

export function CampaignBuilder({ templates }: CampaignBuilderProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"SMS" | "WHATSAPP" | "EMAIL">("SMS");
  const [templateId, setTemplateId] = useState("");
  const [segmentType, setSegmentType] = useState<SegmentType>("ALL_GUESTS");
  const [segmentFilters, setSegmentFilters] = useState<Record<string, unknown>>({});
  const [scheduleMode, setScheduleMode] = useState<"NOW" | "LATER">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewSamples, setPreviewSamples] = useState<Array<{ id: string; name: string; mobile?: string | null; email?: string | null }>>([]);

  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.channel === channel && template.isActive),
    [templates, channel],
  );

  async function previewSegment(): Promise<void> {
    setPreviewLoading(true);
    try {
      const response = await fetch("/api/v1/campaigns/preview-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentType,
          segmentFilters,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { count?: number; samples?: Array<{ id: string; name: string; mobile?: string | null; email?: string | null }>; message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not preview segment");
      }
      setPreviewCount(payload?.count ?? 0);
      setPreviewSamples(payload?.samples ?? []);
    } catch (error) {
      pushToast({
        title: "Segment preview failed",
        message: error instanceof Error ? error.message : "Failed to preview segment",
        variant: "error",
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  function nextStep(): void {
    setStep((current) => Math.min(5, current + 1));
  }

  function prevStep(): void {
    setStep((current) => Math.max(1, current - 1));
  }

  function submitCampaign(): void {
    if (!name.trim() || !templateId) {
      pushToast({ title: "Missing fields", message: "Campaign name and template are required.", variant: "warning" });
      return;
    }

    startTransition(() => {
      void fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel,
          templateId,
          segmentType,
          segmentFilters,
          scheduledAt: scheduleMode === "LATER" ? new Date(scheduledAt).toISOString() : null,
        }),
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { campaign?: { id: string }; message?: string } | null;
          if (!response.ok || !payload?.campaign?.id) {
            throw new Error(payload?.message ?? "Campaign create failed");
          }

          if (scheduleMode === "NOW") {
            await fetch(`/api/v1/campaigns/${payload.campaign.id}/send`, { method: "POST" });
          }

          pushToast({ title: "Campaign created", variant: "success" });
          router.push(`/admin/campaigns/${payload.campaign.id}`);
        })
        .catch((error: unknown) => {
          pushToast({
            title: "Campaign create failed",
            message: error instanceof Error ? error.message : "Could not create campaign",
            variant: "error",
          });
        });
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Campaign Builder</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Step {step} of 5</p>
      </CardHeader>
      <CardBody className="space-y-4">
        {step === 1 ? (
          <Input label="Campaign Name" value={name} onChange={(event) => setName(event.target.value)} />
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {(["SMS", "WHATSAPP", "EMAIL"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setChannel(option);
                  setTemplateId("");
                }}
                className={`rounded-[var(--radius-lg)] border p-4 text-left transition ${channel === option ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)]"}`}
              >
                <p className="font-semibold text-[var(--color-text)]">{option}</p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <TemplateGrid
            items={filteredTemplates}
            onEdit={() => undefined}
            onTest={() => undefined}
            onDelete={() => undefined}
            onToggleActive={() => undefined}
          />
        ) : null}

        {step === 3 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)]">Select Template</p>
            <select
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">Choose template</option>
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <SegmentSelector
              segmentType={segmentType}
              filters={segmentFilters}
              onChange={(nextType, nextFilters) => {
                setSegmentType(nextType);
                setSegmentFilters(nextFilters);
              }}
            />
            <div className="space-y-3">
              <Button variant="outline" onClick={() => void previewSegment()} loading={previewLoading}>Preview Reach</Button>
              <SegmentPreview count={previewCount} samples={previewSamples} loading={previewLoading} />
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={scheduleMode === "NOW" ? "primary" : "outline"} onClick={() => setScheduleMode("NOW")}>Send Now</Button>
              <Button variant={scheduleMode === "LATER" ? "primary" : "outline"} onClick={() => setScheduleMode("LATER")}>Schedule Later</Button>
            </div>
            {scheduleMode === "LATER" ? (
              <Input
                label="Schedule At"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            ) : null}
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3 text-sm text-[var(--color-text-muted)]">
              <p>Name: <span className="font-medium text-[var(--color-text)]">{name || "-"}</span></p>
              <p>Channel: <span className="font-medium text-[var(--color-text)]">{channel}</span></p>
              <p>Template: <span className="font-medium text-[var(--color-text)]">{templateId || "-"}</span></p>
              <p>Segment: <span className="font-medium text-[var(--color-text)]">{segmentType}</span></p>
              <p>Estimated Reach: <span className="font-medium text-[var(--color-text)]">{previewCount}</span></p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={prevStep} disabled={step === 1 || isPending}>Back</Button>
          {step < 5 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={submitCampaign} loading={isPending}>Confirm Campaign</Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
