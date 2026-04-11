"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface WorkOrderComment {
  timestamp: string;
  name: string;
  text: string;
}

export interface WorkOrderCommentsProps {
  workOrderId: string;
  comments: WorkOrderComment[];
  onPosted?: () => void;
}

export function WorkOrderComments({ workOrderId, comments, onPosted }: WorkOrderCommentsProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Comments</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No comments yet.</p>
          ) : (
            comments.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-2">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {item.name} • {new Date(item.timestamp).toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text)]">{item.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="h-20 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm outline-none"
            placeholder="Add comment"
          />
          <Button
            size="sm"
            loading={isPending}
            onClick={() => {
              if (!comment.trim()) return;
              startTransition(() => {
                void fetch(`/api/v1/maintenance/work-orders/${workOrderId}/comment`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ comment }),
                }).then(() => {
                  setComment("");
                  onPosted?.();
                });
              });
            }}
          >
            Post Comment
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
