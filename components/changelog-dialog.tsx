"use client";

import { useEffect, useState } from "react";
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
import { de, enUS } from "date-fns/locale";

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
      if (response.ok) {
        const data = await response.json();
        setReleases(data);
      }
    } catch (error) {
      console.error("Failed to fetch releases:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "PPP", {
      locale: locale === "de" ? de : enUS,
    });
  };

  const formatMarkdown = (text: string) => {
    // Enhanced markdown to HTML conversion with proper list and code block handling
    const lines = text.split("\n");
    const result: string[] = [];
    let inList = false;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code blocks (```)
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          // Close code block
          result.push(
            `<pre class="bg-muted/50 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto"><code class="text-sm font-mono text-foreground block">${codeBlockContent
              .map((l) => escapeHtml(l))
              .join("\n")}</code></pre>`
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Open code block
          if (inList) {
            result.push("</ul>");
            inList = false;
          }
          inCodeBlock = true;
          // Language hint could be used: line.slice(3).trim()
        }
        continue;
      }

      // Inside code block
      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Headers
      if (line.startsWith("### ")) {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        result.push(
          `<h4 class="text-base font-semibold mt-4 mb-2 text-foreground">${formatInlineMarkdown(
            line.slice(4)
          )}</h4>`
        );
        continue;
      }
      if (line.startsWith("## ")) {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        result.push(
          `<h3 class="text-lg font-semibold mt-5 mb-3 text-foreground">${formatInlineMarkdown(
            line.slice(3)
          )}</h3>`
        );
        continue;
      }
      if (line.startsWith("# ")) {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        result.push(
          `<h2 class="text-xl font-bold mt-6 mb-4 text-foreground">${formatInlineMarkdown(
            line.slice(2)
          )}</h2>`
        );
        continue;
      }

      // Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        if (!inList) {
          result.push('<ul class="list-disc ml-6 space-y-1 my-2">');
          inList = true;
        }
        let content = line.slice(2);
        // Apply inline formatting
        content = formatInlineMarkdown(content);
        result.push(
          `<li class="text-sm text-muted-foreground leading-relaxed">${content}</li>`
        );
        continue;
      }

      // Close list if we're in one and hit a non-list line
      if (inList && !line.startsWith("- ") && !line.startsWith("* ")) {
        result.push("</ul>");
        inList = false;
      }

      // Empty lines
      if (line.trim() === "") {
        result.push("<div class='h-2'></div>");
        continue;
      }

      // Regular paragraphs
      line = formatInlineMarkdown(line);
      result.push(`<p class="text-sm text-muted-foreground my-1">${line}</p>`);
    }

    // Close list if still open at end
    if (inList) {
      result.push("</ul>");
    }

    // Close code block if still open at end
    if (inCodeBlock) {
      result.push(
        `<pre class="bg-muted/50 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto"><code class="text-sm font-mono text-foreground block">${codeBlockContent
          .map((l) => escapeHtml(l))
          .join("\n")}</code></pre>`
      );
    }

    return result.join("");
  };

  const formatInlineMarkdown = (text: string): string => {
    // Auto-link URLs that are not already in markdown link syntax
    text = text.replace(
      /(?<!\]\()https?:\/\/[^\s<]+[^\s<.,;:!?"')]/g,
      (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium break-all">${url}</a>`;
      }
    );
    // Markdown links [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">$1</a>'
    );
    // Bold
    text = text.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="font-semibold text-foreground">$1</strong>'
    );
    // Inline code
    text = text.replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-muted/80 text-xs font-mono text-foreground whitespace-nowrap">$1</code>'
    );
    return text;
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: formatMarkdown(release.body),
                      }}
                    />
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
