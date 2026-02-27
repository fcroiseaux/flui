interface TextProps {
  text: string;
  variant?: 'body' | 'caption' | 'code';
}

export function Text({ text, variant = 'body' }: TextProps) {
  const className = variant === 'body' ? 'flui-text' : `flui-text flui-text--${variant}`;

  if (variant === 'code') {
    return <code className={className}>{text}</code>;
  }

  return <p className={className}>{text}</p>;
}
