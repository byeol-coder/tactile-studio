import type { CommandDef, CommandIntent } from '../types/command';
import { COMMANDS } from './commandRegistry';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Mock intent parser (v0).
 *
 * Matches free text / voice transcript against registry keywords and returns
 * the best command's intent, or an `unknown` intent when nothing matches.
 * Swap the body for a real NLU/LLM intent parser later — the `CommandIntent`
 * contract stays identical, so `dispatchIntent` does not change.
 */
export function parseCommand(text: string): { intent: CommandIntent; matched: CommandDef | null } {
  const q = norm(text);
  if (!q) return { intent: unknown(text), matched: null };

  let best: CommandDef | null = null;
  let bestScore = 0;
  for (const c of COMMANDS) {
    let score = 0;
    if (norm(c.label) === q) score = 100;
    else if (norm(c.label).includes(q) || q.includes(norm(c.label))) score = 60;
    for (const kw of c.keywords) {
      if (q.includes(norm(kw))) score = Math.max(score, 40 + kw.length);
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best ? { intent: best.intent, matched: best } : { intent: unknown(text), matched: null };
}

/** Filter suggestions by query (empty query returns everything). */
export function filterCommands(query: string): CommandDef[] {
  const q = norm(query);
  if (!q) return COMMANDS;
  return COMMANDS.filter(
    (c) => norm(c.label).includes(q) || c.keywords.some((k) => norm(k).includes(q) || q.includes(norm(k))),
  );
}

function unknown(text: string): CommandIntent {
  return { type: 'unknown', action: 'unknown', label: text.trim() || '알 수 없는 명령' };
}
