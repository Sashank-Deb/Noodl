"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { getSettings, setSettings as persist } from "@/lib/db";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, ready: false, update: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setState] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    getSettings()
      .then((s) => {
        setState(s);
        setTheme(s.theme);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [setTheme]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        void persist(next);
        return next;
      });
      if (patch.theme) setTheme(patch.theme);
    },
    [setTheme],
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
