"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const WIDTHS = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[840px]",
};

export interface PanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Replaces the title block, e.g. for a leading status icon */
  headerLeading?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: keyof typeof WIDTHS;
  bodyClassName?: string;
  /** Desktop-only fixed height, for layouts with an inner sidebar */
  fixedHeight?: string;
}

/** Design-system panel: a centered dialog on desktop, a bottom sheet on phones. */
export function PanelDialog({
  open,
  onOpenChange,
  title,
  description,
  headerLeading,
  children,
  footer,
  width = "md",
  bodyClassName,
  fixedHeight,
}: PanelDialogProps) {
  const t = useTranslations();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);

  const closeButton = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      aria-label={t("common.close")}
      className="flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-line text-fg-secondary transition-colors hover:bg-surface-panel"
    >
      <X className="size-4" />
    </button>
  );

  const body = (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]", bodyClassName)}>
      {children}
    </div>
  );

  const foot = footer && (
    <div className="flex shrink-0 gap-2.5 border-t border-line px-[22px] pb-[max(16px,env(safe-area-inset-bottom))] pt-4 lg:pb-4">
      {footer}
    </div>
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex max-h-[min(860px,calc(100dvh-48px))] flex-col gap-0 overflow-hidden rounded-2xl border-control p-0 shadow-window",
            WIDTHS[width]
          )}
          style={fixedHeight ? { height: fixedHeight } : undefined}
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-line px-[22px] pb-4 pt-5">
            {headerLeading}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
                {title}
              </DialogTitle>
              <DialogDescription
                className={cn("mt-1 text-[13.5px] text-fg-secondary", !description && "sr-only")}
              >
                {description ?? title}
              </DialogDescription>
            </div>
            {closeButton}
          </div>
          {body}
          {foot}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[18px] border-line bg-background shadow-sheet data-[vaul-drawer-direction=bottom]:max-h-[94dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[18px] dark:bg-surface-panel [&>div:first-child]:hidden">
        <div className="flex justify-center pb-1 pt-2">
          <span className="h-1 w-[34px] rounded-full bg-control" />
        </div>
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-[22px] pb-3.5 pt-1.5">
          {headerLeading}
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
              {title}
            </DrawerTitle>
            <DrawerDescription
              className={cn("mt-1 text-[13px] text-fg-secondary", !description && "sr-only")}
            >
              {description ?? title}
            </DrawerDescription>
          </div>
          {closeButton}
        </div>
        {body}
        {foot}
      </DrawerContent>
    </Drawer>
  );
}
