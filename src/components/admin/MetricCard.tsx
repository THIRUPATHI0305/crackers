export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "amber" | "success" | "danger";
}) {
  const tones = {
    default: "border-border bg-surface",
    amber: "border-amber/25 bg-amber/5",
    success: "border-success/25 bg-success/5",
    danger: "border-danger/25 bg-danger/5",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-navy sm:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
