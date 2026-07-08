/**
 * Text toggle for show/hide disclosures (recommendations, passing checks, …).
 * Carries the shared focus-visible ring the hand-rolled toggles were missing, and
 * a chevron that rotates to convey open/closed state (state motion, not decor;
 * disabled under prefers-reduced-motion). Presentational — the parent owns state.
 */
export function DisclosureButton({
  open,
  onClick,
  children,
}: {
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
    >
      {children}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className={
          "h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none " +
          (open ? "rotate-180" : "")
        }
      >
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
