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
import { Checkbox } from "@/components/ui/checkbox";

interface ManagePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  hasPassword: boolean;
  onSuccess: () => void;
}

export function ManagePasswordDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  hasPassword,
  onSuccess,
}: ManagePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRemovePassword(false);
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate inputs
    if (hasPassword && !currentPassword) {
      setError("Current password is required");
      return;
    }

    if (!removePassword) {
      if (!newPassword) {
        setError("New password is required");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          password: removePassword ? null : newPassword,
        }),
      });

      if (response.status === 401) {
        setError("Current password is incorrect");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError("Failed to update password");
        setLoading(false);
        return;
      }

      // Clear cached password from localStorage
      localStorage.removeItem(`calendar_password_${calendarId}`);

      // If new password was set, cache it
      if (!removePassword && newPassword) {
        localStorage.setItem(`calendar_password_${calendarId}`, newPassword);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update password:", error);
      setError("Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Password</DialogTitle>
          <DialogDescription>
            {hasPassword
              ? `Update or remove password for "${calendarName}"`
              : `Set a password for "${calendarName}"`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoFocus
              />
            </div>
          )}

          {hasPassword && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="removePassword"
                checked={removePassword}
                onCheckedChange={(checked) => setRemovePassword(!!checked)}
              />
              <Label
                htmlFor="removePassword"
                className="text-sm font-normal cursor-pointer"
              >
                Remove password protection
              </Label>
            </div>
          )}

          {!removePassword && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  {hasPassword ? "New Password" : "Password"}
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoFocus={!hasPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
