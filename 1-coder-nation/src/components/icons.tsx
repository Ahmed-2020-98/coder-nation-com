import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Code,
  Gauge,
  LifeBuoy,
  Mail,
  MessagesSquare,
  Palette,
  PenTool,
  ShoppingBag,
  Smartphone,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/** Icons referenced by name from src/content. Unknown names fall back to <Code />. */
const iconMap: Record<string, LucideIcon> = {
  code: Code,
  smartphone: Smartphone,
  cart: ShoppingBag,
  pen: PenTool,
  palette: Palette,
  gauge: Gauge,
  calendar: CalendarCheck,
  chat: MessagesSquare,
  support: LifeBuoy,
  mail: Mail,
  clock: Clock,
};

export function DynamicIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = iconMap[name] ?? Code;
  return <Icon aria-hidden="true" strokeWidth={1.75} {...props} />;
}

/** "Forward" arrow that points the reading direction (flips automatically in RTL). */
export function ArrowIcon({ className = "size-4", ...props }: LucideProps) {
  return <ArrowRight aria-hidden="true" className={`${className} rtl:-scale-x-100`} {...props} />;
}

export function WhatsAppIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.36A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.13 15.07l-.3-.18-3.08.8.82-3-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 3.9c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.17 1.8 2.88 4.45 3.92 2.2.87 2.65.7 3.13.65.48-.04 1.54-.63 1.76-1.24.22-.6.22-1.13.15-1.24-.06-.1-.24-.17-.5-.3-.27-.13-1.54-.76-1.78-.85-.24-.09-.41-.13-.59.13-.17.26-.67.85-.82 1.02-.15.17-.3.2-.57.07-.26-.13-1.1-.4-2.1-1.3-.77-.69-1.3-1.55-1.45-1.8-.15-.27-.02-.4.11-.54.12-.12.27-.3.4-.46.13-.15.17-.26.26-.44.09-.17.04-.33-.02-.46-.07-.13-.58-1.4-.8-1.9-.2-.5-.4-.43-.59-.44h-.5Z" />
    </svg>
  );
}
