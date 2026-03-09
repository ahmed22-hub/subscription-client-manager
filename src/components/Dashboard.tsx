import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  TrendingUp 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion } from 'motion/react';
import { StatCard } from './StatCard';

interface DashboardProps {
  stats: any;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const pieData = [
    { name: 'Actif', value: stats.byStatus.active, color: '#10b981' },
    { name: 'Expire bientôt', value: stats.byStatus.expiringSoon, color: '#f59e0b' },
    { name: 'Expiré', value: stats.byStatus.expired, color: '#f43f5e' },
  ];

  const monthData = Object.entries(stats.byMonth || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Clients" value={stats.total} icon={Users} color="bg-indigo-500" subtitle="Base de données active" />
        <StatCard title="Abonnements Actifs" value={stats.active} icon={CheckCircle2} color="bg-emerald-500" subtitle="Clients en règle" />
        <StatCard title="Expire bientôt" value={stats.expiringSoon} icon={Clock} color="bg-amber-500" subtitle="Dans les 7 prochains jours" />
        <StatCard title="Expiré" value={stats.expired} icon={AlertCircle} color="bg-rose-500" subtitle="Action requise" />
      </div>

      {stats.expiringIn2Days > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-4 text-amber-800"
        >
          <div className="bg-amber-100 p-2 rounded-xl">
            <AlertCircle className="text-amber-600" size={24} />
          </div>
          <div>
            <p className="font-bold">Alerte : {stats.expiringIn2Days} client(s) expirent dans exactement 2 jours</p>
            <p className="text-sm">Une notification par email a été envoyée pour ces clients.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Renouvellements Aujourd'hui" value={stats.renewalsToday} icon={Calendar} color="bg-blue-500" />
        <StatCard title="Renouvellements (7j)" value={stats.renewals7Days} icon={TrendingUp} color="bg-violet-500" />
        <StatCard title="Renouvellements (30j)" value={stats.renewals30Days} icon={TrendingUp} color="bg-slate-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Répartition des Statuts</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Prochains Renouvellements</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
