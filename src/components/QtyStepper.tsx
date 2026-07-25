"use client";

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
};

export function QtyStepper({
  value,
  min = 0,
  max = 999,
  onChange,
  size = "md",
}: Props) {
  const btn =
    size === "sm"
      ? "h-8 w-8 text-sm"
      : "h-10 w-10 text-base";
  const num = size === "sm" ? "h-8 min-w-10 text-sm" : "h-10 min-w-12 text-base";
  const willRemove = min === 0 && value === 1;

  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-label={willRemove ? "Remove from cart" : "Decrease quantity"}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${btn} flex items-center justify-center font-bold transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 ${
          willRemove ? "text-danger" : "text-navy"
        }`}
      >
        {willRemove ? <TrashIcon className="h-3.5 w-3.5" /> : "−"}
      </button>
      <span
        className={`${num} flex items-center justify-center border-x border-border px-2 font-bold tabular-nums text-navy`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${btn} font-bold text-navy transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function CartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7" />
    </svg>
  );
}
