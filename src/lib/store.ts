"use client";

import { create } from "zustand";

interface TerminalState {
  selectedSymbol: string;
  activeView: "terminal" | "agents" | "analyst" | "signals" | "monitor" | "analysis" | "smartmoney" | "mft" | "positions" | "journal" | "news" | "market";
  setSelectedSymbol: (s: string) => void;
  setActiveView: (v: TerminalState["activeView"]) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  selectedSymbol: "EURUSD",
  activeView: "terminal",
  setSelectedSymbol: (s) => set({ selectedSymbol: s }),
  setActiveView: (v) => set({ activeView: v }),
}));
