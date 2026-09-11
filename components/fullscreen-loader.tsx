import { Loader2 } from "lucide-react";

interface FullscreenLoaderProps {
  message?: string;
}

/** Single quiet loading state for initial page loads, instead of flickering skeletons. */
export function FullscreenLoader({ message }: FullscreenLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background"
    >
      <Loader2 className="size-7 animate-spin text-brand" aria-hidden />
      {message && <p className="text-[13px] text-fg-tertiary">{message}</p>}
    </div>
  );
}
