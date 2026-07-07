import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[#18794e] text-xl font-black text-white">
            S
          </div>
          <h1 className="text-xl font-black">Sekai Stock Count</h1>
          <p className="mt-1 text-sm text-[#68726c]">
            Choose how you want to sign in
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
