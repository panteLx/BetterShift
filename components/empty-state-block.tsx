import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-brand-soft text-brand",
  neutral: "bg-surface-sunken text-fg-secondary",
  danger: "bg-danger-soft text-danger",
};

/** Centered icon tile, title and next step for empty and blocked screens. */
export function EmptyStateBlock({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[520px] flex-col items-center gap-4 text-center">
      <div
        className={cn(
          "flex size-[52px] items-center justify-center rounded-[14px]",
          TONES[tone]
        )}
      >
        <Icon className="size-6" />
      </div>
      <div>
        <h1 className="text-[21px] font-semibold leading-tight tracking-[-0.02em] text-fg-strong">
          {title}
        </h1>
        <p className="mt-[7px] text-pretty text-[14.5px] leading-[1.6] text-fg-secondary">
          {description}
        </p>
      </div>
      {actions && (
        <div className="mt-1 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Button sizing for the actions of an EmptyStateBlock; give icons `size-[17px]`. */
export const stateActionClass =
  "h-[42px] gap-2 rounded-[9px] px-[18px] text-[14px] font-semibold has-[>svg]:px-[18px]";
