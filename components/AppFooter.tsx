export default function AppFooter() {
  return (
    <footer className="pt-4 pb-2 text-center text-xs text-muted-foreground">
      DeckhandAI originally created by{" "}
      <a
        href="https://creativereason.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground underline transition-colors"
      >
        creativereason
      </a>
      {" · "}
      Fork on {" "}
      <a
        href="https://github.com/creativereason/deckhandAI"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground underline transition-colors"
      >
        GitHub
      </a>
      {" · "}
      <a
        href="https://github.com/creativereason/deckhandAI/blob/main/LICENSE"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground underline transition-colors"
      >
        MIT License
      </a>
    </footer>
  );
}
