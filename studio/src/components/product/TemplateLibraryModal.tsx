import { useEffect, useRef } from 'react';
import { useAppStore } from '../../app/appState';
import { A11Y } from '../../i18n/messages';
import {
  templatesForGroup,
  type TactileTemplateDefinition,
  type TemplateGroupKey,
} from '../../templates/catalog';
import styles from './TemplateLibraryModal.module.css';

const GROUPS: TemplateGroupKey[] = [
  'recommended',
  'education',
  'diagram',
  'primitive',
  'image-conversion',
  'heritage',
];

interface Props {
  onSelect: (template: TactileTemplateDefinition) => void;
  onClose: () => void;
}

/**
 * Lightweight, accessible Starter Template picker (not a marketplace). Templates
 * are grouped by category; cards are keyboard-focusable buttons with accessible
 * names/descriptions. KO/EN copy comes from each template definition.
 */
export function TemplateLibraryModal({ onSelect, onClose }: Props) {
  const { state } = useAppStore();
  const lang = state.language;
  const s = A11Y[lang];
  const firstCardRef = useRef<HTMLButtonElement>(null);
  const titleId = 'template-library-title';

  useEffect(() => {
    firstCardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span id={titleId} className={styles.title}>
            {s.templateLibraryTitle}
          </span>
          <button type="button" className={styles.close} aria-label={lang === 'ko' ? '닫기' : 'Close'} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {GROUPS.map((group, gi) => {
            const items = templatesForGroup(group);
            if (items.length === 0) return null;
            return (
              <section key={group} className={styles.group} aria-label={s.templateGroups[group]}>
                <h3 className={styles.groupHead}>{s.templateGroups[group]}</h3>
                <div className={styles.grid}>
                  {items.map((t, ti) => {
                    const isPreset = t.assetType === 'conversion-preset';
                    return (
                      <button
                        key={`${group}-${t.id}`}
                        ref={gi === 0 && ti === 0 ? firstCardRef : undefined}
                        type="button"
                        className={`${styles.card} ${isPreset ? styles.preset : ''}`}
                        aria-label={`${t.title[lang]} — ${t.description[lang]}`}
                        onClick={() => onSelect(t)}
                      >
                        <span className={styles.cardTitle}>{t.title[lang]}</span>
                        <span className={styles.cardDesc}>{t.description[lang]}</span>
                        <span className={styles.cardMeta}>
                          <span>{s.templateGroups[t.category as TemplateGroupKey] ?? t.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.defaultGridSize}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
