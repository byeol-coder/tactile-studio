import { useEffect, useRef, useState } from 'react';
import styles from './product.module.css';
import { Icon } from '../ui/Icon';
import { useProductMenu } from '../../hooks/useProductMenu';
import { ProductDropdownMenu } from './ProductDropdownMenu';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { GraphicPickerModal } from './GraphicPickerModal';
import { CorpusLibraryModal } from './CorpusLibraryModal';
import { HelpModal } from './HelpModal';
import { getRecent, removeRecent, clearRecent } from '../../utils/recentStore';
import { buildLibrary, buildTemplates, SCOPE_TITLE } from '../../utils/sampleLibrary';
import { parseProjectFile } from '../../utils/projectFile';
import type { TactileDocument } from '../../types/tactile';

/**
 * Header Product Switcher: logo + product name (→ home) and a chevron trigger (→ menu).
 * Desktop split: ProductHomeButton = home nav, ProductMenuTrigger = open dropdown.
 */
export function ProductSwitcher() {
  const menu = useProductMenu();
  const rootRef = useRef<HTMLDivElement>(null);
  const [recentItems, setRecentItems] = useState<TactileDocument[]>([]);

  // Load recent list fresh each time the recent picker opens.
  useEffect(() => {
    if (menu.picker === 'recent') setRecentItems(getRecent());
  }, [menu.picker]);

  // Click outside closes the menu.
  useEffect(() => {
    if (!menu.open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) menu.setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menu.open, menu]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      menu.openMenu();
    }
  };

  return (
    <>
      <div className={`${styles.switcher} ${menu.open ? styles.switcherOpen : ''}`} ref={rootRef}>
        <button type="button" className={styles.home} onClick={menu.goHome} aria-label="Tactile Studio 홈으로 이동">
          <Icon name="dotpad" size={20} className={styles.logo} />
          Tactile Studio
          {menu.unsaved && <span className={styles.unsavedDot} aria-hidden="true" title="저장되지 않은 변경사항" />}
        </button>
        <button
          ref={menu.triggerRef}
          type="button"
          className={`${styles.trigger} ${menu.open ? styles.triggerOpen : ''}`}
          aria-label="Tactile Studio 메뉴 열기"
          aria-haspopup="menu"
          aria-expanded={menu.open}
          onClick={() => (menu.open ? menu.setOpen(false) : menu.openMenu())}
          onKeyDown={onTriggerKeyDown}
        >
          <Icon name={menu.open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>

        {menu.open && <ProductDropdownMenu menu={menu} />}
      </div>

      {menu.unsavedOpen && (
        <UnsavedChangesModal
          onCancel={() => menu.confirmHome('cancel')}
          onSave={() => menu.confirmHome('save')}
          onDiscard={() => menu.confirmHome('go')}
        />
      )}

      <input
        ref={menu.openProjectRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          file.text().then((t) => {
            const doc = parseProjectFile(t);
            if (doc) menu.loadDocument(doc);
          });
        }}
      />

      {menu.picker === 'recent' && (
        <GraphicPickerModal
          title="최근 작업"
          items={recentItems}
          onSelect={menu.loadDocument}
          onClose={() => menu.setPicker(null)}
          emptyText="아직 최근 작업이 없습니다. 이미지를 변환하거나 도형을 만들면 여기에 쌓입니다."
          onRemove={(doc) => {
            removeRecent(doc.id);
            setRecentItems((l) => l.filter((d) => d.id !== doc.id));
          }}
          onClear={() => {
            clearRecent();
            setRecentItems([]);
          }}
        />
      )}
      {menu.picker === 'template' && (
        <GraphicPickerModal
          title="템플릿 라이브러리"
          items={buildTemplates()}
          onSelect={menu.loadDocument}
          onClose={() => menu.setPicker(null)}
        />
      )}
      {(menu.picker === 'mine' || menu.picker === 'shared' || menu.picker === 'public') && (
        <GraphicPickerModal
          title={SCOPE_TITLE[menu.picker]}
          items={buildLibrary()[menu.picker]}
          onSelect={menu.loadDocument}
          onClose={() => menu.setPicker(null)}
        />
      )}

      {menu.picker === 'corpus' && <CorpusLibraryModal onClose={() => menu.setPicker(null)} />}

      {menu.help && <HelpModal section={menu.help} onClose={() => menu.setHelp(null)} />}
    </>
  );
}
