import { useEffect, useRef } from 'react';
import styles from './product.module.css';
import { Icon } from '../ui/Icon';
import type { useProductMenu } from '../../hooks/useProductMenu';

type Menu = ReturnType<typeof useProductMenu>;

/** Product dropdown (role=menu). Sections + items + shortcut badges + version footer. */
export function ProductDropdownMenu({ menu }: { menu: Menu }) {
  const { sections, items, activeIndex, setActiveIndex, run, closeMenu, move } = menu;
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving focus follows the active index.
  useEffect(() => {
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(items.length - 1);
    }
  };

  let flatIdx = -1;
  return (
    <div className={styles.menu} role="menu" aria-label="Tactile Studio 메뉴" onKeyDown={onKeyDown}>
      {sections.map((sec, si) => (
        <div key={sec.key} role="group" aria-label={sec.label}>
          {si > 0 && <div className={styles.divider} role="separator" />}
          <div className={styles.sectionLabel}>{sec.label}</div>
          {sec.items.map((it) => {
            flatIdx += 1;
            const idx = flatIdx;
            return (
              <button
                key={it.action}
                ref={(el) => (itemRefs.current[idx] = el)}
                type="button"
                role="menuitem"
                tabIndex={idx === activeIndex ? 0 : -1}
                className={`${styles.item} ${idx === activeIndex ? styles.itemActive : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => run(it.action)}
              >
                <Icon name={it.icon} size={18} className={styles.itemIcon} />
                <span className={styles.itemLabel}>{it.label}</span>
                {it.shortcut && <span className={styles.shortcut}>{it.shortcut}</span>}
              </button>
            );
          })}
        </div>
      ))}
      <div className={styles.divider} role="separator" />
      <div className={styles.footer}>
        <Icon name="dotpad" size={18} className={styles.logo} />
        <span className={styles.footerName}>Tactile Studio</span>
        <span className={styles.versionBadge}>v0.1.0</span>
      </div>
    </div>
  );
}
