import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading(): JSX.Element {
  return (
    <div className="space-y-5">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>

      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
