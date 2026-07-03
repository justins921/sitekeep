import Link from "next/link";
import { Card } from "@/components/ui";
import { ForgotForm } from "./ForgotForm";

export default function ForgotPasswordPage() {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your account email and we&apos;ll send you a reset link.
      </p>

      <div className="mt-6">
        <ForgotForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to log in
        </Link>
      </p>
    </Card>
  );
}
