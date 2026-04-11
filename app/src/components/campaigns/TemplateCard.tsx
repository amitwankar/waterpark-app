import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";

export interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    channel: "SMS" | "WHATSAPP" | "EMAIL";
    subject: string | null;
    body: string;
    variables: string[];
    isActive: boolean;
    isSystem?: boolean;
  };
  onEdit?: (id: string) => void;
  onTest?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleActive?: (id: string, next: boolean) => void;
}

export function TemplateCard({ template, onEdit, onTest, onDelete, onToggleActive }: TemplateCardProps): JSX.Element {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{template.name}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{template.channel}</p>
          </div>
          <Badge variant={template.isActive ? "success" : "default"}>{template.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {template.subject ? <p className="text-xs text-[var(--color-text-muted)]">Subject: {template.subject}</p> : null}
        <p className="line-clamp-5 whitespace-pre-wrap text-sm text-[var(--color-text)]">{template.body}</p>
        <div className="flex flex-wrap gap-1">
          {template.variables.map((variable) => (
            <Badge key={variable} variant="info">{`{${variable}}`}</Badge>
          ))}
        </div>
      </CardBody>
      <CardFooter className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onEdit?.(template.id)}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => onTest?.(template.id)}>Test</Button>
        <Button size="sm" variant="secondary" onClick={() => onToggleActive?.(template.id, !template.isActive)}>
          {template.isActive ? "Disable" : "Enable"}
        </Button>
        {!template.isSystem ? (
          <Button size="sm" variant="danger" onClick={() => onDelete?.(template.id)}>Delete</Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
