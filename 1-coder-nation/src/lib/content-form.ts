// Helpers for the content editor form (browser side): the form's own state versus what is sent to the server.
// The state is the saved JSON plus a `_k` on every list item, so React can keep an item's open/closed state and focus
// when the list is reordered; `_k` never reaches the server (see toPayload).

import type { FieldSpec } from "./content-spec";

type Plain = Record<string, unknown>;
export const KEY = "_k";

let seq = 0;
const nextKey = () => `k${++seq}`;

const isPlain = (value: unknown): value is Plain => typeof value === "object" && value !== null && !Array.isArray(value);

function stateOf(spec: FieldSpec, value: unknown): unknown {
  switch (spec.kind) {
    case "group":
      return toFormState(spec.fields, value);
    case "list":
      return (Array.isArray(value) ? value : []).map((item) => ({ [KEY]: nextKey(), ...toFormState(spec.fields, item) }));
    case "strings":
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    default:
      return value;
  }
}

export function toFormState(fields: Record<string, FieldSpec>, source: unknown): Plain {
  const from = isPlain(source) ? source : {};
  return Object.fromEntries(Object.entries(fields).map(([key, spec]) => [key, stateOf(spec, from[key])]));
}

/** A fresh list item for the "add" button: the spec's blank item, keyed. */
export function newItem(spec: Extract<FieldSpec, { kind: "list" }>): Plain {
  return { [KEY]: nextKey(), ...toFormState(spec.fields, spec.blank()) };
}

function payloadOf(spec: FieldSpec, value: unknown): unknown {
  switch (spec.kind) {
    case "group":
      return toPayload(spec.fields, value);
    case "list":
      return (Array.isArray(value) ? value : []).map((item) => toPayload(spec.fields, item));
    case "strings":
      // A row left empty is simply dropped instead of becoming an error.
      return (Array.isArray(value) ? value : []).map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
    default:
      return value;
  }
}

/** What the server receives: only the spec's fields, no `_k`, no empty rows in the plain string lists. */
export function toPayload(fields: Record<string, FieldSpec>, state: unknown): Plain {
  const from = isPlain(state) ? state : {};
  return Object.fromEntries(Object.entries(fields).map(([key, spec]) => [key, payloadOf(spec, from[key])]));
}

/** The error key of a field: "items.2.title". */
export const pathKey = (path: readonly (string | number)[]): string => path.join(".");

/** DOM id of a field, stable across renders. */
export const fieldId = (path: readonly (string | number)[]): string => `f-${path.join("-")}`;
