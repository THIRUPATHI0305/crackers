"use client";

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

const base =
  "w-full rounded-xl border bg-surface-muted px-4 py-3 text-sm outline-none transition focus:bg-surface disabled:opacity-60";

function cn(ok: boolean) {
  return `${base} ${ok ? "border-border focus:border-amber" : "border-danger focus:border-danger"}`;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-danger">{message}</p>;
}

export function TextField({
  label,
  error,
  className,
  maxLength,
  value,
  ...props
}: {
  label?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const len =
    typeof value === "string" ? value.length : undefined;
  return (
    <label className="block text-sm font-semibold text-navy">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {typeof maxLength === "number" ? (
          <span className="text-[11px] font-medium text-muted">
            {len != null ? `${len}/` : ""}
            {maxLength}
          </span>
        ) : null}
      </span>
      <input
        {...props}
        value={value}
        maxLength={maxLength}
        className={`${cn(!error)} mt-1.5 ${className || ""}`}
      />
      <FieldError message={error} />
    </label>
  );
}

export function TextAreaField({
  label,
  error,
  className,
  maxLength,
  value,
  ...props
}: {
  label?: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const len =
    typeof value === "string" ? value.length : undefined;
  return (
    <label className="block text-sm font-semibold text-navy">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {typeof maxLength === "number" ? (
          <span className="text-[11px] font-medium text-muted">
            {len != null ? `${len}/` : ""}
            {maxLength}
          </span>
        ) : null}
      </span>
      <textarea
        {...props}
        value={value}
        maxLength={maxLength}
        className={`${cn(!error)} mt-1.5 ${className || ""}`}
      />
      <FieldError message={error} />
    </label>
  );
}

/** Exactly 10 digits; strips non-digits as the user types. */
export function PhoneField({
  label = "Mobile number",
  error,
  value,
  onChange,
  name,
  required,
  disabled,
  placeholder = "10-digit mobile",
}: {
  label?: string;
  error?: string;
  value: string;
  onChange: (digits10: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-navy">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="text-[11px] font-medium text-muted">
          {value.length}/10
        </span>
      </span>
      <input
        name={name}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="tel"
        maxLength={10}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          onChange(digits);
        }}
        className={`${cn(!error)} mt-1.5`}
      />
      <FieldError message={error} />
    </label>
  );
}

export function SelectField({
  label,
  error,
  className,
  children,
  ...props
}: {
  label?: string;
  error?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <select {...props} className={`${cn(!error)} mt-1.5 ${className || ""}`}>
        {children}
      </select>
      <FieldError message={error} />
    </label>
  );
}

export function OtpField({
  label = "OTP",
  error,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  error?: string;
  value: string;
  onChange: (otp: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-navy">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="text-[11px] font-medium text-muted">
          {value.length}/6
        </span>
      </span>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="6-digit code"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${cn(!error)} mt-1.5 tracking-[0.35em]`}
      />
      <FieldError message={error} />
    </label>
  );
}
