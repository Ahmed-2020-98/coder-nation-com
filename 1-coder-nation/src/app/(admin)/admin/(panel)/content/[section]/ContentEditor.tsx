"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Eye, EyeOff, Loader2, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { resetSectionAction, saveSectionAction, setSectionHiddenAction } from "../actions";
import { FieldEditor } from "@/components/admin/content/FieldEditor";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Dialog } from "@/components/admin/ui/Dialog";
import { useToast } from "@/components/admin/ui/Toaster";
import { toFormState, toPayload } from "@/lib/content-form";
import { HIDEABLE_SECTIONS, SECTION_SPECS, type SectionId } from "@/lib/content-spec";

type Plain = Record<string, unknown>;

export function ContentEditor({
  section,
  initial,
  defaults,
  modified,
  hidden,
  emptyHidden,
}: {
  section: SectionId;
  /** What the form opens with: the saved text, or the text that ships with the site. */
  initial: Plain;
  /** The text that ships with the site: where "reset" goes back to. */
  defaults: Plain;
  modified: boolean;
  /** Switched off by the admin. */
  hidden: boolean;
  /** Not on the page only because the section has nothing in it. */
  emptyHidden: boolean;
}) {
  const spec = SECTION_SPECS[section];
  const hideable = (HIDEABLE_SECTIONS as readonly string[]).includes(section);
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [start] = useState(() => toFormState(spec.fields, initial));
  const [state, setState] = useState<Plain>(start);
  const [baseline, setBaseline] = useState(() => JSON.stringify(toPayload(spec.fields, start)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [switchedOff, setSwitchedOff] = useState(hidden);

  const payload = toPayload(spec.fields, state);
  const dirty = JSON.stringify(payload) !== baseline;
  const errorCount = Object.keys(errors).length;

  // A tab closed or reloaded with unsaved text would lose it silently.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const scalarFields = Object.entries(spec.fields).filter(([, field]) => field.kind !== "list");
  const listFields = Object.entries(spec.fields).filter(([, field]) => field.kind === "list");
  const setField = (key: string, value: unknown) => setState((current) => ({ ...current, [key]: value }));

  function save() {
    startTransition(async () => {
      const result = await saveSectionAction(section, payload);
      if (result.ok) {
        setErrors({});
        setBaseline(JSON.stringify(payload));
        toast.success("اتحفظ وبان على الموقع");
        return;
      }
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      const first = Object.keys(result.fieldErrors ?? {})[0];
      // The item holding the error opens on the next render; the field exists a moment later.
      if (first) setTimeout(() => document.getElementById(`f-${first.replace(/\./g, "-")}`)?.focus(), 80);
    });
  }

  function reset() {
    startTransition(async () => {
      const result = await resetSectionAction(section);
      setConfirmReset(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const fresh = toFormState(spec.fields, defaults);
      setState(fresh);
      setBaseline(JSON.stringify(toPayload(spec.fields, fresh)));
      setErrors({});
      toast.success("رجع القسم للنص الافتراضي");
    });
  }

  function toggleVisible() {
    startTransition(async () => {
      const next = !switchedOff;
      const result = await setSectionHiddenAction(section, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSwitchedOff(next);
      toast.success(next ? "القسم اتخفّى من الموقع" : "القسم ظاهر على الموقع");
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={modified || dirty ? "accent" : "neutral"}>{modified ? "معدّل" : "النص الافتراضي"}</Badge>
        {switchedOff ? <Badge tone="error">مخفي من الموقع</Badge> : null}
        {emptyHidden && !switchedOff ? <Badge tone="error">مخفي لأنه فاضي</Badge> : null}
        {hideable ? (
          <Button variant="secondary" size="sm" className="ms-auto" disabled={pending} onClick={toggleVisible}>
            {switchedOff ? <Eye aria-hidden="true" className="size-4" /> : <EyeOff aria-hidden="true" className="size-4" />}
            {switchedOff ? "إظهار القسم في الموقع" : "إخفاء القسم من الموقع"}
          </Button>
        ) : null}
      </div>

      {spec.note ? (
        <p className="mb-5 rounded-lg border border-line bg-canvas-alt px-4 py-3 text-sm text-ink-muted">
          {spec.note.text}{" "}
          <Link href={spec.note.href} className="font-semibold text-accent underline underline-offset-4">
            {spec.note.linkLabel}
          </Link>
        </p>
      ) : null}

      {errorCount > 0 ? (
        <p role="alert" className="mb-5 flex items-start gap-2.5 rounded-lg border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-error-700" />
          في {errorCount} {errorCount === 1 ? "حقل محتاج" : "حقول محتاجة"} تصحيح. الحقول متعلّم عليها بالأحمر تحت.
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !pending) save();
        }}
        className="grid gap-6"
        noValidate
      >
        {scalarFields.length > 0 ? (
          <Card className="p-6">
            <div className="grid gap-5">
              {scalarFields.map(([key, field]) => (
                <FieldEditor key={key} spec={field} value={state[key]} onChange={(value) => setField(key, value)} path={[key]} errors={errors} />
              ))}
            </div>
          </Card>
        ) : null}

        {listFields.map(([key, field]) => (
          <Card key={key} className="p-6">
            <h2 className="mb-4 text-lg font-bold">{field.kind === "list" ? field.label : key}</h2>
            <FieldEditor spec={field} value={state[key]} onChange={(value) => setField(key, value)} path={[key]} errors={errors} />
          </Card>
        ))}

        <div className="sticky bottom-0 -mx-(--gutter) flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
          <Button type="submit" disabled={pending || !dirty} aria-busy={pending}>
            {pending ? <Loader2 aria-hidden="true" className="spin size-4" /> : <Save aria-hidden="true" className="size-4" />}
            حفظ
          </Button>
          <Button variant="danger" disabled={pending || (!modified && !dirty)} onClick={() => setConfirmReset(true)}>
            <RotateCcw aria-hidden="true" className="size-4" />
            رجّع للافتراضي
          </Button>
          <Button variant="ghost" href={`/#${spec.anchor}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" className="size-4" />
            شوف الموقع
            <span className="sr-only">(يفتح في نافذة جديدة)</span>
          </Button>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {dirty ? "فيه تعديلات لسه ما اتحفظتش" : ""}
          </p>
        </div>
      </form>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="الرجوع للنص الافتراضي"
        description="هيتمسح تعديلك على القسم ده وترجع النصوص اللي جاية مع الموقع. الصور اللي رفعتها هتتشال كمان."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              إلغاء
            </Button>
            <Button variant="danger" disabled={pending} onClick={reset}>
              {pending ? <Loader2 aria-hidden="true" className="spin size-4" /> : null}
              أيوه، رجّعه
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{spec.title}</p>
      </Dialog>
    </>
  );
}
