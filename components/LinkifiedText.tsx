import { linkify } from "@/lib/linkify";

export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        part.type === "link" ? (
          <a key={i} href={part.href} target="_blank" rel="noreferrer" className="break-all text-primary underline hover:opacity-75">
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
