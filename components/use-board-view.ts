"use client";
import { useCallback, useSyncExternalStore } from "react";
import { boardViewSearch, parseBoardView, type BoardView } from "@/lib/board-view";

const CHANGE_EVENT = "boardviewchange";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const currentSearch = () => window.location.search;
// The server cannot see the URL's query string, so it renders the default board.
const serverSearch = () => "";

/** The URL is the source of truth, so a reload, a shared link and the back button all agree. */
export function useBoardView(): [BoardView, (view: BoardView) => void] {
  const search = useSyncExternalStore(subscribe, currentSearch, serverSearch);

  const setView = useCallback((view: BoardView) => {
    const next = boardViewSearch(view, window.location.search);
    window.history.pushState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [parseBoardView(search), setView];
}
