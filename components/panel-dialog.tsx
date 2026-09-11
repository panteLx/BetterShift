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

export type PanelWidth = keyof typeof WIDTHS;

/** Scrollable body of a panel; use inside `bare` panels or settings sections. */
export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]", className)}>
      {children}
    </div>
  );
}

/** Action row pinned to the bottom of a panel. */
export function PanelFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2.5 border-t border-line px-[22px] pb-[max(16px,env(safe-area-inset-bottom))] pt-4 lg:pb-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelCloseButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("common.close")}
      className="flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-line text-fg-secondary transition-colors hover:bg-surface-panel"
    >
      <X className="size-4" />
    </button>
  );
}

export interface PanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Shown left of the title, e.g. a status icon */
  headerLeading?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: PanelWidth;
  bodyClassName?: string;
  /** Children render their own PanelBody/PanelFooter */
  bare?: boolean;
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
  bare = false,
  fixedHeight,
}: PanelDialogProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const close = () => onOpenChange(false);

  const content = bare ? (
    children
  ) : (
    <>
      <PanelBody className={bodyClassName}>{children}</PanelBody>
      {footer && <PanelFooter>{footer}</PanelFooter>}
    </>
  );

  const TitleEl = desktop ? DialogTitle : DrawerTitle;
  const DescriptionEl = desktop ? DialogDescription : DrawerDescription;
  const header = (
    <div
      className={cn(
        "flex shrink-0 items-start gap-3 border-b border-line px-[22px]",
        desktop ? "pb-4 pt-5" : "pb-3.5 pt-1.5"
      )}
    >
      {headerLeading}
      <div className="min-w-0 flex-1">
        <TitleEl
          className={cn(
            "font-semibold leading-tight tracking-[-0.01em] text-fg-strong",
            desktop ? "text-[19px]" : "text-[17px]"
          )}
        >
          {title}
        </TitleEl>
        <DescriptionEl
          className={cn("mt-1 text-fg-secondary", desktop ? "text-[13.5px]" : "text-[13px]", !description && "sr-only")}
        >
          {description ?? title}
        </DescriptionEl>
      </div>
      <PanelCloseButton onClick={close} />
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
          {header}
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[18px] border-line bg-background shadow-sheet data-[vaul-drawer-direction=bottom]:max-h-[94dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[18px] dark:bg-surface-panel [&>div:first-child]:hidden">
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <span className="h-1 w-[34px] rounded-full bg-control" />
        </div>
        {header}
        {content}
      </DrawerContent>
    </Drawer>
  );
}
