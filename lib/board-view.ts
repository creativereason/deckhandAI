export type BoardView = "board" | "inbox";

const PARAM = "view";

/** Anything other than `?view=inbox` is the board, so a bad or stale link never shows a blank page. */
export function parseBoardView(search: string): BoardView {
  return new URLSearchParams(search).get(PARAM) === "inbox" ? "inbox" : "board";
}

/** The board is the default view, so its URL carries no parameter. Other parameters are kept. */
export function boardViewSearch(view: BoardView, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  if (view === "inbox") params.set(PARAM, "inbox");
  else params.delete(PARAM);
  const query = params.toString();
  return query ? `?${query}` : "";
}
