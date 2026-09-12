import { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  warning: {
    box: "border-warning-line bg-warning-surface",
    icon: "text-warning",
    title: "text-warning-title",
    body: "text-warning",
  },
  danger: {
    box: "border-danger-line bg-danger-surface",
    icon: "text-danger",
    title: "text-danger",
    body: "text-danger-body",
  },
  info: {
    box: "border-line bg-surface-panel",
    icon: "text-fg-secondary",
    title: "text-fg-strong",
    body: "text-fg-secondary",
  },
} as const;

interface StatusBannerProps {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StatusBanner({
  tone,
  icon: Icon,
  title,
  children,
  action,
  className,
}: StatusBannerProps) {
  const styles = TONES[tone];
  return (
    <div
      role={tone === "info" ? "note" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[11px] border px-[13px] py-[11px]",
        styles.box,
        className
      )}
    >
      <Icon className={cn("mt-px size-4 shrink-0", styles.icon)} />
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
        {title && <div className={cn("text-[13px] font-semibold", styles.title)}>{title}</div>}
        {children && <div className={styles.body}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
