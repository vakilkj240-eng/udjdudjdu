import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: string
  change?: string
}

export default function StatCard({ label, value, icon: Icon, color = 'brand', change }: StatCardProps) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-600/20 text-brand-400',
    green: 'bg-green-600/20 text-green-400',
    amber: 'bg-amber-600/20 text-amber-400',
    red: 'bg-red-600/20 text-red-400',
    purple: 'bg-purple-600/20 text-purple-400',
    cyan: 'bg-cyan-600/20 text-cyan-400',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1.5">{value}</p>
          {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color] ?? colorMap.brand}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}
