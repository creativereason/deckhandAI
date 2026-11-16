// The questions the app asks the assistant on the user's behalf. Each states a length limit as a number,
// because "give me the strongest reasons" produced essays; a bounded shape keeps triage fast to read.
interface JobRef { company: string; role: string }

export const pursuePrompt = ({ company, role }: JobRef) =>
  `Should I pursue the ${role} role at ${company}? Reply in exactly this shape and add nothing else:\nFor: up to 3 bullets, 10 words each.\nAgainst: up to 3 bullets, 10 words each.\nVerdict: one sentence.`;

export const aboutJobPrompt = ({ company, role }: JobRef) =>
  `Tell me about the ${role} role at ${company} in under 80 words: how well it fits, the biggest red flag, and the next step.`;

export const historyPrompt = ({ company, role }: JobRef) =>
  `Have I applied to anything at ${company} before? Check my whole board, including passed jobs. Answer in 2 sentences: what I did before, and whether the ${role} role is worth another look.`;
