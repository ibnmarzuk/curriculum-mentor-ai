import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export function MarkdownView({ children }: { children: string }) {
  return (
    <div className="prose-mentor">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = String(children).includes("\n") || match;
            if (isBlock) {
              return (
                <SyntaxHighlighter
                  language={match?.[1] ?? "text"}
                  style={vscDarkPlus as any}
                  PreTag="div"
                  customStyle={{ margin: 0, background: "transparent", padding: 0 }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
