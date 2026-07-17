"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Cpu,
  Shield,
  Bell,
  Monitor,
  Loader2,
  Save,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsMap = Record<string, string>;

interface SectionDef {
  id: string;
  title: string;
  icon: typeof Cpu;
  keys: string[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "ai",
    title: "AI Provider",
    icon: Cpu,
    keys: ["ai.provider", "ai.model"],
  },
  {
    id: "risk",
    title: "Risk Management",
    icon: Shield,
    keys: ["risk.maxPerTrade", "risk.maxDaily", "risk.accountBalance"],
  },
  {
    id: "alerts",
    title: "Alerts",
    icon: Bell,
    keys: ["alerts.enabled", "alerts.minConfidence"],
  },
  {
    id: "display",
    title: "Display",
    icon: Monitor,
    keys: ["ui.refreshInterval", "ui.defaultTimeframe"],
  },
];

// Keys whose values are booleans, rendered as Switch components.
const BOOLEAN_KEYS = new Set<string>(["alerts.enabled", "alerts.sound", "news.autoRefresh"]);
// Keys whose values are numbers, rendered as numeric inputs.
const NUMBER_KEYS = new Set<string>([
  "risk.maxPerTrade",
  "risk.maxDaily",
  "risk.accountBalance",
  "ui.refreshInterval",
  "alerts.minConfidence",
]);

function prettyLabel(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1];
  return last
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function isBoolean(key: string): boolean {
  return BOOLEAN_KEYS.has(key);
}

function isNumber(key: string): boolean {
  return NUMBER_KEYS.has(key);
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [original, setOriginal] = useState<SettingsMap>({});
  const [draft, setDraft] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { settings: SettingsMap };
      setOriginal(data.settings ?? {});
      setDraft(data.settings ?? {});
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open, fetchSettings]);

  const handleChange = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const dirtyKeys = Object.keys(draft).filter(
    (k) => (original[k] ?? "") !== (draft[k] ?? "")
  );
  const isDirty = dirtyKeys.length > 0;

  const save = async () => {
    if (!isDirty) {
      toast("No changes to save");
      return;
    }
    const changed: SettingsMap = {};
    for (const k of dirtyKeys) changed[k] = draft[k] ?? "";
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changed }),
      });
      if (!res.ok) throw new Error("Failed");
      setOriginal({ ...original, ...changed });
      toast.success(`Saved ${Object.keys(changed).length} setting(s)`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      });
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tt-glass-strong border-white/10 max-h-[88vh] flex flex-col gap-0 p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-white/5 space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-400" />
            <DialogTitle className="text-sm font-semibold">Terminal Settings</DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-slate-500">
            Configure AI provider, risk limits, alerts, and display preferences.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto tt-scroll p-4 space-y-5">
          {loading ? (
            <div className="space-y-5">
              {SECTIONS.map((section) => (
                <div key={section.id}>
                  <Skeleton className="h-3 w-32 mb-2" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {section.keys.map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Skeleton className="h-2.5 w-20" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.id}>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Icon className="w-3.5 h-3.5 text-emerald-400" />
                    <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      {section.title}
                    </h3>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {section.keys.map((key) => {
                      const bool = isBoolean(key);
                      const num = isNumber(key);
                      const value = draft[key] ?? "";
                      return (
                        <div
                          key={key}
                          className={`rounded-lg border border-white/5 bg-black/20 p-2.5 ${
                            bool ? "flex items-center justify-between gap-3" : "space-y-1.5"
                          }`}
                        >
                          {bool ? (
                            <>
                              <Label
                                htmlFor={key}
                                className="text-[11px] font-medium text-slate-300 flex flex-col gap-0.5"
                              >
                                <span>{prettyLabel(key)}</span>
                                <span className="tt-mono text-[9px] text-slate-500 font-normal">
                                  {key}
                                </span>
                              </Label>
                              <Switch
                                id={key}
                                checked={value === "true"}
                                onCheckedChange={(checked) =>
                                  handleChange(key, checked ? "true" : "false")
                                }
                              />
                            </>
                          ) : (
                            <>
                              <Label
                                htmlFor={key}
                                className="text-[10px] uppercase tracking-wider text-slate-500"
                              >
                                {prettyLabel(key)}
                              </Label>
                              <Input
                                id={key}
                                type={num ? "number" : "text"}
                                inputMode={num ? "decimal" : undefined}
                                value={value}
                                onChange={(e) => handleChange(key, e.target.value)}
                                className="h-8 bg-black/40 border-white/10 text-xs tt-mono"
                              />
                              <div className="tt-mono text-[9px] text-slate-600 truncate">
                                {key}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-white/5 flex-row items-center justify-between sm:justify-between">
          <div className="text-[10px] text-slate-500">
            {isDirty ? (
              <span className="text-amber-400">
                {dirtyKeys.length} unsaved change{dirtyKeys.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-8 text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={!isDirty || saving}
              className="h-8 text-xs gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
