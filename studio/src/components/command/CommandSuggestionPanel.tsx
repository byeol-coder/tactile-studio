import styles from './command.module.css';
import { CATEGORIES } from '../../utils/commandRegistry';
import type { CommandDef } from '../../types/command';
import { CommandSuggestionItem } from './CommandSuggestionItem';

interface Props {
  suggestions: CommandDef[];
  activeIndex: number;
  onSelect: (cmd: CommandDef) => void;
  setActiveIndex: (i: number) => void;
}

/** The dropdown (Suggestion Panel). role=listbox, grouped by category. */
export function CommandSuggestionPanel({ suggestions, activeIndex, onSelect, setActiveIndex }: Props) {
  return (
    <div className={styles.panel} role="listbox" id="cmd-listbox" aria-label="추천 명령">
      <div className={styles.grid}>
        {CATEGORIES.map((cat) => {
          const items = suggestions
            .map((s, idx) => ({ s, idx }))
            .filter((x) => x.s.category === cat.key);
          if (items.length === 0) return null;
          return (
            <section className={styles.section} role="group" aria-labelledby={`grp-${cat.key}`} key={cat.key}>
              <div className={styles.sectionHead} id={`grp-${cat.key}`}>
                <span aria-hidden="true">{cat.icon}</span>
                {cat.label}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {items.map(({ s, idx }) => (
                  <CommandSuggestionItem
                    key={s.id}
                    id={`cmd-opt-${idx}`}
                    icon={s.icon}
                    label={s.label}
                    active={idx === activeIndex}
                    onSelect={() => onSelect(s)}
                    onHover={() => setActiveIndex(idx)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
