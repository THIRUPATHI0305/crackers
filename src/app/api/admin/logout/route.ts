import { getSession } from "@/lib/auth";
import { apiOk } from "@/lib/api";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return apiOk({ ok: true });
}
