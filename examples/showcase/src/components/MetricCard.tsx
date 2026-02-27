interface MetricCardProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

const trendIcons: Record<string, string> = {
  up: '\u2191',
  down: '\u2193',
  flat: '\u2192',
};

export function MetricCard({ label, value, trend }: MetricCardProps) {
  return (
    <div className="flui-metric-card">
      <span className="flui-metric-label">{label}</span>
      <span className="flui-metric-value">{value}</span>
      {trend && (
        <span className={`flui-metric-trend flui-metric-trend--${trend}`}>
          {trendIcons[trend]} {trend}
        </span>
      )}
    </div>
  );
}
