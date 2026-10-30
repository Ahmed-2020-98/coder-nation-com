"use client";

import { useActionState, useEffect, useRef, useTransition, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { saveSettingsAction, type ActionState } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Field, inputClass, textareaClass } from "@/components/admin/ui/Field";
import { useToast } from "@/components/admin/ui/Toaster";
import { SOCIAL_KEYS, type SiteSettings } from "@/lib/settings-shape";

const SOCIAL_LABEL: Record<(typeof SOCIAL_KEYS)[number], string> = {
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  instagram: "Instagram",
  github: "GitHub",
  tiktok: "TikTok",
  youtube: "YouTube",
};
const ECOSYSTEM_LABEL = { marketing: "التسويق (marketing.codernation.com)", sales: "المبيعات (sales.codernation.com)", crm: "إدارة العملاء (crm.codernation.com)" } as const;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      <div className="mt-5 grid gap-5">{children}</div>
    </Card>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(saveSettingsAction, null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const shown = useRef<ActionState>(null);
  const error = (name: string) => state?.fieldErrors?.[name];
  const invalid = (name: string) => (error(name) ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {});

  useEffect(() => {
    if (!state || shown.current === state) return;
    shown.current = state;
    if (state.ok) toast.success("اتحفظت الإعدادات وبانت على الموقع");
    else if (state.error) toast.error(state.error);
  }, [state, toast]);

  // Submitted by hand (not `<form action>`) so React doesn't reset every field to its pre-save value afterwards.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <Section title="التواصل" description="الأرقام والبيانات اللي بتظهر في قسم التواصل والـ Footer.">
        <Field
          label="رقم الواتساب"
          htmlFor="whatsappNumber"
          hint="بالصيغة الدولية، أرقام فقط من غير + أو مسافات. مثال: 201012345678"
          error={error("whatsappNumber")}
        >
          <input id="whatsappNumber" name="whatsappNumber" dir="ltr" inputMode="numeric" defaultValue={settings.whatsappNumber} className={`${inputClass} text-start font-mono`} {...invalid("whatsappNumber")} />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="email" error={error("email")}>
          <input id="email" name="email" type="email" dir="ltr" defaultValue={settings.email} className={`${inputClass} text-start`} {...invalid("email")} />
        </Field>
        <Field label="ساعات العمل" htmlFor="workingHours" error={error("workingHours")}>
          <input id="workingHours" name="workingHours" defaultValue={settings.workingHours} maxLength={120} className={inputClass} {...invalid("workingHours")} />
        </Field>
      </Section>

      <Section title="حسابات السوشيال" description="اللي تتساب فاضية مش بتظهر في الموقع. الروابط لازم تبدأ بـ https://">
        {SOCIAL_KEYS.map((key) => (
          <Field key={key} label={SOCIAL_LABEL[key]} htmlFor={`social_${key}`} error={error(`social_${key}`)}>
            <input id={`social_${key}`} name={`social_${key}`} type="url" dir="ltr" placeholder="https://" defaultValue={settings.socials[key]} className={`${inputClass} text-start`} {...invalid(`social_${key}`)} />
          </Field>
        ))}
      </Section>

      <Section title="SEO" description="العنوان والوصف اللي بيظهروا في جوجل وعند مشاركة الرابط.">
        <Field label="عنوان الصفحة" htmlFor="seoTitle" aside="حتى 70 حرف" error={error("seoTitle")}>
          <input id="seoTitle" name="seoTitle" defaultValue={settings.seo.title} maxLength={70} className={inputClass} {...invalid("seoTitle")} />
        </Field>
        <Field label="الوصف" htmlFor="seoDescription" aside="من 30 لـ 200 حرف" error={error("seoDescription")}>
          <textarea id="seoDescription" name="seoDescription" rows={3} defaultValue={settings.seo.description} maxLength={200} className={textareaClass} {...invalid("seoDescription")} />
        </Field>
      </Section>

      <Section title="روابط المنظومة" description="روابط التطبيقات الفرعية في الـ Footer. شغّل الرابط لما التطبيق يبقى جاهز بس.">
        <fieldset className="grid gap-3">
          <legend className="sr-only">روابط المنظومة</legend>
          {(Object.keys(ECOSYSTEM_LABEL) as (keyof typeof ECOSYSTEM_LABEL)[]).map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name={`eco_${key}`} defaultChecked={settings.ecosystem[key]} className="size-5 accent-primary-500" />
              {ECOSYSTEM_LABEL[key]}
            </label>
          ))}
        </fieldset>
      </Section>

      <div className="sticky bottom-0 -mx-(--gutter) border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 aria-hidden="true" className="spin size-4" /> : <Save aria-hidden="true" className="size-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </form>
  );
}
