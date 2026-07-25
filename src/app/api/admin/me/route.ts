import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

export async function GET() {
  const { session, user, error } = await requireSession(["ADMIN", "CASHIER"]);
  if (error || !session || !user) {
    return apiError(error || "UNAUTHORIZED", "Not authenticated", error === "FORBIDDEN" ? 403 : 401);
  }
  return apiOk({
    user: { id: user.id, email: user.email, role: user.role, username: user.username },
  });
}
