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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorConfig[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div>
        <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
        <p className="text-3xl font-bold text-gray-800 mb-1">{value}</p>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
