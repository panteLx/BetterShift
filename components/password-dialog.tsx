"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  onSuccess: (password: string) => void;
}

export function PasswordDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  onSuccess,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `/api/calendars/${calendarId}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json();

      if (data.valid) {
        // Store password in localStorage
        localStorage.setItem(`calendar_password_${calendarId}`, password);
        onSuccess(password);
        onOpenChange(false);
      } else {
        setError("Invalid password");
      }
    } catch (error) {
      console.error("Failed to verify password:", error);
      setError("Failed to verify password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Password Required</DialogTitle>
          <DialogDescription>
            Please enter the password for calendar &quot;{calendarName}&quot; to
            edit or delete shifts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter calendar password"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password}>
              {loading ? "Verifying..." : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
