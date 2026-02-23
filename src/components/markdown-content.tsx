"use client";

import { useState, useCallback, useRef, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const el = node as React.ReactElement<{ children?: ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

function extractLanguage(children: ReactNode): string | null {
  if (!children || typeof children !== "object") return null;
  const child = Array.isArray(children) ? children[0] : children;
  if (child && typeof child === "object" && "props" in child) {
    const el = child as React.ReactElement<{ className?: string }>;
    const match = el.props.className?.match(/language-(\S+)/);
    return match ? match[1] : null;
  }
  return null;
}

/** Extract table data from a rendered HTML table element */
function extractTableData(tableEl: HTMLTableElement): string[][] {
  const rows: string[][] = [];
  for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
    const cells: string[] = [];
    for (const cell of Array.from(tr.querySelectorAll("th, td"))) {
      cells.push((cell as HTMLElement).innerText.trim());
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** Convert table data to Markdown format */
function toMarkdown(data: string[][]): string {
  if (data.length === 0) return "";
  const header = data[0];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...data.slice(1).map((r) => (r[i] || "").length), 3)
  );
  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
  const lines: string[] = [];
  lines.push("| " + header.map((h, i) => pad(h, widths[i])).join(" | ") + " |");
  lines.push("| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |");
  for (const row of data.slice(1)) {
    lines.push("| " + row.map((c, i) => pad(c || "", widths[i])).join(" | ") + " |");
  }
  return lines.join("\n");
}

/** Convert table data to CSV format */
function toCsv(data: string[][]): string {
  return data
    .map((row) =>
      row.map((cell) => {
        if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(",")
    )
    .join("\n");
}

/** Convert table data to TSV (Excel-compatible) format */
function toTsv(data: string[][]): string {
  return data.map((row) => row.join("\t")).join("\n");
}

function CodeBlockWrapper({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const language = extractLanguage(children);

  const handleCopy = useCallback(() => {
    const text = extractText(children);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);

  return (
    <div className="relative group">
      {language && (
        <span className="absolute top-2 left-3 text-[10px] font-mono text-muted-foreground select-none">
          {language}
        </span>
      )}
      <pre className={`bg-muted/50 rounded-md p-3 overflow-x-auto text-xs ${language ? "pt-7" : ""}`}>
        {children}
      </pre>
      <Button
        variant="ghost"
        size="xs"
        onClick={handleCopy}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        aria-label={copied ? "Copied" : "Copy code"}
      >
        {copied ? (
          <>
            <Check className="size-3 text-green-500" />
            <span className="text-green-500">Copied!</span>
          </>
        ) : (
          <Copy className="size-3" />
        )}
      </Button>
    </div>
  );
}

type CopyFormat = "md" | "csv" | "tsv" | null;

function TableWrapper({ children }: { children: ReactNode }) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopy = useCallback((format: "md" | "csv" | "tsv") => {
    if (!tableRef.current) return;
    const data = extractTableData(tableRef.current);
    if (data.length === 0) return;

    let text: string;
    switch (format) {
      case "md": text = toMarkdown(data); break;
      case "csv": text = toCsv(data); break;
      case "tsv": text = toTsv(data); break;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedFormat(format);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedFormat(null), 1500);
    });
  }, []);

  return (
    <div className="relative group my-2">
      <div className="overflow-x-auto border rounded-lg">
        <table ref={tableRef} className="text-xs w-full">{children}</table>
      </div>
      <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => handleCopy("md")}
          className="text-muted-foreground h-6 px-1.5 text-[10px]"
          title="Copy as Markdown"
        >
          {copiedFormat === "md" ? <Check className="size-3 text-green-500" /> : <><FileText className="size-3 mr-0.5" />MD</>}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => handleCopy("csv")}
          className="text-muted-foreground h-6 px-1.5 text-[10px]"
          title="Copy as CSV"
        >
          {copiedFormat === "csv" ? <Check className="size-3 text-green-500" /> : <><Copy className="size-3 mr-0.5" />CSV</>}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => handleCopy("tsv")}
          className="text-muted-foreground h-6 px-1.5 text-[10px]"
          title="Copy as TSV (Excel)"
        >
          {copiedFormat === "tsv" ? <Check className="size-3 text-green-500" /> : <><FileSpreadsheet className="size-3 mr-0.5" />Excel</>}
        </Button>
      </div>
    </div>
  );
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-4 mb-2 border-b border-border pb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-3 mb-1.5">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold mt-2 mb-1 text-muted-foreground">{children}</h4>
          ),
          pre: ({ children }) => (
            <CodeBlockWrapper>{children}</CodeBlockWrapper>
          ),
          code: ({ children, className: cn }) => {
            const isInline = !cn;
            return isInline ? (
              <code className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            ) : (
              <code className={cn}>{children}</code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <TableWrapper>{children}</TableWrapper>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold bg-muted/50 border-b border-border whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 border-b border-border/50">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
