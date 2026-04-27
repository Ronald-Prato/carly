import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--carly-page-bg)] px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Carly
          </h1>
          <p className="mt-2 text-sm text-[var(--carly-muted)]">
            Crea una cuenta para continuar.
          </p>
        </div>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/"
        />
      </div>
    </div>
  );
}
