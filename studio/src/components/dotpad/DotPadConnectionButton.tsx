import { useDotPadConnection } from '../../hooks/useDotPadConnection';
import { Button } from '../ui/Button';

/**
 * Device action button. Its label reflects the connection state:
 * - disconnected → "Dot Pad 연결"
 * - connecting   → "연결 중…" (disabled)
 * - connected    → "연결 해제"
 * - error        → "다시 시도"
 * Never "연결 새로고침".
 */
export function DotPadConnectionButton({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const { status, connect, disconnect, retry } = useDotPadConnection();

  if (status === 'connecting') {
    return (
      <Button size={size} disabled aria-live="off">
        연결 중…
      </Button>
    );
  }
  if (status === 'connected') {
    return (
      <Button size={size} variant="quiet" onClick={disconnect}>
        연결 해제
      </Button>
    );
  }
  if (status === 'error') {
    return (
      <Button size={size} onClick={retry}>
        다시 시도
      </Button>
    );
  }
  return (
    <Button size={size} onClick={connect}>
      Dot Pad 연결
    </Button>
  );
}
