import { useAppStore } from '../../app/appState';
import { useDotPadSend } from '../../hooks/useDotPadSend';
import { Button } from '../ui/Button';

/**
 * Sends the converted document to DotPad. Disabled until a converted
 * document exists AND the device is connected. Shares logic with the command
 * launcher via useDotPadSend.
 */
export function DotPadSendButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { state } = useAppStore();
  const { canSend, send } = useDotPadSend();

  const label =
    state.sendStatus === 'sending' ? '전송 중…' : state.sendStatus === 'sent' ? '다시 전송' : 'Dot Pad로 보내기';

  let hint = '';
  if (state.dotpadStatus !== 'connected') hint = 'Chromium 브라우저의 HTTPS 또는 localhost에서 Dot Pad를 먼저 연결하세요';
  else if (!state.document) hint = '변환 후 전송할 수 있습니다';

  return (
    <div>
      <Button
        variant="primary"
        fullWidth={fullWidth}
        disabled={!canSend}
        onClick={send}
        aria-describedby={hint ? 'send-hint' : undefined}
      >
        {label}
      </Button>
      {hint && (
        <p id="send-hint" style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
