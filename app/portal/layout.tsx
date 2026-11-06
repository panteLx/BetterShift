import { notFound } from "next/navigation";
import { MULTI_TENANT } from "@/lib/auth/env";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  if (!MULTI_TENANT) notFound();
  return children;
}
