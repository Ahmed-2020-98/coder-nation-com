"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/admin/ui/Button";
import { Field, inputClass, textareaClass } from "@/components/admin/ui/Field";
import { KEY, fieldId, newItem, pathKey } from "@/lib/content-form";
import { cn } from "@/lib/cn";
import { IMAGE_ACCEPT, type FieldSpec } from "@/lib/content-spec";
import { uploadImage } from "@/lib/image-upload";

type Path = readonly (string | number)[];
type Plain = Record<string, unknown>;
type Errors = Record<string, string>;
type Props = { spec: FieldSpec; value: unknown; onChange: (next: unknown) => void; path: Path; errors: Errors };

const isPlain = (value: unknown): value is Plain => typeof value === "object" && value !== null && !Array.isArray(value);

/** The control and the messages that go with it, for ANY field the content spec can describe. Recurses into groups and lists. */
export function FieldEditor({ spec, value, onChange, path, errors }: Props) {
  const id = fieldId(path);
  const error = errors[pathKey(path)];
  const invalid = error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  switch (spec.kind) {
    case "text": {
      const text = typeof value === "string" ? value : "";
      return (
        <Field label={spec.label} htmlFor={id} hint={spec.hint} error={error} aside={`${text.length}/${spec.max}`}>
          <input
            id={id}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            maxLength={spec.max}
            dir={spec.ltr ? "ltr" : undefined}
            className={cn(inputClass, spec.ltr && "text-start font-mono")}
            {...invalid}
          />
        </Field>
      );
    }

    case "area": {
      const text = typeof value === "string" ? value : "";
      return (
        <Field label={spec.label} htmlFor={id} hint={spec.hint} error={error} aside={`${text.length}/${spec.max}`}>
          <textarea id={id} value={text} onChange={(event) => onChange(event.target.value)} rows={spec.rows ?? 3} maxLength={spec.max} className={textareaClass} {...invalid} />
        </Field>
      );
    }

    case "href":
      return (
        <Field label={spec.label} htmlFor={id} hint={spec.hint} error={error}>
          <input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            maxLength={200}
            dir="ltr"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            className={cn(inputClass, "text-start font-mono")}
            {...invalid}
          />
        </Field>
      );

    case "select":
      return (
        <Field label={spec.label} htmlFor={id} hint={spec.hint} error={error}>
          <select id={id} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className={inputClass} {...invalid}>
            {spec.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      );

    case "bool":
      return (
        <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
          <input id={id} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary-500" />
          <span>
            <span className="block text-sm font-semibold">{spec.label}</span>
            {spec.hint ? <span className="mt-0.5 block text-xs text-ink-muted">{spec.hint}</span> : null}
          </span>
        </label>
      );

    case "image":
      return <ImageInput spec={spec} value={typeof value === "string" ? value : ""} onChange={onChange} id={id} error={error} />;

    case "hidden":
      return null;

    case "strings": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      const set = (next: string[]) => onChange(next);
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-semibold">{spec.label}</legend>
          {spec.hint ? <p className="text-xs text-ink-muted">{spec.hint}</p> : null}
          {items.map((item, index) => {
            const itemPath = [...path, index];
            const itemError = errors[pathKey(itemPath)];
            return (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <input
                    id={fieldId(itemPath)}
                    aria-label={`${spec.itemLabel} ${index + 1}`}
                    value={item}
                    onChange={(event) => set(items.map((entry, i) => (i === index ? event.target.value : entry)))}
                    maxLength={spec.itemMax}
                    dir={spec.ltr ? "ltr" : undefined}
                    className={cn(inputClass, "flex-1", spec.ltr && "text-start font-mono")}
                    aria-invalid={itemError ? true : undefined}
                  />
                  <Button variant="ghost" size="sm" aria-label={`حذف ${spec.itemLabel} ${index + 1}`} onClick={() => set(items.filter((_, i) => i !== index))}>
                    <X aria-hidden="true" className="size-4" />
                  </Button>
                </div>
                {itemError ? (
                  <p role="alert" className="mt-1 text-sm text-error-700">
                    {itemError}
                  </p>
                ) : null}
              </div>
            );
          })}
          {error ? (
            <p role="alert" className="text-sm text-error-700">
              {error}
            </p>
          ) : null}
          {items.length < spec.max ? (
            <Button variant="secondary" size="sm" className="w-fit" onClick={() => set([...items, ""])}>
              <Plus aria-hidden="true" className="size-4" />
              إضافة {spec.itemLabel}
            </Button>
          ) : null}
        </fieldset>
      );
    }

    case "group": {
      const group = isPlain(value) ? value : {};
      return (
        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1.5 text-sm font-semibold">{spec.label}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(spec.fields)
              .filter(([, child]) => child.kind !== "hidden")
              .map(([key, child]) => (
              <div key={key} className={wide(child) ? "sm:col-span-2" : undefined}>
                <FieldEditor spec={child} value={group[key]} onChange={(next) => onChange({ ...group, [key]: next })} path={[...path, key]} errors={errors} />
              </div>
            ))}
          </div>
        </fieldset>
      );
    }

    case "list":
      return <ListEditor spec={spec} value={value} onChange={onChange} path={path} errors={errors} />;
  }
}

/** Short single-line fields sit two per row; everything bigger takes the full row. */
function wide(spec: FieldSpec): boolean {
  if (spec.kind === "text") return spec.max > 80;
  return ["area", "strings", "group", "list", "image", "bool"].includes(spec.kind);
}

function ListEditor({ spec, value, onChange, path, errors }: Props & { spec: Extract<FieldSpec, { kind: "list" }> }) {
  const items = Array.isArray(value) ? (value as Plain[]) : [];
  const error = errors[pathKey(path)];
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {spec.hint ? <p className="text-sm text-ink-muted">{spec.hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-error-700">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-ink-muted">مفيش {spec.label} لسه.</p> : null}

      <ol className="grid gap-3">
        {items.map((item, index) => {
          const itemPath = [...path, index];
          const prefix = `${pathKey(itemPath)}.`;
          const hasError = Object.keys(errors).some((key) => key.startsWith(prefix));
          return (
            <ListItem
              key={String(item[KEY])}
              spec={spec}
              item={item}
              index={index}
              count={items.length}
              forceOpen={hasError}
              defaultOpen={String(item[KEY]) === justAdded}
              onMove={(to) => move(index, to)}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(spec.fields)
              .filter(([, child]) => child.kind !== "hidden")
              .map(([key, child]) => (
                  <div key={key} className={wide(child) ? "sm:col-span-2" : undefined}>
                    <FieldEditor
                      spec={child}
                      value={item[key]}
                      onChange={(next) => onChange(items.map((entry, i) => (i === index ? { ...entry, [key]: next } : entry)))}
                      path={[...itemPath, key]}
                      errors={errors}
                    />
                  </div>
                ))}
              </div>
            </ListItem>
          );
        })}
      </ol>

      {items.length < spec.max ? (
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => {
            const fresh = newItem(spec);
            setJustAdded(String(fresh[KEY]));
            onChange([...items, fresh]);
          }}
        >
          <Plus aria-hidden="true" className="size-4" />
          إضافة {spec.itemLabel}
        </Button>
      ) : (
        <p className="text-sm text-ink-muted">وصلت للحد الأقصى ({spec.max}).</p>
      )}
    </div>
  );
}

function ListItem({
  spec,
  item,
  index,
  count,
  forceOpen,
  defaultOpen,
  onMove,
  onRemove,
  children,
}: {
  spec: Extract<FieldSpec, { kind: "list" }>;
  item: Plain;
  index: number;
  count: number;
  forceOpen: boolean;
  defaultOpen: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = open || forceOpen;
  const title = String(item[spec.titleKey] ?? "").trim() || `${spec.itemLabel} ${index + 1}`;
  // useId, not the item key: the key is a counter that differs between the server render and the browser.
  const bodyId = useId();

  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setOpen(!expanded)}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 text-start hover:bg-canvas-alt"
        >
          <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-ink-muted transition-transform", expanded && "rotate-180")} />
          <span dir="ltr" className="font-mono text-xs text-ink-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="truncate font-semibold">{title}</span>
        </button>
        <Button variant="ghost" size="sm" disabled={index === 0} aria-label={`رفع ${title} لفوق`} onClick={() => onMove(index - 1)}>
          <ArrowUp aria-hidden="true" className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" disabled={index === count - 1} aria-label={`نزول ${title} لتحت`} onClick={() => onMove(index + 1)}>
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" aria-label={`حذف ${title}`} onClick={onRemove}>
          <Trash2 aria-hidden="true" className="size-4 text-error-700" />
        </Button>
      </div>
      {expanded ? (
        <div id={bodyId} className="border-t border-line p-4">
          {children}
        </div>
      ) : null}
    </li>
  );
}

function ImageInput({ spec, value, onChange, id, error }: { spec: Extract<FieldSpec, { kind: "image" }>; value: string; onChange: (next: unknown) => void; id: string; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const result = await uploadImage(file);
    setBusy(false);
    if ("error" in result) setProblem(result.error);
    else onChange(result.id);
    if (input.current) input.current.value = "";
  }

  const message = problem ?? error;
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold">{spec.label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid aspect-[4/3] w-40 place-items-center overflow-hidden rounded-lg border border-line-strong bg-canvas-alt text-center text-xs text-ink-muted">
          {value ? (
            // The preview comes from our own /media route (the database); next/image's optimizer would add nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/media/${value}`} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-3">من غير صورة: بيظهر رسم تجريبي</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={busy} aria-busy={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 aria-hidden="true" className="spin size-4" /> : <ImagePlus aria-hidden="true" className="size-4" />}
            {value ? "تغيير الصورة" : "رفع صورة"}
          </Button>
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => onChange("")}>
              إزالة الصورة
            </Button>
          ) : null}
        </div>
        <input ref={input} id={id} type="file" accept={IMAGE_ACCEPT.join(",")} tabIndex={-1} className="sr-only" onChange={(event) => pick(event.target.files?.[0])} />
      </div>
      {spec.hint && !message ? <p className="mt-1.5 text-xs text-ink-muted">{spec.hint}</p> : null}
      {message ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-error-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
