export type BoardView = "board" | "inbox" | "today";

const PARAM = "view";

/** Anything other than `?view=inbox` or `?view=today` is the board, so a bad or stale link never shows a blank page. */
export function parseBoardView(search: string): BoardView {
  const value = new URLSearchParams(search).get(PARAM);
  return value === "inbox" || value === "today" ? value : "board";
}

/** The board is the default view, so its URL carries no parameter. Other parameters are kept. */
export function boardViewSearch(view: BoardView, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  if (view === "board") params.delete(PARAM);
  else params.set(PARAM, view);
  const query = params.toString();
  return query ? `?${query}` : "";
}
