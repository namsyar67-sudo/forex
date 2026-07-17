"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const SUGGESTIONS = [
  "What are the top 3 trading opportunities right now?",
  "Analyze EURUSD",
  "Which instruments have the strongest trends?",
  "What's the market sentiment today?",
];

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch {
      toast.error("AI chat failed");
      setMessages([...newMessages, { role: "assistant", content: "I couldn't reach the analysis engine. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tt-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-white/5">
        <div className="relative">
          <Bot className="w-4 h-4 text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 tt-pulse-dot" />
        </div>
        <div>
          <span className="text-sm font-semibold">AI Co-Pilot</span>
          <span className="text-[10px] text-slate-500 ml-1.5">· grounded in live data</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto tt-scroll p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300 mb-1">Ask the AI Co-Pilot</p>
            <p className="text-[11px] text-slate-500 mb-4 max-w-[220px]">
              Grounded in your terminal's live market data and quant signals.
            </p>
            <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-[11px] text-slate-400 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                m.role === "user"
                  ? "bg-slate-700"
                  : "bg-emerald-500/15 border border-emerald-500/30"
              }`}
            >
              {m.role === "user" ? (
                <User className="w-3 h-3 text-slate-300" />
              ) : (
                <Bot className="w-3 h-3 text-emerald-400" />
              )}
            </div>
            <div
              className={`rounded-lg px-3 py-2 max-w-[85%] ${
                m.role === "user"
                  ? "bg-white/10 text-slate-200"
                  : "bg-black/30 border border-white/5 text-slate-200"
              }`}
            >
              <div className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Bot className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="rounded-lg px-3 py-2 bg-black/30 border border-white/5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-white/5">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about the market…"
            className="min-h-[36px] max-h-[80px] resize-none bg-black/30 border-white/10 text-xs"
            rows={1}
          />
          <Button
            size="sm"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="h-9 px-2.5"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
