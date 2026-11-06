/**
 * @file MetricCard.tsx
 * @description Reusable presentational card component for displaying large numerical metrics
 * with semantic color-coding, units, descriptions, and optional prefixes.
 */

/**
 * Properties for the MetricCard component.
 */
export interface MetricCardProps {
  /** Metric label displayed above the value (e.g. "Tools Loaded") */
  label: string;
  /** Numerical value of the metric to display and format */
  value: number;
  /** Unit descriptor displayed beneath the number (e.g. "tools", "tokens", "ms") */
  unit: string;
  /** Descriptive context explaining what the metric represents */
  description: string;
  /** Semantic accent color theme for the number and border */
  color: 'green' | 'purple' | 'cyan' | 'yellow';
  /** Optional prefix prepended to formatted number (e.g. "~") */
  prefix?: string;
}

const colorClasses: Record<'green' | 'purple' | 'cyan' | 'yellow', string> = {
  green: 'text-green-400 border-green-900/30',
  purple: 'text-purple-400 border-purple-900/30',
  cyan: 'text-cyan-400 border-cyan-900/30',
  yellow: 'text-yellow-400 border-yellow-900/30',
};

/**
 * MetricCard component renders a single metric inside a stylized card container.
 */
export default function MetricCard({
  label,
  value,
  unit,
  description,
  color,
  prefix = '',
}: MetricCardProps) {
  const colorClass = colorClasses[color] || colorClasses.green;
  const textColor = colorClass.split(' ')[0];

  return (
    <div className={`border rounded-lg p-6 bg-gray-900 ${colorClass}`}>
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <div className={`text-4xl font-bold ${textColor}`}>
        {prefix}{value.toLocaleString()}
      </div>
      <div className="text-xs text-gray-500 mt-1">{unit}</div>
      <div className="text-xs text-gray-400 mt-3">{description}</div>
    </div>
  );
}
