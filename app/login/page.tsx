"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/shell/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalClose, ModalContent } from "@/components/ui/modal";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Incorrect password");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card variant="raised" padding="lg" className="w-full max-w-sm gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="m-0"><BrandLogo variant="stacked" markSize={64} /></h1>
          <p className="text-sm text-muted-foreground">Enter your password to continue</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Password" required error={error || undefined}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>

        <div className="text-center">
          <Button type="button" variant="link" size="sm" onClick={() => setShowForgot(true)}>Forgot password?</Button>
        </div>
      </Card>

      {showForgot && (
        <Modal open onOpenChange={(open) => { if (!open) setShowForgot(false); }}>
          <ModalContent title="Password help" size="sm" footer={<ModalClose render={<Button className="w-full" />}>Got it</ModalClose>}>
            <div className="flex flex-col gap-3 text-sm">
              <p>The login password is set with the <code className="rounded-sm bg-muted px-1 font-mono text-xs">APP_PASSWORD</code> environment variable. To find or reset it:</p>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground">
                <li>Check your <code className="rounded-sm bg-muted px-1 font-mono text-xs">.env.local</code> file in the project root.</li>
                <li>For a hosted deployment (Vercel, Railway, etc.), check the project&apos;s environment variable settings.</li>
                <li>If someone else set up this instance, ask them for the <code className="rounded-sm bg-muted px-1 font-mono text-xs">APP_PASSWORD</code> value.</li>
              </ol>
            </div>
          </ModalContent>
        </Modal>
      )}
    </main>
  );
}
