import { useEffect, useState } from 'react'
import { FileText, Layers, BookOpen, Scale, Gavel, Users, TrendingUp, Clock } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import { adminApi } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'

interface DashboardData {
  counts: {
    documents: number
    chunks: number
    sources: number
    cases: number
    acts: number
    users: number
  }
  recent_activity: Array<{
    type: string
    title: string
    created_at: string
  }>
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getDashboard()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const counts = data?.counts

  const typeIcon: Record<string, React.ReactNode> = {
    document: <FileText size={12} />,
    chunk: <Layers size={12} />,
    case: <Scale size={12} />,
    act: <Gavel size={12} />,
    source: <BookOpen size={12} />,
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your Gavel & Brief legal intelligence platform"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-white/5 rounded mb-3 w-16" />
              <div className="h-7 bg-white/5 rounded w-12" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Documents" value={counts?.documents ?? 0} icon={FileText} color="brand" />
            <StatCard label="Chunks" value={counts?.chunks ?? 0} icon={Layers} color="purple" />
            <StatCard label="Sources" value={counts?.sources ?? 0} icon={BookOpen} color="cyan" />
            <StatCard label="Cases" value={counts?.cases ?? 0} icon={Scale} color="amber" />
            <StatCard label="Acts" value={counts?.acts ?? 0} icon={Gavel} color="green" />
            <StatCard label="Users" value={counts?.users ?? 0} icon={Users} color="red" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-brand-400" />
            <h2 className="font-semibold text-sm text-gray-200">Recent Activity</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-white/5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-white/5 rounded w-3/4 mb-1.5" />
                    <div className="h-2.5 bg-white/5 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.recent_activity && data.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {data.recent_activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {typeIcon[item.type] ?? <FileText size={12} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.type} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No recent activity</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-brand-400" />
            <h2 className="font-semibold text-sm text-gray-200">Data Overview</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Documents', value: counts?.documents ?? 0, max: Math.max(counts?.documents ?? 1, 1), color: 'bg-brand-500' },
              { label: 'Chunks', value: counts?.chunks ?? 0, max: Math.max(counts?.chunks ?? 1, 1), color: 'bg-purple-500' },
              { label: 'Cases', value: counts?.cases ?? 0, max: Math.max(counts?.cases ?? 1, 1), color: 'bg-amber-500' },
              { label: 'Acts', value: counts?.acts ?? 0, max: Math.max(counts?.acts ?? 1, 1), color: 'bg-green-500' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{label}</span>
                  <span>{value.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-700`}
                    style={{ width: loading ? '0%' : `${Math.min(100, (value / Math.max(counts?.chunks ?? 1, 1)) * 100 * 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
