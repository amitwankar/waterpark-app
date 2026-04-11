export interface SegmentPreviewProps {
  count: number;
  samples: Array<{ id: string; name: string; mobile?: string | null; email?: string | null }>;
  loading?: boolean;
}

export function SegmentPreview({ count, samples, loading }: SegmentPreviewProps): JSX.Element {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--color-text)]">Audience Preview</p>
      {loading ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Calculating reach...</p> : null}
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">Estimated reach: <span className="font-semibold text-[var(--color-text)]">{count}</span></p>
      <div className="mt-3 space-y-2">
        {samples.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No samples available.</p>
        ) : (
          samples.map((sample) => (
            <div key={sample.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-2 text-xs">
              <p className="font-medium text-[var(--color-text)]">{sample.name}</p>
              <p className="text-[var(--color-text-muted)]">{sample.mobile ?? sample.email ?? "-"}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
