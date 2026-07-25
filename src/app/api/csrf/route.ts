import { issueCsrfResponse } from "@/lib/csrf";

export async function GET() {
  return issueCsrfResponse();
}
