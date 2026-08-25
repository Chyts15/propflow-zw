import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      fallbackRedirectUrl="/dashboard"
      appearance={{
        variables: { colorPrimary: "#c8522a" },
        elements: { card: "rounded-2xl shadow-sm border border-stone-200" },
      }}
    />
  );
}
