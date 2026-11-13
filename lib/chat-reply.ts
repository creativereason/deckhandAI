interface ReplyInput {
  /** The last text the model produced, possibly empty. */
  text: string;
  /** True when the tool loop ran out of steps instead of the model finishing. */
  hitRoundLimit: boolean;
  toolCalls: number;
}

const plural = (n: number) => `${n} action${n === 1 ? "" : "s"}`;

/**
 * The chat panel shows whatever this returns, so it must never be blank: an empty reply
 * after a half-finished batch looked like the bot had ignored the request.
 */
export function finalReply({ text, hitRoundLimit, toolCalls }: ReplyInput): string {
  if (hitRoundLimit) {
    const note = `I stopped early after ${plural(toolCalls)} because I hit my step limit. Some changes may already be saved. Ask me to continue and I'll pick up the rest.`;
    return text ? `${text}\n\n${note}` : note;
  }
  if (text) return text;
  if (toolCalls > 0) return `I ran ${plural(toolCalls)} but didn't get a summary back. Check the board to see the result.`;
  return "I got no reply from the model. Try again.";
}
