"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/useSignOut";

export function SignOutButton({ label }: { label: string }) {
  const signOut = useSignOut();

  return (
    <Button
      variant="ghost"
      onClick={signOut}
      className="h-9 gap-2 rounded-[9px] text-[13.5px] font-medium text-fg-secondary"
    >
      <LogOut className="size-4" />
      {label}
    </Button>
  );
}
