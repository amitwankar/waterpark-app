"use client";

import { ChevronDown } from "lucide-react";

import { TicketSelector, type BookingTicketType } from "@/components/booking/TicketSelector";
import { ParticipantRow, type ParticipantDraft } from "@/components/booking/ParticipantRow";
import { Button } from "@/components/ui/Button";
import { type TicketLine } from "@/lib/booking";

export interface Step2TicketSelectionProps {
  tickets: BookingTicketType[];
  ticketLines: TicketLine[];
  error?: string;
  participants: ParticipantDraft[];
  onTicketLinesChange: (next: TicketLine[]) => void;
  onParticipantsChange: (next: ParticipantDraft[]) => void;
}

export function Step2TicketSelection({
  tickets,
  ticketLines,
  error,
  participants,
  onTicketLinesChange,
  onParticipantsChange,
}: Step2TicketSelectionProps): JSX.Element {
  const totalGuests = ticketLines.reduce((s, l) => s + l.quantity, 0);
  const collapseByDefault = totalGuests > 20;

  return (
    <div className="space-y-5">
      <TicketSelector tickets={tickets} value={ticketLines} onChange={onTicketLinesChange} error={error} />

      {totalGuests > 0 ? (
        <details
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          open={!collapseByDefault}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--color-text)]">
            Guest Details
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          </summary>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Add guest names for a personalised experience.</p>

          {collapseByDefault ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const fallback = participants.map((participant, index) => ({
                    ...participant,
                    name: participant.name?.trim() ? participant.name : `Guest ${index + 1}`,
                  }));
                  onParticipantsChange(fallback);
                }}
              >
                Fill Later
              </Button>
            </div>
          ) : null}

          <div className="mt-3 space-y-3">
            {participants.map((participant, index) => {
              const ticket = tickets.find((item) => item.id === participant.ticketTypeId);
              const outOfRange =
                participant.age !== undefined &&
                ticket &&
                ((ticket.minAge !== null && participant.age < ticket.minAge) ||
                  (ticket.maxAge !== null && participant.age > ticket.maxAge));

              return (
                <div key={participant.id} className="space-y-1">
                  <ParticipantRow
                    participant={participant}
                    index={index}
                    onChange={(next) => {
                      const updated = [...participants];
                      updated[index] = next;
                      onParticipantsChange(updated);
                    }}
                  />
                  {outOfRange ? (
                    <p className="text-xs text-amber-600">
                      Age {participant.age} is outside recommended range for {ticket?.name}.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}
