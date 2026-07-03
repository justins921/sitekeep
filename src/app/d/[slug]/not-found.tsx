export default function DashboardNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          Dashboard unavailable
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          This dashboard isn&apos;t available
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          The link may be incorrect, or this dashboard has been paused. Please
          check with whoever shared it.
        </p>
      </div>
    </main>
  );
}
