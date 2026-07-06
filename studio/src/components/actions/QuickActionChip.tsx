import { Button } from '../ui/Button';

interface Props {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}

/** A quick-start action shown in the empty state. Text-labelled button. */
export function QuickActionChip({ label, primary, disabled, title, onClick }: Props) {
  return (
    <Button variant={primary ? 'primary' : 'default'} size="md" disabled={disabled} title={title} onClick={onClick}>
      {label}
    </Button>
  );
}
