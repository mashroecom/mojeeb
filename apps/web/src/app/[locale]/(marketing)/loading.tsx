export default function MarketingLoading() {
  return (
    <div className="container max-w-4xl py-20 animate-pulse">
      <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-muted" />
      <div className="mx-auto mb-4 h-10 w-64 rounded-lg bg-muted" />
      <div className="mx-auto mb-12 h-5 w-96 max-w-full rounded-lg bg-muted" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
