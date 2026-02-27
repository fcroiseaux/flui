import type { ReactNode } from 'react';

interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  children?: ReactNode;
}

export function Heading({ level, text }: HeadingProps) {
  const Tag = `h${level}` as const;
  return <Tag className="flui-heading" data-level={level}>{text}</Tag>;
}
