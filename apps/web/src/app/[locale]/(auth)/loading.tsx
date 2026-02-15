export default function AuthLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 mx-auto rounded-lg bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-10 rounded-lg bg-muted" />
    </div>
  );
}
