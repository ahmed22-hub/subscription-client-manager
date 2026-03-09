import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, User, Phone, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../types';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Partial<Client>) => Promise<void>;
  client?: Client | null;
  title: string;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSave, client, title }) => {
  const [formData, setFormData] = useState<Partial<Client>>({
    clientName: '',
    phone: '',
    expirationDate: '',
    notes: '',
    referenceDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (client) {
      setFormData({
        clientName: client.clientName,
        phone: client.phone,
        expirationDate: client.expirationDate,
        notes: client.notes,
        referenceDate: client.referenceDate
      });
    } else {
      setFormData({
        clientName: '',
        phone: '',
        expirationDate: '',
        notes: '',
        referenceDate: ''
      });
    }
    setErrors({});
  }, [client, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.clientName?.trim()) newErrors.clientName = 'Le nom est requis';
    if (!formData.expirationDate) newErrors.expirationDate = "La date d'expiration est requise";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <User size={16} className="text-indigo-500" /> Nom du client *
                </label>
                <input
                  type="text"
                  className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.clientName ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all`}
                  placeholder="Ex: Jean Dupont"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                />
                {errors.clientName && <p className="text-xs text-rose-500 font-medium">{errors.clientName}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Phone size={16} className="text-indigo-500" /> Téléphone
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Ex: +33 6 12 34 56 78"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-500" /> Date d'expiration *
                  </label>
                  <input
                    type="date"
                    className={`w-full px-4 py-2.5 bg-slate-50 border ${errors.expirationDate ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all`}
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  />
                  {errors.expirationDate && <p className="text-xs text-rose-500 font-medium">{errors.expirationDate}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" /> Date de référence
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.referenceDate}
                    onChange={(e) => setFormData({ ...formData, referenceDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" /> Notes
                </label>
                <textarea
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                  placeholder="Notes additionnelles..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
