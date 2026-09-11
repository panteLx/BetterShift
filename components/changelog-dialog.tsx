"use client";

import { useEffect, useState, Fragment, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { PanelDialog } from "@/components/panel-dialog";
import { getDateLocale } from "@/lib/locales";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  created_at: string;
  published_at: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
}

/** Resolves to an empty list on any failure so the dialog shows its empty state. */
async function fetchReleases(): Promise<GitHubRelease[]> {
  try {
    const response = await fetch("/api/releases");
    if (!response.ok) {
      console.error("Failed to fetch releases:", response.status, response.statusText);
      return [];
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Invalid content type:", contentType);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch releases:", error);
    return [];
  }
}

// Sanitize and validate URLs to prevent XSS
function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href);
    // Only allow http, https, and data:image URLs
    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      (parsed.protocol === "data:" && url.startsWith("data:image/"))
    ) {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

const linkClass = "font-medium text-brand-ink hover:underline";

// Parse inline markdown elements (bold, code, links) into React elements
function parseInlineMarkdown(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let currentText = "";
  let index = 0;
  let key = 0;

  const flushText = () => {
    if (currentText) {
      elements.push(<Fragment key={`text-${key++}`}>{currentText}</Fragment>);
      currentText = "";
    }
  };

  while (index < text.length) {
    // Auto-link URLs
    const urlMatch = text.slice(index).match(/^https?:\/\/[^\s<]+[^\s<.,;:!?"')]/);
    if (urlMatch) {
      flushText();
      const url = urlMatch[0];
      const sanitized = sanitizeUrl(url);
      if (sanitized) {
        elements.push(
          <a
            key={`link-${key++}`}
            href={sanitized}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} break-all`}
          >
            {url}
          </a>
        );
      } else {
        currentText += url;
      }
      index += url.length;
      continue;
    }

    // Markdown links [text](url)
    const linkMatch = text.slice(index).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      flushText();
      const linkText = linkMatch[1];
      const sanitized = sanitizeUrl(linkMatch[2]);
      if (sanitized) {
        elements.push(
          <a
            key={`link-${key++}`}
            href={sanitized}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {linkText}
          </a>
        );
      } else {
        currentText += linkText;
      }
      index += linkMatch[0].length;
      continue;
    }

    // Bold **text**
    const boldMatch = text.slice(index).match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      flushText();
      elements.push(
        <strong key={`bold-${key++}`} className="font-semibold text-fg-strong">
          {boldMatch[1]}
        </strong>
      );
      index += boldMatch[0].length;
      continue;
    }

    // Inline code `text`
    const codeMatch = text.slice(index).match(/^`([^`]+)`/);
    if (codeMatch) {
      flushText();
      elements.push(
        <code
          key={`code-${key++}`}
          className="whitespace-nowrap rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[12px] text-fg-strong"
        >
          {codeMatch[1]}
        </code>
      );
      index += codeMatch[0].length;
      continue;
    }

    currentText += text[index];
    index++;
  }

  flushText();
  return elements;
}

function codeBlock(lines: string[], key: string) {
  return (
    <pre
      key={key}
      className="my-2.5 overflow-x-auto rounded-lg border border-line bg-surface-panel p-3"
    >
      <code className="block font-mono text-[12px] text-fg-body">{lines.join("\n")}</code>
    </pre>
  );
}

// Parse markdown text into React elements
function parseMarkdown(text: string): ReactNode[] {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let elementKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${elementKey++}`}
          className="my-1.5 list-disc space-y-1 pl-5 marker:text-fg-faint"
        >
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushList();
      if (inCodeBlock) {
        elements.push(codeBlock(codeBlockLines, `code-${elementKey++}`));
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h6 key={`h6-${elementKey++}`} className="eyebrow mb-1.5 mt-3.5">
          {parseInlineMarkdown(line.slice(4))}
        </h6>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h5
          key={`h5-${elementKey++}`}
          className="mb-1.5 mt-3.5 text-[14px] font-semibold text-fg-strong"
        >
          {parseInlineMarkdown(line.slice(3))}
        </h5>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h4
          key={`h4-${elementKey++}`}
          className="mb-2 mt-4 text-[15px] font-semibold text-fg-strong"
        >
          {parseInlineMarkdown(line.slice(2))}
        </h4>
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(
        <li key={`li-${elementKey++}`} className="text-[13px] leading-relaxed text-fg-body">
          {parseInlineMarkdown(line.slice(2))}
        </li>
      );
      continue;
    }

    flushList();

    if (line.trim() === "") {
      elements.push(<div key={`space-${elementKey++}`} className="h-1.5" />);
      continue;
    }

    elements.push(
      <p key={`p-${elementKey++}`} className="my-1 text-[13px] leading-relaxed text-fg-body">
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  flushList();
  if (inCodeBlock) {
    elements.push(codeBlock(codeBlockLines, `code-${elementKey++}`));
  }

  return elements;
}

export function ChangelogDialog({ open, onOpenChange, locale }: ChangelogDialogProps) {
  const t = useTranslations();
  // null until the first response arrives
  const [releases, setReleases] = useState<GitHubRelease[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchReleases().then((data) => {
      if (!cancelled) setReleases(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const formatDate = (dateString: string) =>
    format(new Date(dateString), "PPP", { locale: getDateLocale(locale) });

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("changelog.title")}
      description={t("changelog.description")}
      width="lg"
      bodyClassName="py-0"
    >
      {releases === null ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-fg-tertiary" />
        </div>
      ) : releases.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-fg-tertiary">
          {t("changelog.noReleases")}
        </p>
      ) : (
        <div className="divide-y divide-line-subtle">
          {releases.map((release) => {
            const title = release.name && release.name !== release.tag_name ? release.name : null;
            const releaseUrl = sanitizeUrl(release.html_url);
            return (
              <section key={release.id} className="py-[18px]">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h3 className="font-mono text-[14px] font-semibold text-fg-strong">
                    {release.tag_name}
                  </h3>
                  <span className="text-[12px] text-fg-tertiary">
                    {formatDate(release.published_at)}
                  </span>
                  {releaseUrl && (
                    <a
                      href={releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-ink hover:underline"
                    >
                      {t("changelog.viewOnGitHub")}
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                {title && (
                  <div className="mt-1 text-[13.5px] font-semibold text-fg-body">{title}</div>
                )}
                {release.body && <div className="mt-2">{parseMarkdown(release.body)}</div>}
              </section>
            );
          })}
        </div>
      )}
    </PanelDialog>
  );
}
