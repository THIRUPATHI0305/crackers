import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BUSINESS_RULE"
  | "INTERNAL_ERROR";

export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  fields?: Record<string, string[]>
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        fields: fields ?? {},
        requestId: `req_${Date.now()}`,
      },
    },
    { status }
  );
}

export function fromZod(error: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] = fields[key] ?? [];
    fields[key].push(issue.message);
  }
  return apiError("VALIDATION_ERROR", "Request validation failed", 400, fields);
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `******${digits.slice(-4)}`;
}

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
