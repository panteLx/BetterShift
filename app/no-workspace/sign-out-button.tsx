"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stateActionClass } from "@/components/empty-state-block";
import { useSignOut } from "@/hooks/useSignOut";

export function SignOutButton({ label }: { label: string }) {
  const signOut = useSignOut();

  return (
    <Button onClick={signOut} className={stateActionClass}>
      <LogOut className="size-[17px]" />
      {label}
    </Button>
  );
}
