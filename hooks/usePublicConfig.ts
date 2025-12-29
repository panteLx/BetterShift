/**
 * Re-export usePublicConfig hook for easier imports
 *
 * This allows importing directly from hooks/ directory:
 * import { usePublicConfig } from '@/hooks/usePublicConfig'
 *
 * Instead of:
 * import { usePublicConfig } from '@/components/public-config-provider'
 */

export { usePublicConfig } from "@/components/public-config-provider";
export type { PublicConfig } from "@/lib/public-config";
