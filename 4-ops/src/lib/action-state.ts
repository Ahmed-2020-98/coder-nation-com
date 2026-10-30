/** What every form in the app gets back from its server action. `fieldErrors` keys are the form's field names. */
export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string } | null;

export const formText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};
