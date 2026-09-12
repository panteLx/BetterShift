"use client";

import { ReactNode, useEffect } from "react";
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
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const WIDTHS = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[840px]",
};

export type PanelWidth = keyof typeof WIDTHS;

/** Air kept between the focused field and the keyboard edge */
const FIELD_MARGIN = 20;
/** Rounded top corners stay visible even on a full-height phone sheet */
const SHEET_TOP_GAP = 12;

/**
 * Scrolls the panel body only. Scrolling the document instead would drag the
 * fixed sheet along and push the field back out of view.
 */
function revealInPanel(field: HTMLElement) {
  const scroller = field.closest<HTMLElement>("[data-panel-scroll]");
  if (!scroller) return;

  const target = field.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const below = target.bottom + FIELD_MARGIN - box.bottom;
  const above = box.top - (target.top - FIELD_MARGIN);

  if (below > 0) scroller.scrollTop += below;
  else if (above > 0) scroller.scrollTop -= above;
}

/** Waits for the sheet to settle at its new size before measuring the field. */
function scheduleReveal(field: HTMLElement) {
  return requestAnimationFrame(() => revealInPanel(field));
}

/** Scrollable body of a panel; use inside `bare` panels or settings sections. */
export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-panel-scroll=""
      className={cn("min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]", className)}
    >
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
  const keyboard = useKeyboardInset(open && !desktop);
  const close = () => onOpenChange(false);

  // The sheet has just been resized around the keyboard; bring the field back into view
  useEffect(() => {
    if (!keyboard) return;
    const field = document.activeElement;
    if (!(field instanceof HTMLElement)) return;

    const frame = scheduleReveal(field);
    return () => cancelAnimationFrame(frame);
  }, [keyboard]);

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
    // repositionInputs off: vaul moves the whole sheet by the keyboard height,
    // which pushes the header and long bodies off screen. useKeyboardInset
    // pins the sheet to the visible area instead.
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        className="rounded-t-[18px] border-line bg-background shadow-sheet data-[vaul-drawer-direction=bottom]:max-h-[calc(100dvh-12px)] data-[vaul-drawer-direction=bottom]:rounded-t-[18px] dark:bg-surface-panel [&>div:first-child]:hidden"
        style={
          keyboard
            ? {
                bottom: keyboard.bottom,
                maxHeight: keyboard.viewportHeight - SHEET_TOP_GAP,
              }
            : undefined
        }
        // Moving between fields while the keyboard is already up changes no viewport
        onFocusCapture={(event) => {
          if (keyboard) scheduleReveal(event.target as HTMLElement);
        }}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <span className="h-1 w-[34px] rounded-full bg-control" />
        </div>
        {header}
        {content}
      </DrawerContent>
    </Drawer>
  );
}
