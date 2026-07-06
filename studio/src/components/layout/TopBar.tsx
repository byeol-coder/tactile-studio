import { useAppStore } from '../../app/appState';
import { DotPadStatusBadge } from '../dotpad/DotPadStatusBadge';
import { DotPadConnectionButton } from '../dotpad/DotPadConnectionButton';
import { CommandLauncher } from '../command/CommandLauncher';
import { ProductSwitcher } from '../product/ProductSwitcher';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '../ui/Button';
import styles from './TopBar.module.css';

/**
 * Compact top bar: brand + breadcrumb (left), Command Launcher (center),
 * always-visible DotPad status + device action (right).
 */
export function TopBar() {
  const { state } = useAppStore();

  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <ProductSwitcher />
        <span className={styles.sep} aria-hidden="true">
          /
        </span>
        <span className={styles.workflow}>My Workflow</span>
      </div>

      <CommandLauncher />

      <div className={styles.right}>
        <LanguageToggle />
        <DotPadStatusBadge status={state.dotpadStatus} deviceName={state.deviceName} />
        <DotPadConnectionButton size="sm" />
        <Button
          size="sm"
          disabled={!state.document}
          title={state.document ? undefined : '변환 후 저장할 수 있습니다'}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
