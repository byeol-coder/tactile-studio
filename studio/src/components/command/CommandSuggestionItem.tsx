import styles from './command.module.css';

interface Props {
  id: string;
  icon: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}

/** A single suggestion (listbox › option). Active state = colour + text. */
export function CommandSuggestionItem({ id, icon, label, active, onSelect, onHover }: Props) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      className={`${styles.item} ${active ? styles.itemActive : ''}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault() /* keep focus on input */}
      onClick={onSelect}
    >
      <span className={styles.itemIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.itemLabel}>{label}</span>
      {active && <span className={styles.selectedTag}>선택됨</span>}
    </li>
  );
}
