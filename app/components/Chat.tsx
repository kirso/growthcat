"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import Markdown from "react-markdown";

const SUGGESTED_PROMPTS = [
  "What would you do in your first week at RevenueCat?",
  "How would you handle webhook deduplication for agent-built apps?",
  "What growth experiments would you run for RevenueCat?",
  "What's wrong with RevenueCat's agent developer experience?",
  "How do you measure content success?",
];

export function Chat() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error } = useChat({
    transport,
    experimental_throttle: 50,
  });
  const isLoading = status === "streaming" || status === "submitted";
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for custom event to open chat from other components
  useEffect(() => {
    const handleOpen = () => setExpanded(true);
    window.addEventListener("openGrowthRatChat", handleOpen);
    return () => window.removeEventListener("openGrowthRatChat", handleOpen);
  }, []);

  // Listen for suggested-prompt clicks from landing page
  useEffect(() => {
    const handleSendFromPage = (e: Event) => {
      const prompt = (e as CustomEvent<string>).detail;
      if (prompt) handleSend(prompt);
    };
    window.addEventListener("growthRatSendMessage", handleSendFromPage);
    return () =>
      window.removeEventListener("growthRatSendMessage", handleSendFromPage);
  });

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text: text.trim() });
    setInputValue("");
  };

  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-3 px-5 py-3.5 bg-[var(--color-gc-primary)] text-white font-semibold rounded-full shadow-lg hover:bg-[var(--color-gc-primary-hover)] transition-all hover:scale-105"
        >
          <span className="text-xl">🐭</span>
          <span>Talk to GrowthRat</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--color-rc-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-rc-dark)] text-white">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🐭</span>
          <div>
            <div className="font-semibold text-sm">GrowthRat</div>
            <div className="text-xs text-white/60">RevenueCat AI Growth Advocate</div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-white/60 hover:text-white text-lg leading-none p-1"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="bg-[var(--color-rc-surface)] rounded-xl p-3.5">
              <p className="text-sm text-[var(--color-rc-body)]">
                Hi! I&apos;m GrowthRat — an autonomous developer advocacy and growth agent
                applying to be RevenueCat&apos;s first Agentic AI &amp; Growth Advocate.
              </p>
              <p className="text-sm text-[var(--color-rc-muted)] mt-2">
                Ask me anything about RevenueCat, agent development, growth strategy,
                or what I&apos;d do in this role.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-rc-muted)] uppercase tracking-wider">
                Try asking:
              </p>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-[var(--color-rc-border)] text-[var(--color-rc-body)] hover:bg-[var(--color-rc-surface)] hover:border-[var(--color-gc-primary)]/30 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[var(--color-gc-primary)] text-white"
                  : "bg-[var(--color-rc-surface)] text-[var(--color-rc-body)]"
              }`}
            >
              {m.role === "assistant" && (
                <span className="text-xs mr-1">🐭</span>
              )}
              {m.role === "assistant" ? (
                <Markdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      return isBlock ? (
                        <pre className="bg-black/5 rounded p-2 overflow-x-auto my-2 text-xs"><code>{children}</code></pre>
                      ) : (
                        <code className="bg-black/5 rounded px-1 py-0.5 text-xs">{children}</code>
                      );
                    },
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    a: ({ children, href }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-gc-primary)] underline">
                        {children}
                      </a>
                    ),
                    h1: ({ children }) => <h3 className="font-semibold text-sm mt-3 mb-1">{children}</h3>,
                    h2: ({ children }) => <h3 className="font-semibold text-sm mt-3 mb-1">{children}</h3>,
                    h3: ({ children }) => <h3 className="font-semibold text-sm mt-2 mb-1">{children}</h3>,
                  }}
                >
                  {m.parts
                    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                    .map((p) => p.text)
                    .join("") || ""}
                </Markdown>
              ) : (
                <span className="whitespace-pre-wrap">
                  {m.parts
                    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                    .map((p) => p.text)
                    .join("") || ""}
                </span>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-rc-surface)] rounded-xl px-3.5 py-2.5 text-sm">
              <span className="text-xs mr-1">🐭</span>
              <span className="text-[var(--color-rc-muted)]">Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-sm text-red-700">
            Connection error. Please try again.
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputValue);
        }}
        className="border-t border-[var(--color-rc-border)] p-3 flex gap-2"
      >
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask GrowthRat anything..."
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-rc-border)] focus:outline-none focus:border-[var(--color-gc-primary)] text-[var(--color-rc-body)] placeholder:text-[var(--color-rc-light)]"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="px-4 py-2 bg-[var(--color-gc-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-gc-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
