import { TemplateCard, type TemplateCardProps } from "@/components/campaigns/TemplateCard";

export interface TemplateGridProps {
  items: TemplateCardProps["template"][];
  onEdit?: (id: string) => void;
  onTest?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleActive?: (id: string, next: boolean) => void;
}

export function TemplateGrid({ items, onEdit, onTest, onDelete, onToggleActive }: TemplateGridProps): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <TemplateCard
          key={item.id}
          template={item}
          onEdit={onEdit}
          onTest={onTest}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
        />
      ))}
    </div>
  );
}
