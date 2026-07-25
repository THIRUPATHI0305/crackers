import { Suspense } from "react";
import AdminLoginForm from "./login-form";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-atmosphere text-navy">
          Loading…
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
