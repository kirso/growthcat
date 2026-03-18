"use client";

import { useCallback, useRef, useState } from "react";

type Phase = "idle" | "thinking" | "retrieving" | "generating" | "complete";

interface Source {
  label: string;
  type: "doc" | "api" | "web" | "code";
}

const phaseLabels: Record<Phase, string> = {
  idle: "Idle",
  thinking: "Thinking...",
  retrieving: "Retrieving sources...",
  generating: "Generating...",
  complete: "Complete",
};

const phaseColors: Record<Phase, string> = {
  idle: "var(--color-op-dim)",
  thinking: "var(--color-op-amber)",
  retrieving: "var(--color-op-blue)",
  generating: "var(--color-op-green)",
  complete: "var(--color-op-green)",
};

const typeBadgeColors: Record<Source["type"], string> = {
  doc: "bg-[var(--color-op-blue)]/15 text-[var(--color-op-blue)]",
  api: "bg-[var(--color-op-green)]/15 text-[var(--color-op-green)]",
  web: "bg-[var(--color-op-amber)]/15 text-[var(--color-op-amber)]",
  code: "bg-purple-500/15 text-purple-400",
};

export default function PanelPage() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sources, setSources] = useState<Source[]>([]);
  const [output, setOutput] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [model, setModel] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startTimer = useCallback(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || phase === "generating" || phase === "thinking" || phase === "retrieving") return;

      // Reset state
      setSources([]);
      setOutput("");
      setElapsedMs(0);
      setModel("");
      setPhase("thinking");
      startTimer();

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(
        `/api/panel/session?prompt=${encodeURIComponent(prompt.trim())}`
      );
      eventSourceRef.current = es;

      es.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        if (data.step === "prompt_received") {
          setPhase("retrieving");
        } else if (data.step === "tools_available") {
          // Agent has tools ready
          setPhase("retrieving");
        } else if (data.step === "tool_call") {
          // Agent decided to call a tool — show it
          setSources((prev) => [...prev, {
            label: `→ ${data.toolName}(${JSON.stringify(data.args).slice(0, 60)})`,
            type: "api" as const,
          }]);
        } else if (data.step === "tool_result") {
          // Tool returned results — show it
          setSources((prev) => [...prev, {
            label: `✓ ${data.toolName}: ${typeof data.result === 'string' ? data.result.slice(0, 80) : JSON.stringify(data.result).slice(0, 80)}...`,
            type: "doc" as const,
          }]);
          setPhase("generating");
        } else if (data.step === "sources_retrieved") {
          setSources(data.sources?.map((s: { label: string; type: string }) => ({
            label: s.label,
            type: s.type === "doc" ? "doc" : s.type === "data" ? "api" : "web",
          })) ?? []);
          setPhase("generating");
        } else if (data.step === "reasoning") {
          // Could show reasoning text
        }
      });

      es.addEventListener("stream", (e) => {
        const data = JSON.parse(e.data);
        if (data.token) {
          setOutput((prev) => prev + data.token);
        }
      });

      es.addEventListener("done", () => {
        setPhase("complete");
        stopTimer();
        es.close();
      });

      es.onerror = () => {
        setPhase("complete");
        setOutput((prev) => prev ? prev + "\n\n[Connection error]" : "[Connection error]");
        stopTimer();
        es.close();
      };
    },
    [prompt, phase, startTimer, stopTimer]
  );

  const formatElapsed = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${secs}.${tenths}s`;
  };

  return (
    <div className="flex flex-col h-full max-w-7xl">
      <h1 className="text-xl font-semibold text-[var(--color-op-text)] mb-4">
        Panel Console
      </h1>

      {/* Prompt bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a prompt for the panel session..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] text-[var(--color-op-text)] text-base placeholder:text-[var(--color-op-dim)] focus:outline-none focus:border-[var(--color-op-green)] transition-colors"
        />
        <button
          type="submit"
          disabled={
            !prompt.trim() ||
            phase === "thinking" ||
            phase === "retrieving" ||
            phase === "generating"
          }
          className="px-5 py-2.5 rounded-lg bg-[var(--color-op-green)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          Submit
        </button>
      </form>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: phaseColors[phase] }}
          />
          <span style={{ color: phaseColors[phase] }}>
            {phaseLabels[phase]}
          </span>
        </div>
        {elapsedMs > 0 && (
          <span className="font-mono text-xs text-[var(--color-op-muted)]">
            {formatElapsed(elapsedMs)}
          </span>
        )}
        {model && (
          <span className="ml-auto px-2 py-0.5 rounded text-xs bg-[var(--color-op-card-alt)] text-[var(--color-op-dim)] font-mono">
            {model}
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 min-h-0">
        {/* Left: Sources */}
        <div className="rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-[var(--color-op-border)] text-xs font-medium text-[var(--color-op-dim)] uppercase tracking-wider">
            Sources ({sources.length})
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sources.length === 0 && phase === "idle" && (
              <p className="text-sm text-[var(--color-op-dim)] px-1 py-4 text-center">
                Sources will appear here after retrieval.
              </p>
            )}
            {sources.length === 0 &&
              (phase === "thinking" || phase === "retrieving") && (
                <p className="text-sm text-[var(--color-op-muted)] px-1 py-4 text-center">
                  Retrieving...
                </p>
              )}
            {sources.map((source, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded bg-[var(--color-op-card-alt)] border border-[var(--color-op-border)]"
              >
                <span className="text-sm text-[var(--color-op-text)] truncate mr-2">
                  {source.label}
                </span>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${typeBadgeColors[source.type]}`}
                >
                  {source.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Output stream */}
        <div className="rounded-lg bg-[var(--color-op-card)] border border-[var(--color-op-border)] flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-[var(--color-op-border)] text-xs font-medium text-[var(--color-op-dim)] uppercase tracking-wider">
            Output
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {phase === "idle" && !output && (
              <p className="text-[var(--color-op-dim)] text-base">
                Enter a prompt to begin.
              </p>
            )}
            {output && (
              <div className="text-base leading-relaxed text-[var(--color-op-text)] whitespace-pre-wrap font-mono text-sm">
                {output}
                {phase === "generating" && (
                  <span className="cursor-blink text-[var(--color-op-green)]">
                    |
                  </span>
                )}
              </div>
            )}
            {!output &&
              phase !== "idle" &&
              phase !== "complete" && (
                <p className="text-[var(--color-op-muted)] text-sm">
                  Waiting for output...
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
