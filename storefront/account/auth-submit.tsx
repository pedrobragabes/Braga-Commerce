"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function AuthSubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="primary-button full" type="submit" disabled={pending} aria-busy={pending}>
    {pending ? "Aguarde…" : children}
  </button>;
}
