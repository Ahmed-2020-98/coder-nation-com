import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type AnchorProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };
type NativeButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

export type ButtonProps = AnchorProps | NativeButtonProps;

const base =
  "group relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap " +
  "transition-[transform,box-shadow,background-color,border-color,color] duration-(--duration-base) ease-(--ease-out-expo) " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-60";

const variants: Record<Variant, string> = {
  // Navy text on the brand orange: 5.98:1 (white on this orange would be only 2.85:1)
  primary:
    "bg-primary-500 text-on-primary shadow-glow hover:-translate-y-0.5 hover:bg-primary-400",
  secondary:
    "border border-line-strong bg-transparent text-ink hover:-translate-y-0.5 hover:border-accent hover:text-accent",
  ghost: "text-ink hover:text-accent",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;
  const classes = cn(base, variants[variant], sizes[size], className);

  if (typeof rest.href === "string") {
    const { href, ...anchor } = rest as Omit<AnchorProps, keyof CommonProps>;
    return (
      <a href={href} className={classes} {...anchor}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...(rest as Omit<NativeButtonProps, keyof CommonProps>)}>
      {children}
    </button>
  );
}
