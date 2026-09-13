"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isGuestEligible, type BundleSeedKey, type Capability } from "@/lib/permission-bundles";
import { cn } from "@/lib/utils";

export interface BundleOption {
  id: string;
  name: string;
  seedKey: BundleSeedKey | null;
  capabilities: Capability[];
}

/** A bundle's display name: the translated standard label while `seedKey` is set, otherwise its own name (4.2/E6). */
export function useBundleDisplayName() {
  const t = useTranslations();
  return (bundle: Pick<BundleOption, "name" | "seedKey"> | null | undefined) => {
    if (!bundle) return null;
    return bundle.seedKey ? t(`permissionBundles.seed.${bundle.seedKey}`) : bundle.name;
  };
}

interface BundlePickerProps {
  bundles: BundleOption[];
  /** null selects the "no access" option (only meaningful with allowNone). */
  value: string | null;
  onChange: (bundleId: string | null) => void;
  /** Restrict to guest-eligible bundles only (guest access / links, E7). */
  guestEligibleOnly?: boolean;
  /** Adds a "no access" option that reports null. */
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  triggerAriaLabel?: string;
  className?: string;
}

/** Dropdown to assign a permission bundle — replaces the old read/write/admin pickers. */
export function BundlePicker({
  bundles,
  value,
  onChange,
  guestEligibleOnly = false,
  allowNone = false,
  noneLabel,
  disabled = false,
  triggerAriaLabel,
  className,
}: BundlePickerProps) {
  const displayName = useBundleDisplayName();
  const options = guestEligibleOnly
    ? bundles.filter((b) => isGuestEligible(b.capabilities))
    : bundles;
  const selected = value ? options.find((b) => b.id === value) : null;
  const label = value === null ? noneLabel : selected ? displayName(selected) : "…";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={triggerAriaLabel}
        className={cn(
          "flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg border border-line px-[9px] text-[12.5px] font-medium text-fg-body transition-colors hover:bg-surface-panel disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-surface-panel",
          className
        )}
      >
        {label}
        <ChevronDown className="size-[13px] text-fg-tertiary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {allowNone && (
          <DropdownMenuItem onClick={() => onChange(null)} className="items-start gap-2.5 py-2">
            <Check className={cn("mt-0.5 size-4 shrink-0 text-brand", value !== null && "invisible")} />
            <span className="text-[13px] font-semibold text-fg-strong">{noneLabel}</span>
          </DropdownMenuItem>
        )}
        {options.map((bundle) => (
          <DropdownMenuItem
            key={bundle.id}
            onClick={() => onChange(bundle.id)}
            className="items-start gap-2.5 py-2"
          >
            <Check
              className={cn("mt-0.5 size-4 shrink-0 text-brand", bundle.id !== value && "invisible")}
            />
            <span className="text-[13px] font-semibold text-fg-strong">{displayName(bundle)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
