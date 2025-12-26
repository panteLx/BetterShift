"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HexColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: { name: string; value: string }[];
  disabled?: boolean;
}

export function ColorPicker({
  color,
  onChange,
  label = "Color",
  presetColors = [],
  disabled = false,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations();

  return (
    <div className="space-y-2.5">
      {label && (
        <Label className="text-sm font-medium flex items-center gap-2">
          <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
          {label}
        </Label>
      )}
      <div className="flex flex-wrap gap-2">
        {/* Preset Colors */}
        {presetColors.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => !disabled && onChange(preset.value)}
            disabled={disabled}
            className={`w-10 h-10 rounded-lg border-2 transition-all ${
              color === preset.value
                ? "border-primary scale-110 shadow-lg"
                : "border-border/30 hover:border-border/60 hover:scale-105"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{
              backgroundColor: preset.value,
              boxShadow:
                color === preset.value
                  ? `0 4px 12px ${preset.value}40`
                  : "none",
            }}
            title={preset.name}
          />
        ))}

        {/* Custom Color Picker Button */}
        <Dialog open={open} onOpenChange={disabled ? () => {} : setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-10 px-3 gap-2 border-2 border-dashed border-border/50 hover:border-primary/50 relative transition-all"
              title={t("color.custom", { default: "Custom color" })}
            >
              <div
                className="w-5 h-5 rounded border-2 border-foreground/20"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium">
                {t("color.custom", { default: "Custom" })}
              </span>
              {!presetColors.some((p) => p.value === color) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
            <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
              <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                {t("color.customTitle", { default: "Custom Color" })}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t("color.customDescription", {
                  default: "Choose a custom color using the color picker",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-6">
              <div className="rounded-xl overflow-hidden border border-border/50 shadow-lg">
                <HexColorPicker
                  color={color}
                  onChange={onChange}
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-1 text-base shadow-sm transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  placeholder="#000000"
                />
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  variant="default"
                  className="h-11 px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
                >
                  OK
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
