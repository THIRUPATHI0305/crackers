"use client";

export function AdminSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) onSubmit();
        }}
        placeholder={placeholder}
        className="min-w-[220px] flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-amber"
      />
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      )}
    </div>
  );
}

export function matchesQuery(
  q: string,
  ...parts: Array<string | number | null | undefined>
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
}
