import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      fallbackRedirectUrl="/dashboard"
      appearance={{
        variables: { colorPrimary: "#c8522a" },
        elements: { card: "rounded-2xl shadow-sm border border-stone-200" },
      }}
    />
  );
}
