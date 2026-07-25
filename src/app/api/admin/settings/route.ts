import { ZodError } from "zod";
import { requireSession, writeAudit } from "@/lib/auth";
import { apiError, apiOk, fromZod } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { settingsSaveSchema } from "@/lib/validation";
import { DEFAULT_SHOP, getShopSettings } from "@/lib/shop-settings";
import {
  getOtpProviderSettings,
  getOtpSettingsPublic,
} from "@/lib/otp-settings";

const DEFAULT_LOYALTY = {
  pointsPerHundred: 1,
  minRedemptionPoints: 1,
  maxDiscountPercent: 30,
  maxLoyaltyDiscountAmount: 5000,
  expiryMonths: 12,
  enabled: true,
};

async function readJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.value) } as T;
  } catch {
    return fallback;
  }
}

async function readLoyaltySettings() {
  const loyalty = await readJsonSetting("loyalty", DEFAULT_LOYALTY);
  if ((loyalty.minRedemptionPoints ?? 50) > 1) {
    const next = { ...loyalty, minRedemptionPoints: 1 };
    await prisma.setting.upsert({
      where: { key: "loyalty" },
      update: { value: JSON.stringify(next) },
      create: { key: "loyalty", value: JSON.stringify(next) },
    });
    return next;
  }
  return loyalty;
}

function mergeSecret(
  current: string,
  incoming: string | undefined,
  clear: boolean | undefined
) {
  if (clear) return "";
  if (incoming && incoming.trim() && !incoming.includes("•")) {
    return incoming.trim();
  }
  return current;
}

export async function GET() {
  const { error } = await requireSession(["ADMIN"]);
  if (error) return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  const [shop, loyalty, otp] = await Promise.all([
    getShopSettings(),
    readLoyaltySettings(),
    getOtpSettingsPublic(),
  ]);
  return apiOk({ shop, loyalty, otp });
}

export async function PUT(req: Request) {
  const auth = await requireSession(["ADMIN"]);
  if (auth.error || !auth.user) {
    return apiError(auth.error || "UNAUTHORIZED", "Forbidden", 401);
  }

  try {
    const body = settingsSaveSchema.parse(await req.json());
    const shop = { ...DEFAULT_SHOP, ...body.shop };

    const ops = [
      prisma.setting.upsert({
        where: { key: "shop" },
        update: { value: JSON.stringify(shop) },
        create: { key: "shop", value: JSON.stringify(shop) },
      }),
      prisma.setting.upsert({
        where: { key: "loyalty" },
        update: { value: JSON.stringify(body.loyalty) },
        create: { key: "loyalty", value: JSON.stringify(body.loyalty) },
      }),
    ];

    if (body.otp) {
      const current = await getOtpProviderSettings();
      const next = {
        emailFrom:
          body.otp.emailFrom !== undefined
            ? (body.otp.emailFrom || "").trim()
            : current.emailFrom,
        smtpHost:
          body.otp.smtpHost !== undefined
            ? (body.otp.smtpHost || "").trim() || "smtp.gmail.com"
            : current.smtpHost,
        smtpPort: body.otp.smtpPort ?? current.smtpPort,
        smtpUser:
          body.otp.smtpUser !== undefined
            ? (body.otp.smtpUser || "").trim()
            : current.smtpUser,
        smtpPass: mergeSecret(
          current.smtpPass,
          body.otp.smtpPass?.replace(/\s+/g, ""),
          body.otp.clearSmtpPass
        ),
        resendApiKey: mergeSecret(
          current.resendApiKey,
          body.otp.resendApiKey,
          body.otp.clearResendApiKey
        ),
        authkeyAuthKey: mergeSecret(
          current.authkeyAuthKey,
          body.otp.authkeyAuthKey,
          body.otp.clearAuthkey
        ),
        authkeySid: body.otp.clearAuthkey
          ? ""
          : body.otp.authkeySid?.trim() &&
              !body.otp.authkeySid.includes("•")
            ? body.otp.authkeySid.trim()
            : current.authkeySid,
        fast2smsApiKey: mergeSecret(
          current.fast2smsApiKey,
          body.otp.fast2smsApiKey,
          body.otp.clearFast2smsApiKey
        ),
      };
      ops.push(
        prisma.setting.upsert({
          where: { key: "otp" },
          update: { value: JSON.stringify(next) },
          create: { key: "otp", value: JSON.stringify(next) },
        })
      );
    }

    await prisma.$transaction(ops);
    await writeAudit(auth.user.id, "SETTINGS_UPDATE", "Setting", "shop+loyalty+otp");
    const otp = await getOtpSettingsPublic();
    return apiOk({ shop, loyalty: body.loyalty, otp });
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e);
    return apiError("INTERNAL_ERROR", "Could not save settings", 500);
  }
}
