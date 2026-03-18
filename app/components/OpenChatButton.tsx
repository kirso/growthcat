"use client";

export function OpenChatButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={() =>
        window.dispatchEvent(new CustomEvent("openGrowthRatChat"))
      }
      className={className}
    >
      {children}
    </button>
  );
}

export function SuggestedPrompt({ prompt }: { prompt: string }) {
  return (
    <button
      onClick={() => {
        window.dispatchEvent(new CustomEvent("openGrowthRatChat"));
        // Small delay so the chat opens before we see it
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("growthRatSendMessage", { detail: prompt })
          );
        }, 300);
      }}
      className="group flex items-center gap-3 text-left text-sm px-4 py-3 rounded-lg border border-[var(--color-rc-border)] text-[var(--color-rc-body)] hover:bg-[var(--color-gc-primary)]/5 hover:border-[var(--color-gc-primary)]/30 transition-colors"
    >
      <span className="text-[var(--color-rc-muted)] group-hover:text-[var(--color-gc-primary)] transition-colors">&rarr;</span>
      <span>&ldquo;{prompt}&rdquo;</span>
    </button>
  );
}
