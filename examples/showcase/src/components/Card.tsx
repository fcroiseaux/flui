import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <div className="flui-card">
      <div className="flui-card-title">{title}</div>
      {subtitle && <div className="flui-card-subtitle">{subtitle}</div>}
      {children}
    </div>
  );
}
