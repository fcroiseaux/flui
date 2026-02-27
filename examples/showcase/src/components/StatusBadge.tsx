interface StatusBadgeProps {
  text: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

export function StatusBadge({ text, status }: StatusBadgeProps) {
  return <span className={`flui-badge flui-badge--${status}`}>{text}</span>;
}
