import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds the lift + accent border on hover. */
  interactive?: boolean;
};

export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface shadow-card",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-(--duration-base) ease-(--ease-out-expo) hover:-translate-y-1 hover:border-accent hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}
