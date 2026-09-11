"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthHeader } from "@/components/auth-header";
import { PanelDialog } from "@/components/panel-dialog";
import { Field, inputClass } from "@/components/form-kit";
import { EmptyStateBlock, stateActionClass } from "@/components/empty-state-block";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { cn } from "@/lib/utils";

const SHARE_PATH = "/share/token/";
// Tokens are base64url (see generateAccessToken)
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

/** Accepts a full access link (any host) or the bare token. */
function extractAccessToken(input: string): string | null {
  const value = input.trim();
  const index = value.indexOf(SHARE_PATH);
  const candidate =
    index >= 0 ? value.slice(index + SHARE_PATH.length).split(/[/?#]/)[0] : value;
  return TOKEN_PATTERN.test(candidate) ? candidate : null;
}

/** Shown to guests when no calendar is open to them. */
export function GuestEmptyState() {
  const t = useTranslations();
  const { allowRegistration } = useAuthFeatures();
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AuthHeader showUserMenu />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:p-10">
        <EmptyStateBlock
          icon={Lock}
          title={t("emptyState.guestTitle")}
          description={t("emptyState.guestDescription")}
          actions={
            <>
              <Button asChild className={stateActionClass}>
                <Link href="/login">{t("auth.login")}</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => setLinkOpen(true)}
                className={stateActionClass}
              >
                <Link2 className="size-[17px]" />
                {t("emptyState.pasteAccessLink")}
              </Button>
            </>
          }
          footnote={allowRegistration ? t("emptyState.registrationEnabled") : undefined}
        />
      </main>
      <AccessLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </div>
  );
}

function AccessLinkDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const formId = useId();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setValue("");
      setInvalid(false);
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const token = extractAccessToken(value);
    if (!token) {
      setInvalid(true);
      return;
    }
    setNavigating(true);
    // Full page load on purpose: only the proxy handles this route (no page exists),
    // validating the token and setting the grant cookie before redirecting.
    window.location.assign(new URL(`${SHARE_PATH}${token}`, window.location.origin).href);
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("emptyState.pasteAccessLink")}
      description={t("emptyState.accessLinkDescription")}
      width="sm"
      footer={
        <>
          <Button
            variant="outline"
            className="h-10 flex-1 font-semibold"
            onClick={() => handleOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            className="h-10 flex-1 font-semibold"
            disabled={!value.trim() || navigating}
          >
            {t("emptyState.openAccessLink")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <Field
          label={t("emptyState.accessLinkLabel")}
          htmlFor={inputId}
          hint={
            invalid ? (
              <span className="text-danger">{t("emptyState.accessLinkInvalid")}</span>
            ) : undefined
          }
        >
          <Input
            id={inputId}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setInvalid(false);
            }}
            placeholder="https://…/share/token/…"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "font-mono text-[13px]")}
          />
        </Field>
      </form>
    </PanelDialog>
  );
}
