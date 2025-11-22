"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: { name: string; value: string }[];
}

export function ColorPicker({
  color,
  onChange,
  label = "Color",
  presetColors = [],
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-2">
        {/* Preset Colors */}
        {presetColors.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`w-8 h-8 rounded-md border-2 transition-all ${
              color === preset.value
                ? "border-foreground scale-110"
                : "border-muted-foreground/20 hover:border-muted-foreground/50"
            }`}
            style={{ backgroundColor: preset.value }}
            title={preset.name}
          />
        ))}

        {/* Custom Color Picker Button */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 gap-2 border-2 border-dashed relative"
              title="Custom color"
            >
              <div
                className="w-5 h-5 rounded border-2 border-foreground/20"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium">Custom</span>
              {!presetColors.some((p) => p.value === color) && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Custom Color</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <HexColorPicker color={color} onChange={onChange} />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  placeholder="#000000"
                />
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  variant="default"
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
