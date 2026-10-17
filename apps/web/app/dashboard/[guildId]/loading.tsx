import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-[14px]" />
    </div>
  );
}
