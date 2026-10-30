"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toaster";

const FormContext = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

type ActionFormProps = {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Clear the fields after a successful save (for "add a note" style forms). */
  resetOnSuccess?: boolean;
  /** Show the action's message in the page instead of a short-lived toast (one-time passwords must not vanish). */
  persistMessage?: boolean;
  /** Called after a successful save with the data that was submitted. */
  onSuccess?: (submitted: FormData) => void;
};

/**
 * A form wired to a server action. It submits by hand (not `<form action>`) so React never resets the fields after a
 * save, shows field errors through <FormField>, and reports success/failure in a toast. Server pages can render it
 * with plain markup inside: only the action and the children cross the server/client line.
 */
export function ActionForm({ action, children, className, resetOnSuccess = false, persistMessage = false, onSuccess }: ActionFormProps) {
  const [state, dispatch, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const shown = useRef<ActionState>(null);
  const submitted = useRef<FormData | null>(null);

  useEffect(() => {
    if (!state || shown.current === state) return;
    shown.current = state;
    if (state.ok) {
      if (!persistMessage) toast.success(state.message ?? "اتحفظ");
      if (resetOnSuccess) formRef.current?.reset();
      if (onSuccess && submitted.current) onSuccess(submitted.current);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, toast, persistMessage, resetOnSuccess, onSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    submitted.current = data;
    startTransition(() => dispatch(data));
  }

  return (
    <FormContext value={{ state, pending }}>
      {/* method="post": if the script hasn't loaded, a submit must never fall back to GET (a password would end up in the URL). */}
      <form ref={formRef} method="post" onSubmit={onSubmit} className={className} noValidate>
        {children}
        {persistMessage && state?.ok && state.message ? (
          <p role="status" className="mt-4 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-sm font-semibold break-all">
            {state.message}
          </p>
        ) : null}
      </form>
    </FormContext>
  );
}

/** A labelled control whose error comes from the surrounding <ActionForm> (`fieldErrors[name]`). */
export function FormField({ label, name, hint, aside, className, children }: { label: string; name: string; hint?: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  const { state } = useContext(FormContext);
  return (
    <Field label={label} htmlFor={name} hint={hint} aside={aside} error={state?.fieldErrors?.[name]} className={className}>
      {children}
    </Field>
  );
}

export function FormError() {
  const { state } = useContext(FormContext);
  return state?.error && !state.ok ? (
    <p role="alert" className="rounded-lg border border-error-500/50 bg-error-500/10 px-4 py-3 text-sm text-error-700">
      {state.error}
    </p>
  ) : null;
}

export function SubmitButton({ children, ...props }: Omit<Extract<ButtonProps, { href?: undefined }>, "type">) {
  const { pending } = useContext(FormContext);
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 aria-hidden="true" className="spin size-4" /> : null}
      {children}
    </Button>
  );
}
