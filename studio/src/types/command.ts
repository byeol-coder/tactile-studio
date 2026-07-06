export type CommandInputMode = 'keyboard' | 'voice' | 'dotpad';

export type CommandLauncherStatus =
  | 'idle'
  | 'focused'
  | 'suggestionsOpen'
  | 'listening'
  | 'transcribing'
  | 'processing'
  | 'success'
  | 'error';

export type CommandCategory = 'convert' | 'create' | 'library' | 'dotpad' | 'help';

export type CommandIntentType = CommandCategory | 'unknown';

/** Resolved, dispatchable intent. In v0 this is produced by a mock parser. */
export interface CommandIntent {
  type: CommandIntentType;
  /** Machine action key, e.g. 'optimize', 'draw-circle', 'send', 'connect'. */
  action: string;
  /** Human-readable label for logs / toasts / TTS. */
  label: string;
  args?: Record<string, unknown>;
}

/** A registered command shown in the suggestion panel. */
export interface CommandDef {
  id: string;
  label: string;
  /** Glyph icon (paired with text — never icon-only). */
  icon: string;
  category: CommandCategory;
  /** Keywords the mock parser matches against free text / voice transcript. */
  keywords: string[];
  intent: CommandIntent;
}

export interface CommandCategoryMeta {
  key: CommandCategory;
  label: string;
  icon: string;
}
