interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
}

export function Button({ label, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button
      type="button"
      className={`flui-button flui-button--${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
