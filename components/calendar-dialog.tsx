"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, color: string, password?: string) => void;
}

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

export function CalendarDialog({
  open,
  onOpenChange,
  onSubmit,
}: CalendarDialogProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(
        name.trim(),
        selectedColor,
        usePassword && password ? password : undefined
      );
      setName("");
      setSelectedColor(PRESET_COLORS[0]);
      setPassword("");
      setUsePassword(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Calendar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Calendar Name</Label>
            <Input
              id="name"
              placeholder="e.g., My Shifts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-10 w-10 rounded-md transition-all ${
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-white"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="usePassword"
                checked={usePassword}
                onCheckedChange={(checked) => setUsePassword(!!checked)}
              />
              <Label
                htmlFor="usePassword"
                className="text-sm font-normal cursor-pointer"
              >
                Protect with password (optional)
              </Label>
            </div>
            {usePassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Password will be required to edit or delete shifts
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Calendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
