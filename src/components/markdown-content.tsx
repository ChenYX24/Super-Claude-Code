"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          pre: ({ children }) => (
            <pre className="bg-muted/50 rounded-md p-3 overflow-x-auto text-xs">
              {children}
            </pre>
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
