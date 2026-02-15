'use client';

export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-4">
            <div className="mb-1.5 h-4 w-24 rounded bg-muted" />
            <div className="h-10 w-full rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
