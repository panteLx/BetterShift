"use client";

import { useEffect, useState, Fragment, ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { de, enUS, it } from "date-fns/locale";

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

export function ChangelogDialog({
  open,
  onOpenChange,
  locale,
}: ChangelogDialogProps) {
  const t = useTranslations();
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchReleases();
    }
  }, [open]);

  const fetchReleases = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/releases");
      if (!response.ok) {
        console.error(
          "Failed to fetch releases:",
          response.status,
          response.statusText
        );
        setLoading(false);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Invalid content type:", contentType);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setReleases(data);
    } catch (error) {
      console.error("Failed to fetch releases:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "PPP", {
      locale: locale === "de" ? de : locale === "it" ? it : enUS,
    });
  };

  // Sanitize and validate URLs to prevent XSS
  const sanitizeUrl = (url: string): string | null => {
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
  };

  // Parse inline markdown elements (bold, code, links) into React elements
  const parseInlineMarkdown = (text: string): ReactNode[] => {
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
      const urlMatch = text
        .slice(index)
        .match(/^https?:\/\/[^\s<]+[^\s<.,;:!?"')]/);
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
              className="text-primary hover:underline font-medium break-all"
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
        const linkUrl = linkMatch[2];
        const sanitized = sanitizeUrl(linkUrl);
        if (sanitized) {
          elements.push(
            <a
              key={`link-${key++}`}
              href={sanitized}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
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
          <strong
            key={`bold-${key++}`}
            className="font-semibold text-foreground"
          >
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
            className="px-1.5 py-0.5 rounded bg-muted/80 text-xs font-mono text-foreground whitespace-nowrap"
          >
            {codeMatch[1]}
          </code>
        );
        index += codeMatch[0].length;
        continue;
      }

      // Regular character
      currentText += text[index];
      index++;
    }

    flushText();
    return elements;
  };

  // Parse markdown text into React elements
  const parseMarkdown = (text: string): ReactNode[] => {
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
            className="list-disc ml-6 space-y-1 my-2"
          >
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks (```)
      if (line.startsWith("```")) {
        flushList();
        if (inCodeBlock) {
          // Close code block
          elements.push(
            <pre
              key={`code-${elementKey++}`}
              className="bg-muted/50 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto"
            >
              <code className="text-sm font-mono text-foreground block">
                {codeBlockLines.join("\n")}
              </code>
            </pre>
          );
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      // Inside code block
      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Headers
      if (line.startsWith("### ")) {
        flushList();
        elements.push(
          <h4
            key={`h4-${elementKey++}`}
            className="text-base font-semibold mt-4 mb-2 text-foreground"
          >
            {parseInlineMarkdown(line.slice(4))}
          </h4>
        );
        continue;
      }
      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h3
            key={`h3-${elementKey++}`}
            className="text-lg font-semibold mt-5 mb-3 text-foreground"
          >
            {parseInlineMarkdown(line.slice(3))}
          </h3>
        );
        continue;
      }
      if (line.startsWith("# ")) {
        flushList();
        elements.push(
          <h2
            key={`h2-${elementKey++}`}
            className="text-xl font-bold mt-6 mb-4 text-foreground"
          >
            {parseInlineMarkdown(line.slice(2))}
          </h2>
        );
        continue;
      }

      // Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const content = line.slice(2);
        listItems.push(
          <li
            key={`li-${elementKey++}`}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            {parseInlineMarkdown(content)}
          </li>
        );
        continue;
      }

      // Close list if we're in one and hit a non-list line
      if (listItems.length > 0) {
        flushList();
      }

      // Empty lines
      if (line.trim() === "") {
        elements.push(<div key={`space-${elementKey++}`} className="h-2" />);
        continue;
      }

      // Regular paragraphs
      elements.push(
        <p
          key={`p-${elementKey++}`}
          className="text-sm text-muted-foreground my-1"
        >
          {parseInlineMarkdown(line)}
        </p>
      );
    }

    // Close list if still open at end
    flushList();

    // Close code block if still open at end
    if (inCodeBlock) {
      elements.push(
        <pre
          key={`code-${elementKey++}`}
          className="bg-muted/50 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto"
        >
          <code className="text-sm font-mono text-foreground block">
            {codeBlockLines.join("\n")}
          </code>
        </pre>
      );
    }

    return elements;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            {t("changelog.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("changelog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : releases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("changelog.noReleases")}
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {releases.map((release) => (
                <div
                  key={release.id}
                  className="border border-border/50 rounded-lg p-4 bg-gradient-to-br from-background to-muted/20 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="h-4 w-4 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">
                          {release.name || release.tag_name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(release.published_at)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          release.html_url,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="shrink-0"
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      {t("changelog.viewOnGitHub")}
                    </Button>
                  </div>
                  {release.body && (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {parseMarkdown(release.body)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
