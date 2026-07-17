"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Newspaper, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function BriefingPanel() {
  const [briefing, setBriefing] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/briefing", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { briefing: string };
      setBriefing(data.briefing ?? "");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-sm font-semibold">Market Briefing</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              AI-generated · live snapshot
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchBriefing}
          disabled={loading}
          className="h-7 px-2 text-[11px] gap-1.5"
          title="Refresh briefing"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto tt-scroll p-4 min-h-0">
        {loading && !briefing ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-10/12" />
            <div className="pt-2 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-9/12" />
            </div>
            <div className="pt-2 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-10/12" />
              <Skeleton className="h-3 w-8/12" />
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <div className="w-11 h-11 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm text-slate-200 mb-1">Couldn&apos;t load briefing</p>
            <p className="text-[11px] text-slate-500 mb-4 max-w-[260px]">
              The AI briefing service is temporarily unavailable.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchBriefing}
              className="h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </div>
        ) : (
          <article className="prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-base font-bold text-slate-100 mb-2 mt-1 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm font-semibold text-emerald-300 mt-4 mb-1.5 flex items-center gap-2">
                    <span className="w-1 h-3 bg-emerald-400 rounded-sm" />
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mt-3 mb-1">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="space-y-1 mb-2 ml-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="space-y-1 mb-2 ml-1 list-decimal list-inside">
                    {children}
                  </ol>
                ),
                li: ({ children }) => {
                  // Detect leading bold (**text**: ...) and colorize the label.
                  return (
                    <li className="text-xs text-slate-300 leading-relaxed flex gap-1.5 before:content-['▸'] before:text-emerald-400">
                      <span>{children}</span>
                    </li>
                  );
                },
                strong: ({ children }) => (
                  <strong className="text-slate-100 font-semibold">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="text-amber-300/90 not-italic font-medium">
                    {children}
                  </em>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-emerald-500/40 pl-3 py-1 my-3 bg-emerald-500/[0.05] rounded-r text-xs text-slate-300">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="tt-mono text-[11px] px-1 py-0.5 rounded bg-black/40 text-emerald-300 border border-white/5">
                    {children}
                  </code>
                ),
                hr: () => (
                  <hr className="my-4 border-white/5" />
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto tt-scroll my-3">
                    <table className="w-full text-[11px] border border-white/10 rounded">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-2 py-1 text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10 bg-white/5">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-2 py-1 text-slate-300 border-b border-white/5 tt-mono">
                    {children}
                  </td>
                ),
              }}
            >
              {briefing || "_No briefing available._"}
            </ReactMarkdown>
          </article>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 text-[10px] text-slate-500">
        <span className="uppercase tracking-wider">AI Briefing</span>
        {loading && <span className="flex items-center gap-1 text-emerald-400">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Updating…
        </span>}
      </div>
    </div>
  );
}
