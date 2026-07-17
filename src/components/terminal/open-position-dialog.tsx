"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { Loader2 } from "lucide-react";

interface OpenPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    symbol: string;
    side: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
    rationale: string;
  } | null;
  digits: number;
  onCreated: () => void;
}

export function OpenPositionDialog({
  open,
  onOpenChange,
  data,
  digits,
  onCreated,
}: OpenPositionDialogProps) {
  const [size, setSize] = useState("0.10");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setStopLoss(data.stopLoss ? formatPrice(data.stopLoss, digits) : "");
      setTakeProfit(data.takeProfit ? formatPrice(data.takeProfit, digits) : "");
    }
  }, [data, digits]);

  if (!data) return null;

  const isLong = data.side === "long";

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: data.symbol,
          side: data.side,
          entryPrice: data.entryPrice,
          size: parseFloat(size),
          stopLoss: stopLoss ? parseFloat(stopLoss) : null,
          takeProfit: takeProfit ? parseFloat(takeProfit) : null,
          confidence: data.confidence,
          rationale: data.rationale,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`${isLong ? "Long" : "Short"} position opened on ${data.symbol}`);
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Failed to open position");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tt-glass-strong border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Open {isLong ? "Long" : "Short"} Position
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                isLong ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              {data.symbol}
            </span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            AI confidence: {data.confidence}% · Review the trade setup before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">Entry Price</Label>
              <div className="px-3 py-2 rounded-md bg-black/30 border border-white/10 text-sm tt-mono">
                {formatPrice(data.entryPrice, digits)}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">Size (lots)</Label>
              <Input
                type="number"
                step="0.01"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="bg-black/30 border-white/10 tt-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">Stop Loss</Label>
              <Input
                type="number"
                step={Math.pow(10, -digits)}
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-black/30 border-white/10 tt-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">Take Profit</Label>
              <Input
                type="number"
                step={Math.pow(10, -digits)}
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="bg-black/30 border-white/10 tt-mono"
              />
            </div>
          </div>
          {data.rationale && (
            <div className="rounded-md bg-black/20 border border-white/5 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">AI Rationale</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{data.rationale}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={loading || !size}
            className={isLong ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Confirm {isLong ? "Long" : "Short"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
