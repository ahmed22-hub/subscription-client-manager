import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Users, 
  FileUp, 
  LogOut, 
  Menu,
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';

import { Client } from './types';
import { SidebarItem } from './components/SidebarItem';
import { Dashboard } from './components/Dashboard';
import { ClientsPage } from './components/ClientsPage';

// --- LOGIN COMPONENT ---
const Login = ({ onLogin }: { onLogin: (token: string, user: any) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post('/api/login', { username, password });
      onLogin(data.token, data.user);
      toast.success('Bienvenue !');
    } catch (err) {
      toast.error('Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <TrendingUp className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ChatGPT Pro Manager</h1>
          <p className="text-slate-500">Connectez-vous pour gérer vos abonnements</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Utilisateur</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Mot de passe</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

import { parseExcelFile, ValidationResult } from './utils/importUtils';
import { ClientModal } from './components/ClientModal';

// --- IMPORT COMPONENT ---
const ImportPage = ({ onRefresh }: { onRefresh: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    try {
      const data = await parseExcelFile(selectedFile);
      setImportData(data);
      setStep('preview');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la lecture du fichier");
    }
  };

  const [importOnlyValid, setImportOnlyValid] = useState(false);

  const handleImport = async () => {
    if (!importData) return;
    const validStatuses = importOnlyValid ? ['Valid'] : ['Valid', 'Repaired'];
    const clientsToImport = importData.results
      .filter((r: ValidationResult) => validStatuses.includes(r.status))
      .map((r: ValidationResult) => r.data);

    if (clientsToImport.length === 0) {
      toast.error("Aucune donnée valide à importer");
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/import-json', { clients: clientsToImport }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${clientsToImport.length} clients importés avec succès !`);
      onRefresh();
      reset();
    } catch (err) {
      toast.error('Erreur lors de l\'importation');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setImportData(null);
    setStep('select');
    setImportOnlyValid(false);
  };

  if (step === 'preview' && importData) {
    const totalToImport = importOnlyValid ? importData.summary.valid : (importData.summary.valid + importData.summary.repaired);

    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Aperçu de l'importation</h2>
            <p className="text-slate-500">
              Feuille : <span className="font-bold text-indigo-600">{importData.sheetName}</span> • 
              Ligne d'en-tête : <span className="font-bold text-indigo-600">#{importData.headerRow}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={importOnlyValid} 
                onChange={(e) => setImportOnlyValid(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 font-medium">Uniquement valides (sans réparations)</span>
            </label>
            <button onClick={reset} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">
              Annuler
            </button>
            <button 
              onClick={handleImport}
              disabled={uploading || totalToImport === 0}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {uploading ? 'Importation...' : `Importer ${totalToImport} clients`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Total</p>
            <p className="text-xl font-bold text-slate-900">{importData.summary.total}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
            <p className="text-[10px] text-emerald-600 uppercase font-bold mb-1">Valides</p>
            <p className="text-xl font-bold text-emerald-700">{importData.summary.valid}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
            <p className="text-[10px] text-blue-600 uppercase font-bold mb-1">Réparés</p>
            <p className="text-xl font-bold text-blue-700">{importData.summary.repaired}</p>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 shadow-sm">
            <p className="text-[10px] text-rose-600 uppercase font-bold mb-1">Invalides</p>
            <p className="text-xl font-bold text-rose-700">{importData.summary.invalid}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Ignorés (vides)</p>
            <p className="text-xl font-bold text-slate-500">{importData.summary.ignored}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm">Colonnes détectées</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(importData.mapping).map(([original, mapped]: any) => (
                <div key={original} className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-400 italic">"{original}"</span>
                  <span className="text-slate-300">→</span>
                  <span className="text-indigo-600 font-bold">{mapped}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Ligne</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Expiration</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase">Statut / Réparations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {importData.results.slice(0, 20).map((res: ValidationResult) => (
                  <tr key={res.row} className={res.status === 'Invalid' ? 'bg-rose-50/30' : ''}>
                    <td className="px-6 py-4 text-xs text-slate-400">#{res.row}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{res.data.clientName || '---'}</div>
                      <div className="text-[10px] text-slate-500">{res.data.phone || 'Pas de téléphone'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700">
                      {res.data.expirationDate || '---'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {res.status === 'Valid' && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Valide</span>
                        )}
                        {res.status === 'Repaired' && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Réparé</span>
                        )}
                        {res.status === 'Invalid' && (
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Invalide</span>
                        )}
                        
                        {res.repairs.map((r, i) => (
                          <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] border border-slate-200">
                            {r}
                          </span>
                        ))}
                        
                        {res.errors.map((e, i) => (
                          <span key={i} className="text-rose-600 text-[10px] font-bold flex items-center gap-1">
                            <AlertCircle size={10} /> {e}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importData.results.length > 20 && (
            <div className="p-4 text-center border-t border-slate-50 bg-slate-50/30 text-slate-400 text-[11px]">
              Affichage des 20 premières lignes sur {importData.results.length}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900">Importer des Données</h2>
        <p className="text-slate-500 mt-2">Importez vos clients depuis un fichier Excel (.xlsx)</p>
      </div>

      <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4 hover:border-indigo-400 transition-colors group">
        <div className="bg-slate-50 p-6 rounded-2xl group-hover:bg-indigo-50 transition-colors">
          <FileUp className="text-slate-400 group-hover:text-indigo-600" size={48} />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">
            Cliquez pour sélectionner un fichier
          </p>
          <p className="text-sm text-slate-500">Format supporté: .xlsx (Feuille "Clients")</p>
        </div>
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          id="file-upload"
          onChange={handleFileSelect}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
        >
          Parcourir
        </label>
      </div>

      <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
        <h4 className="text-amber-800 font-bold mb-2 flex items-center gap-2">
          <AlertCircle size={18} />
          Structure flexible
        </h4>
        <p className="text-amber-700 text-sm">
          L'application détecte automatiquement vos colonnes. Assurez-vous d'avoir au moins :
          <br />
          - <span className="font-bold">Nom du client</span> (ou clientName)
          <br />
          - <span className="font-bold">Date d'expiration</span> (ou expirationDate)
        </p>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [modalTitle, setModalTitle] = useState('Ajouter un client');

  const fetchData = async () => {
    if (!token) return;
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [clientsRes, statsRes] = await Promise.all([
        axios.get('/api/clients', config),
        axios.get('/api/stats', config)
      ]);
      setClients(clientsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleLogin = (newToken: string, newUser: any) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const handleDeleteClient = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    try {
      await axios.delete(`/api/clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Client supprimé');
      fetchData();
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleRenewClient = async (id: number) => {
    try {
      await axios.post(`/api/clients/${id}/renew`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Abonnement renouvelé pour 30 jours');
      fetchData();
    } catch (err) {
      toast.error('Erreur lors du renouvellement');
    }
  };

  const handleSaveClient = async (formData: Partial<Client>) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (editingClient) {
        await axios.put(`/api/clients/${editingClient.id}`, formData, config);
        toast.success('Client mis à jour');
      } else {
        await axios.post('/api/clients', formData, config);
        toast.success('Client ajouté');
      }
      fetchData();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
      throw err;
    }
  };

  const openAddModal = () => {
    setEditingClient(null);
    setModalTitle('Ajouter un client');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setModalTitle('Modifier le client');
    setIsModalOpen(true);
  };

  if (!token) return <Login onLogin={handleLogin} />;
  if (loading || !stats) return <div className="flex items-center justify-center min-h-screen">Chargement...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-100 transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-20'} flex flex-col`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
            <TrendingUp className="text-white" size={24} />
          </div>
          {isSidebarOpen && <h1 className="font-bold text-xl text-slate-900 truncate">ChatGPT Pro</h1>}
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label={isSidebarOpen ? "Tableau de bord" : ""} 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Users} 
            label={isSidebarOpen ? "Clients" : ""} 
            active={activeTab === 'clients'} 
            onClick={() => setActiveTab('clients')} 
          />
          <SidebarItem 
            icon={FileUp} 
            label={isSidebarOpen ? "Importation" : ""} 
            active={activeTab === 'import'} 
            onClick={() => setActiveTab('import')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <SidebarItem 
            icon={LogOut} 
            label={isSidebarOpen ? "Déconnexion" : ""} 
            active={false} 
            onClick={handleLogout} 
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-100 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">Administrateur</p>
              <p className="text-xs text-slate-500">admin@chatgptpro.com</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 border border-slate-200">
              AD
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard stats={stats} />}
              {activeTab === 'clients' && (
                <ClientsPage 
                  clients={clients} 
                  onRefresh={fetchData} 
                  onEdit={openEditModal}
                  onDelete={handleDeleteClient}
                  onAdd={openAddModal}
                  onRenew={handleRenewClient}
                />
              )}
              {activeTab === 'import' && <ImportPage onRefresh={fetchData} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveClient}
        client={editingClient}
        title={modalTitle}
      />
    </div>
  );
}
