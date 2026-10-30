"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, Send } from "lucide-react";
import { content } from "@/content";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { EMAIL_RE, PHONE_RE, normalizePhone } from "@/lib/lead-rules";
import { submitLead } from "@/app/(site)/actions";

type FieldName = "name" | "phone" | "email" | "service" | "message";
type Errors = Partial<Record<FieldName, string>>;

const control =
  "w-full rounded-lg border bg-canvas-alt/70 px-4 text-ink transition-colors duration-(--duration-fast) placeholder:text-ink-muted/60 focus:border-accent";

function Field({
  name,
  label,
  mark,
  error,
  children,
}: {
  name: string;
  label: string;
  mark: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`field-${name}`} className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        {label}
        <span className="text-xs font-normal text-ink-muted">{mark}</span>
      </label>
      {children}
      {error ? (
        <p id={`field-${name}-error`} className="mt-2 text-sm text-error-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Validates in the browser for instant feedback, then sends the form to the `submitLead` server action, which
 * validates again and stores the request for the admin panel.
 * Accessibility: visible labels, aria-invalid + aria-describedby per field, and a focusable
 * error summary (role="alert") that links to each invalid field.
 */
export function ContactForm({ whatsappHref }: { whatsappHref: string }) {
  const { form } = content.contact;
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const errorKeys = Object.keys(errors) as FieldName[];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = normalizePhone(String(data.get("phone") ?? ""));
    const email = String(data.get("email") ?? "").trim();

    const next: Errors = {};
    if (name.length < 2) next.name = form.errors.name;
    if (!PHONE_RE.test(phone)) next.phone = form.errors.phone;
    if (email && !EMAIL_RE.test(email)) next.email = form.errors.email;

    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Wait for the summary to render, then move focus to it.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await submitLead(data);
      if (result.ok) {
        setSent(true);
        return;
      }
      if (result.fieldErrors) {
        setErrors(result.fieldErrors as Errors);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else {
        setFailure(result.error);
      }
    });
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-8 text-center shadow-window">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-500/15 text-success-300">
          <Check aria-hidden="true" className="size-7" strokeWidth={2.5} />
        </span>
        <h3 className="mt-5 text-xl font-bold">{form.success.title}</h3>
        <p className="mt-2 text-ink-muted">{form.success.text}</p>
        <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>
          {form.success.again}
        </Button>
      </div>
    );
  }

  const invalid = (name: FieldName) => (errors[name] ? { "aria-invalid": true, "aria-describedby": `field-${name}-error` } : {});
  const border = (name: FieldName) => (errors[name] ? "border-error-400" : "border-line-strong");

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="relative rounded-2xl border border-line bg-surface p-6 shadow-window sm:p-8"
      aria-labelledby="contact-form-title"
    >
      <h3 id="contact-form-title" className="text-xl font-bold">
        {form.title}
      </h3>

      {errorKeys.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-lg border border-error-400/60 bg-error-500/10 p-4 text-error-300"
        >
          <p className="font-semibold">{form.errors.summaryTitle}</p>
          <ul className="mt-2 list-disc ps-5 text-sm">
            {errorKeys.map((key) => (
              <li key={key}>
                <a href={`#field-${key}`} className="underline underline-offset-4">
                  {errors[key]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field name="name" label={form.fields.name.label} mark={form.requiredMark} error={errors.name}>
          <input
            id="field-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder={form.fields.name.placeholder}
            required
            className={cn(control, "h-12", border("name"))}
            {...invalid("name")}
          />
        </Field>

        <Field name="phone" label={form.fields.phone.label} mark={form.requiredMark} error={errors.phone}>
          <input
            id="field-phone"
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            inputMode="tel"
            placeholder={form.fields.phone.placeholder}
            required
            className={cn(control, "h-12 text-end", border("phone"))}
            {...invalid("phone")}
          />
        </Field>

        <Field name="email" label={form.fields.email.label} mark={form.optionalMark} error={errors.email}>
          <input
            id="field-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder={form.fields.email.placeholder}
            className={cn(control, "h-12 text-end", border("email"))}
            {...invalid("email")}
          />
        </Field>

        <Field name="service" label={form.fields.service.label} mark={form.optionalMark} error={errors.service}>
          <div className="relative">
            <select
              id="field-service"
              name="service"
              defaultValue=""
              className={cn(control, "h-12 cursor-pointer appearance-none pe-11", "border-line-strong")}
            >
              <option value="">{form.fields.service.placeholder}</option>
              {form.fields.service.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            />
          </div>
        </Field>

        <div className="sm:col-span-2">
          <Field name="message" label={form.fields.message.label} mark={form.optionalMark} error={errors.message}>
            <textarea
              id="field-message"
              name="message"
              rows={4}
              placeholder={form.fields.message.placeholder}
              className={cn(control, "resize-y border-line-strong py-3")}
            />
          </Field>
        </div>
      </div>

      {/* Honeypot: invisible to people and to screen readers, irresistible to form-filling bots. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {failure ? (
        <div role="alert" className="mt-6 rounded-lg border border-error-400/60 bg-error-500/10 p-4 text-error-300">
          <p>{failure}</p>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold underline underline-offset-4">
            {content.contact.whatsapp.label}
          </a>
        </div>
      ) : null}

      <Button type="submit" size="lg" className="mt-7 w-full sm:w-auto" disabled={pending} aria-busy={pending}>
        {pending ? form.failure.sending : form.submit}
        <Send aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Button>
    </form>
  );
}
