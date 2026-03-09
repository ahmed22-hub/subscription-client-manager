import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  ArrowUpDown, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Phone, 
  MessageSquare,
  ExternalLink,
  Calendar,
  Clock,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, getSubscriptionStatus, getStatusColor, formatDisplayDate, getRemainingDays } from '../types';
import { Badge } from './Badge';

interface ClientsPageProps {
  clients: Client[];
  onRefresh: () => void;
  onEdit: (client: Client) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  onRenew: (id: number) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ clients, onRefresh, onEdit, onDelete, onAdd, onRenew }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Client | 'status' | 'remaining', direction: 'asc' | 'desc' }>({ key: 'expirationDate', direction: 'asc' });

  const statuses = ['All', 'Actif', 'Expire bientôt', 'Expiré'];

  const filteredClients = clients.filter(c => {
    const status = c.status || getSubscriptionStatus(c.expirationDate);
    const matchesSearch = c.clientName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchesStatus = statusFilter === 'All' || status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    let valA: any = a[sortConfig.key as keyof Client];
    let valB: any = b[sortConfig.key as keyof Client];

    if (sortConfig.key === 'status') {
      valA = a.status;
      valB = b.status;
    } else if (sortConfig.key === 'remaining') {
      valA = a.daysRemaining;
      valB = b.daysRemaining;
    }

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: any) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Gestion des Clients</h2>
        <button 
          onClick={onAdd}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
        >
          <Plus size={20} />
          Nouveau Client
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                statusFilter === status 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-bottom border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('clientName')}>
                  <div className="flex items-center gap-2">Client <ArrowUpDown size={14} /></div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('expirationDate')}>
                  <div className="flex items-center gap-2">Expiration <ArrowUpDown size={14} /></div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-2">Statut <ArrowUpDown size={14} /></div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredClients.map((client) => {
                  const status = client.status || getSubscriptionStatus(client.expirationDate);
                  const remaining = client.daysRemaining ?? getRemainingDays(client.expirationDate);
                  
                  return (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={client.id} 
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{client.clientName}</div>
                        <div className="text-xs text-slate-400">ID: #{client.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          {client.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-900 font-medium">
                          <Calendar size={14} className="text-slate-400" />
                          {formatDisplayDate(client.expirationDate)}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={12} />
                          {remaining < 0 ? 'Expiré' : `Reste ${remaining} jours`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStatusColor(status)}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => onRenew(client.id)}
                            title="Renouveler (30 jours)"
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button 
                            onClick={() => onEdit(client)}
                            title="Modifier"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => onDelete(client.id)}
                            title="Supprimer"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filteredClients.length === 0 && (
          <div className="p-12 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-300" size={32} />
            </div>
            <h3 className="text-slate-900 font-bold">Aucun client trouvé</h3>
            <p className="text-slate-500 text-sm">Essayez de modifier vos filtres ou votre recherche.</p>
          </div>
        )}
      </div>
    </div>
  );
};
