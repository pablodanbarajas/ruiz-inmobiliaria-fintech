import { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'teal' | 'orange' | 'green' | 'blue';
}

const colorConfig = {
  teal: 'bg-teal-50 text-teal-700',
  orange: 'bg-orange-50 text-orange-700',
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700'
};

export function SummaryCard({ title, value, subtitle, icon: Icon, color = 'teal' }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg flex-shrink-0 ${colorConfig[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-xs text-gray-500 leading-tight">{title}</h3>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
