"use client";

import { useEffect, useRef, useState } from "react";

export type CustomerAutofill = {
  email: string;
  name: string;
  whatsapp: string;
  city: string;
  area: string;
  pincode: string;
  emailLocked: boolean;
};

type WithCsrf = (init?: RequestInit) => Promise<RequestInit>;

/**
 * When mobile reaches 10 digits, load saved customer profile and autofill.
 */
export function useCustomerAutofill(
  phone: string,
  withCsrf: WithCsrf,
  csrfReady: boolean,
  onProfile: (profile: CustomerAutofill | null) => void
) {
  const [lookingUp, setLookingUp] = useState(false);
  const [hint, setHint] = useState("");
  const lastPhone = useRef("");
  const onProfileRef = useRef(onProfile);
  onProfileRef.current = onProfile;

  useEffect(() => {
    if (phone.length !== 10) {
      lastPhone.current = "";
      setLookingUp(false);
      setHint("");
      onProfileRef.current(null);
      return;
    }
    if (!csrfReady || lastPhone.current === phone) return;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLookingUp(true);
      setHint("");
      try {
        const init = await withCsrf({
          method: "POST",
          body: JSON.stringify({ phone }),
        });
        const res = await fetch("/api/customer/by-phone", init);
        const data = await res.json();
        if (cancelled) return;
        lastPhone.current = phone;
        if (!res.ok || !data?.found) {
          onProfileRef.current(null);
          setHint("");
          return;
        }
        onProfileRef.current({
          email: data.email || "",
          name: data.name || "",
          whatsapp: data.whatsapp || "",
          city: data.city || "",
          area: data.area || "",
          pincode: data.pincode || "",
          emailLocked: Boolean(data.emailLocked),
        });
        setHint(
          data.email
            ? "Saved details loaded for this mobile"
            : "Welcome back — complete your details"
        );
      } catch {
        if (!cancelled) {
          onProfileRef.current(null);
          setHint("");
        }
      } finally {
        if (!cancelled) setLookingUp(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [phone, csrfReady, withCsrf]);

  return { lookingUp, hint };
}

/** Apply registered email/phone from BUSINESS_RULE API errors. */
export function applyBindingDetails(
  errorJson: {
    error?: {
      details?: { registeredEmail?: string; registeredPhone?: string };
    };
  },
  setters: {
    setEmail?: (v: string) => void;
    setPhone?: (v: string) => void;
    setEmailLocked?: (v: boolean) => void;
  }
) {
  const details = errorJson?.error?.details;
  if (details?.registeredEmail && setters.setEmail) {
    setters.setEmail(details.registeredEmail);
    setters.setEmailLocked?.(true);
  }
  if (details?.registeredPhone && setters.setPhone) {
    setters.setPhone(details.registeredPhone);
  }
}
