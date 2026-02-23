"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
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

export function MarkdownContent({
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
            <div className="overflow-x-auto">
              <table className="text-xs">{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
