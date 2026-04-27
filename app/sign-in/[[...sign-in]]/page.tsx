import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--carly-page-bg)] px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Carly
          </h1>
          <p className="mt-2 text-sm text-[var(--carly-muted)]">
            Inicia sesión con tu cuenta. GitHub y LinkedIn aparecen aquí cuando
            los actives en el panel de Clerk.
          </p>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
        />
      </div>
    </div>
  );
}
