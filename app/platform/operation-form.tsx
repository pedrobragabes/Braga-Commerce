"use client";
import { useActionState, type ReactNode } from "react";
import { operateStore } from "./actions";
export function OperationForm({ children, label }: { children: ReactNode; label: string }) {
  const [state, action, pending] = useActionState(operateStore, {});
  return <form action={action} className="admin-form-card">{children}<p role={state.error ? "alert" : "status"}>{state.error || state.success}</p><button className="admin-button primary" disabled={pending}>{pending ? "Registrando…" : label}</button></form>;
}
