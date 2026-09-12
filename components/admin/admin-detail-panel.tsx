"use client";

import { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { PanelCloseButton, PanelDialog } from "@/components/panel-dialog";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

export interface AdminDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Stacked with an 18px gap, like the sections in 13c/13e */
  children: ReactNode;
  footer?: ReactNode;
}

/** Admin detail view: a 440px side panel over the list on desktop, a bottom sheet on phones. */
export function AdminDetailPanel({ open, onOpenChange, title, subtitle, children, footer }: AdminDetailPanelProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY, true);

  if (!desktop) {
    return (
      <PanelDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={subtitle}
        footer={footer}
        bodyClassName="flex flex-col gap-[18px]"
      >
        {children}
      </PanelDialog>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed bottom-3 right-3 top-3 z-50 flex w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[14px] border border-control bg-background shadow-window outline-none duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-8 data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8 data-[state=open]:fade-in-0 dark:bg-surface-panel">
          <div className="flex shrink-0 items-start gap-3 border-b border-line px-[18px] py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                className={subtitle ? "mt-1 truncate text-[12.5px] text-fg-tertiary" : "sr-only"}
              >
                {subtitle ?? title}
              </DialogPrimitive.Description>
            </div>
            <PanelCloseButton onClick={() => onOpenChange(false)} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] py-4">{children}</div>
          {footer && (
            <div className="flex shrink-0 items-center gap-2.5 border-t border-line px-[18px] py-4">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
