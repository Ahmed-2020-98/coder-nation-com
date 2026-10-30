"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "@/components/ui/Field";

/** A password field with an eye button to see what was typed (so a typo doesn't cost a locked-out login). */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "dir">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} dir="ltr" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${inputClass} pe-12 text-start`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "إخفاء الباسورد" : "إظهار الباسورد"}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 grid w-11 cursor-pointer place-items-center rounded-e-lg text-ink-muted hover:text-accent"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-[1.1rem]" /> : <Eye aria-hidden="true" className="size-[1.1rem]" />}
      </button>
    </div>
  );
}
