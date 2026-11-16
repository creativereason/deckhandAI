"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Home, Inbox, KanbanSquare, LogOut, MoreHorizontal, Moon, Radar, Settings, Sun } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/shell/BrandMark";
import ChatDrawer, { type AssistantRequest } from "@/components/ChatDrawer";
import AppFooter from "@/components/AppFooter";
import { AskAIButton } from "@/components/ai/ai";
import { BottomNav, NavRail, type NavItemSpec } from "@/components/ui/nav";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

import { useBoardView } from "@/components/use-board-view";
import type { BoardView } from "@/lib/board-view";
import { useMediaQuery } from "@/components/shell/use-media-query";
import { AssistantContext, JOBS_CHANGED_EVENT, type AssistantApi } from "@/components/shell/assistant-context";

const OPEN_KEY = "assistant-open";

function usePendingCount(): number {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    fetch("/api/jobs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { pending?: unknown[] } | null) => setCount(d?.pending?.length ?? 0))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(JOBS_CHANGED_EVENT, load);
    return () => window.removeEventListener(JOBS_CHANGED_EVENT, load);
  }, [load]);
  return count;
}

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* private mode */ }
  };
  return [dark, toggle];
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

/**
 * The frame around every signed-in screen: nav rail (tablet+) or bottom bar (phones), a slim top bar,
 * the page, and ONE assistant that docks on wide screens and slides over on narrow ones.
 */
export default function AppShell({ children, width = "content" }: { children: React.ReactNode; width?: "content" | "prose" }) {
  const pathname = usePathname();
  const [view, setView] = useBoardView();
  const pending = usePendingCount();
  const [dark, toggleTheme] = useTheme();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<AssistantRequest | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(OPEN_KEY); } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(stored ? stored === "true" : typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1280px)").matches);
  }, []);

  const setOpenPersisted = useCallback((next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, String(next)); } catch { /* private mode */ }
  }, []);

  const api = useMemo<AssistantApi>(() => ({
    open,
    close: () => setOpenPersisted(false),
    ask: (text, options) => {
      setOpenPersisted(true);
      if (text) setRequest({ id: Date.now(), text, send: !!options?.send });
    },
  }), [open, setOpenPersisted]);

  const onBoard = pathname === "/";
  // On the board page the views swap in place (URL stays the source of truth); from other pages these are plain links.
  const select = (v: BoardView) => (onBoard ? () => setView(v) : undefined);
  const items: NavItemSpec[] = [
    { href: "/?view=today", label: "Today", icon: <Home aria-hidden />, active: onBoard && view === "today", onSelect: select("today") },
    { href: "/", label: "Board", icon: <KanbanSquare aria-hidden />, active: (onBoard && view === "board") || pathname.startsWith("/job"), onSelect: select("board") },
    { href: "/?view=inbox", label: "Inbox", icon: <Inbox aria-hidden />, badge: pending, active: onBoard && view === "inbox", onSelect: select("inbox") },
    { href: "/settings", label: "Settings", icon: <Settings aria-hidden />, active: pathname.startsWith("/settings") || pathname.startsWith("/scrape-sources") },
  ];

  const chat = (
    <ChatDrawer
      onJobsChanged={() => window.dispatchEvent(new Event(JOBS_CHANGED_EVENT))}
      onClose={() => setOpenPersisted(false)}
      request={request}
    />
  );

  return (
    <AssistantContext.Provider value={api}>
      <a href="#main" className="sr-only z-(--z-toast) rounded-md bg-card px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
      <div className="min-h-dvh bg-background">
        <aside className="fixed inset-y-0 left-0 z-(--z-nav) hidden w-(--spacing-rail) flex-col items-center gap-4 border-r border-border bg-card px-2 py-4 md:flex">
          <Link href="/" aria-label="DeckhandAI home" className="rounded-md p-1"><BrandMark size={40} /></Link>
          <NavRail items={items} className="w-full" />
        </aside>

        <div className="flex min-h-dvh md:pl-(--spacing-rail)">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-(--z-sticky) flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
              <Link href="/" className="flex items-center gap-2 text-base font-semibold md:invisible" aria-label="DeckhandAI home">
                <BrandMark size={32} className="md:hidden" />
                <BrandWordmark className="md:hidden" />
              </Link>
              <div className="flex items-center gap-2">
                <AskAIButton aria-expanded={open} aria-controls="assistant-panel" onClick={() => setOpenPersisted(!open)}>
                  <span className="sr-only sm:not-sr-only">{open ? "Hide Deckhand" : "Ask Deckhand"}</span>
                </AskAIButton>
                <Menu>
                  <MenuTrigger render={<IconButton label="Account and tools" variant="outline" />}><MoreHorizontal aria-hidden /></MenuTrigger>
                  <MenuContent>
                    <MenuItem render={<Link href="/scrape-sources" />}><Radar aria-hidden />Scraper coverage</MenuItem>
                    <MenuItem render={<Link href="/settings" />}><Settings aria-hidden />Settings</MenuItem>
                    <MenuItem onClick={toggleTheme}>{dark ? <Sun aria-hidden /> : <Moon aria-hidden />}{dark ? "Light theme" : "Dark theme"}</MenuItem>
                    <MenuItem onClick={signOut}><LogOut aria-hidden />Sign out</MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            </header>
            <main id="main" tabIndex={-1} className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 pb-24 outline-none sm:px-6 md:pb-8 ${width === "prose" ? "max-w-(--container-prose)" : "max-w-(--container-content)"}`}>
              {children}
            </main>
            <div className="pb-16 md:pb-0"><AppFooter /></div>
          </div>

          {wide && open && (
            <aside id="assistant-panel" aria-label="Deckhand assistant" className="sticky top-0 h-dvh w-(--spacing-panel) shrink-0 border-l border-border p-3">
              {chat}
            </aside>
          )}
        </div>

        <BottomNav items={items} className="fixed inset-x-0 bottom-0 z-(--z-nav) md:hidden" />

        {!wide && (
          <DialogPrimitive.Root open={open} onOpenChange={(o) => setOpenPersisted(o)}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Backdrop className="fixed inset-0 z-(--z-overlay) bg-overlay" />
              <DialogPrimitive.Popup id="assistant-panel" aria-label="Deckhand assistant" className="fixed inset-y-0 right-0 z-(--z-overlay) w-full max-w-md p-2 outline-none transition-transform duration-(--duration-slow) ease-(--ease-standard) data-ending-style:translate-x-full data-starting-style:translate-x-full">
                {chat}
              </DialogPrimitive.Popup>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        )}
      </div>
    </AssistantContext.Provider>
  );
}
