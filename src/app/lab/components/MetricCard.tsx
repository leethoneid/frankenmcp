interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  description: string;
  color: 'green' | 'purple' | 'cyan' | 'yellow';
  prefix?: string;
}

const colorClasses: Record<'green' | 'purple' | 'cyan' | 'yellow', string> = {
  green: 'text-green-400 border-green-900/30',
  purple: 'text-purple-400 border-purple-900/30',
  cyan: 'text-cyan-400 border-cyan-900/30',
  yellow: 'text-yellow-400 border-yellow-900/30',
};

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

export type { MetricCardProps };
