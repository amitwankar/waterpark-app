import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface ParticipantTableItem {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  age: number | null;
  isLeadGuest: boolean;
  ticketType: {
    name: string;
  };
}

export interface ParticipantTableProps {
  participants: ParticipantTableItem[];
}

function genderLabel(gender: ParticipantTableItem["gender"]): string {
  if (gender === "MALE") return "Male";
  if (gender === "FEMALE") return "Female";
  if (gender === "OTHER") return "Other";
  return "-";
}

export function ParticipantTable({ participants }: ParticipantTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Participants</h3>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
                <th className="px-2 py-2 font-medium">Guest</th>
                <th className="px-2 py-2 font-medium">Gender</th>
                <th className="px-2 py-2 font-medium">Age</th>
                <th className="px-2 py-2 font-medium">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr key={participant.id} className="border-b border-[var(--color-border)]/70 text-[var(--color-text)]">
                  <td className="px-2 py-2">
                    {`Guest ${index + 1}`}
                    {participant.isLeadGuest ? " (Lead)" : ""}
                    {`: ${participant.name}`}
                  </td>
                  <td className="px-2 py-2">{genderLabel(participant.gender)}</td>
                  <td className="px-2 py-2">{participant.age ?? "-"}</td>
                  <td className="px-2 py-2">{participant.ticketType.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
