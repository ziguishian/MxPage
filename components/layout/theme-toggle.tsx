"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

import { Toaster } from "sonner";

import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "mxpage-theme";
const LEGACY_STORAGE_KEY = "banana-mall-theme";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}

function resolveTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const nextTheme = resolveTheme();
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setMounted(true);
    const observer = new MutationObserver(() => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const sync = () => applyTheme(resolveTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => { observer.disconnect(); media.removeEventListener("change", sync); window.removeEventListener("storage", sync); };
  }, []);

  const toggle = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try { window.localStorage.setItem(STORAGE_KEY, nextTheme); } catch {}
  };

  const currentTheme = mounted ? theme : "light";
  const isDark = currentTheme === "dark";

  return { theme: currentTheme, isDark, toggle };
}

export function ThemeToggle() {
  const { isDark, toggle } = useThemeMode();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-all duration-200",
        "border-border bg-card text-foreground shadow-sm hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={isDark ? "切换到白天风格" : "切换到黑夜风格"}
      title={isDark ? "切换到白天风格" : "切换到黑夜风格"}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border",
            isDark
              ? "border-border bg-secondary text-foreground"
              : "border-border bg-secondary text-foreground",
          )}
        >
          {isDark ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
        </span>
        <span className="text-left">
          <span className="block font-medium">{isDark ? "黑夜风格" : "白天风格"}</span>
          <span className="block text-xs text-muted-foreground">
            点击切换到{isDark ? "白天" : "黑夜"}界面
          </span>
        </span>
      </span>
      <span
        className={cn(
          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
          isDark ? "bg-secondary text-foreground" : "bg-slate-100 text-slate-600",
        )}
      >
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}

export function FloatingThemeToggle() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "group inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-sm shadow-lg backdrop-blur-xl transition-all duration-200",
        "border-border bg-card text-foreground hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={isDark ? "切换到白天风格" : "切换到黑夜风格"}
      title={isDark ? "切换到白天风格" : "切换到黑夜风格"}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
          isDark
            ? "border-border bg-secondary text-foreground"
            : "border-border bg-secondary text-foreground",
        )}
      >
        {isDark ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function ThemeToaster() {
  const { theme } = useThemeMode();
  return <Toaster theme={theme} richColors position="top-right" />;
}
