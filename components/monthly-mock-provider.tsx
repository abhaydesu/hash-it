"use client";
import React from 'react';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface MonthlyMockProblem {
  id: string;
  entryId?: string;
  title: string;
  number: number | null;
  url: string;
  platform: string;
  patternName: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
}

export interface MonthlyMockAttempt {
  problemId: string;
  status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
  minutes: number;
}

export type MonthlyMockPhase = "idle" | "running" | "paused" | "finished";

interface PersistedSession {
  problems: MonthlyMockProblem[];
  currentIndex: number;
  phase: MonthlyMockPhase;
  accumulatedMs: number;
  runningSince: number | null;
  results: Record<string, MonthlyMockAttempt>;
  problemMinutes: string;
}

interface MonthlyMockContextValue {
  phase: MonthlyMockPhase;
  problems: MonthlyMockProblem[];
  currentIndex: number;
  results: Record<string, MonthlyMockAttempt>;
  problemMinutes: string;
  elapsedSeconds: number;
  isActive: boolean;
  startSession: (problems: MonthlyMockProblem[]) => void;
  pause: () => void;
  resume: () => void;
  discard: () => void;
  resetToIdle: () => void;
  setProblemMinutes: (value: string) => void;
  advanceAfterRecord: (problemId: string, attempt: MonthlyMockAttempt) => void;
  setCurrentIndex: (index: number) => void;
}

const STORAGE_KEY = "hash-it:monthly-mock-v1";

const MonthlyMockContext = createContext<MonthlyMockContextValue | null>(null);

function readStored(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.problems?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(session: PersistedSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (!session || session.phase === "idle") {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

function computeElapsedMs(session: PersistedSession | null, now: number): number {
  if (!session || session.phase === "idle") return 0;
  let ms = session.accumulatedMs;
  if (session.phase === "running" && session.runningSince != null) {
    ms += Math.max(0, now - session.runningSince);
  }
  return ms;
}

export function formatMockClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function MonthlyMockProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PersistedSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const stored = readStored();
    if (stored && (stored.phase === "running" || stored.phase === "paused" || stored.phase === "finished")) {
      setSession(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(session);
  }, [session, hydrated]);

  const isRunning = session?.phase === "running";
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const startSession = useCallback((problems: MonthlyMockProblem[]) => {
    const startedAt = Date.now();
    setNow(startedAt);
    setSession({
      problems,
      currentIndex: 0,
      phase: "running",
      accumulatedMs: 0,
      runningSince: startedAt,
      results: {},
      problemMinutes: "",
    });
  }, []);

  const pause = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.phase !== "running") return prev;
      const stamp = Date.now();
      const accrued =
        prev.accumulatedMs + (prev.runningSince != null ? Math.max(0, stamp - prev.runningSince) : 0);
      setNow(stamp);
      return {
        ...prev,
        phase: "paused",
        accumulatedMs: accrued,
        runningSince: null,
      };
    });
  }, []);

  const resume = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.phase !== "paused") return prev;
      const stamp = Date.now();
      setNow(stamp);
      return {
        ...prev,
        phase: "running",
        runningSince: stamp,
      };
    });
  }, []);

  const discard = useCallback(() => {
    setSession(null);
    writeStored(null);
  }, []);

  const resetToIdle = useCallback(() => {
    setSession(null);
    writeStored(null);
  }, []);

  const setProblemMinutes = useCallback((value: string) => {
    setSession((prev) => (prev ? { ...prev, problemMinutes: value } : prev));
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    setSession((prev) => (prev ? { ...prev, currentIndex: index } : prev));
  }, []);

  const advanceAfterRecord = useCallback((problemId: string, attempt: MonthlyMockAttempt) => {
    setSession((prev) => {
      if (!prev) return prev;
      const results = { ...prev.results, [problemId]: attempt };
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.problems.length) {
        const stamp = Date.now();
        const accrued =
          prev.accumulatedMs +
          (prev.phase === "running" && prev.runningSince != null
            ? Math.max(0, stamp - prev.runningSince)
            : 0);
        setNow(stamp);
        return {
          ...prev,
          results,
          problemMinutes: "",
          phase: "finished",
          accumulatedMs: accrued,
          runningSince: null,
        };
      }
      return {
        ...prev,
        results,
        problemMinutes: "",
        currentIndex: nextIndex,
      };
    });
  }, []);

  const elapsedSeconds = Math.floor(computeElapsedMs(session, now) / 1000);
  const phase = session?.phase ?? "idle";
  const isActive = phase === "running" || phase === "paused";

  const value = useMemo<MonthlyMockContextValue>(
    () => ({
      phase,
      problems: session?.problems ?? [],
      currentIndex: session?.currentIndex ?? 0,
      results: session?.results ?? {},
      problemMinutes: session?.problemMinutes ?? "",
      elapsedSeconds,
      isActive,
      startSession,
      pause,
      resume,
      discard,
      resetToIdle,
      setProblemMinutes,
      advanceAfterRecord,
      setCurrentIndex,
    }),
    [
      phase,
      session,
      elapsedSeconds,
      isActive,
      startSession,
      pause,
      resume,
      discard,
      resetToIdle,
      setProblemMinutes,
      advanceAfterRecord,
      setCurrentIndex,
    ]
  );

  return <MonthlyMockContext.Provider value={value}>{children}</MonthlyMockContext.Provider>;
}

export function useMonthlyMock() {
  const ctx = useContext(MonthlyMockContext);
  if (!ctx) {
    throw new Error("useMonthlyMock must be used within MonthlyMockProvider");
  }
  return ctx;
}
