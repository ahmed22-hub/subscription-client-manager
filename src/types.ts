import { format, parseISO, isBefore, addDays, startOfDay, differenceInDays } from 'date-fns';

export interface Client {
  id: number;
  clientName: string;
  phone: string;
  expirationDate: string;
  notes: string;
  referenceDate: string;
  reminderSentTwoDays?: number;
  created_at: string;
  // Calculated fields for UI
  daysRemaining?: number;
  status?: SubscriptionStatus;
}

export type SubscriptionStatus = 'Actif' | 'Expire bientôt' | 'Expiré';

export const getSubscriptionStatus = (expirationDateStr: string): SubscriptionStatus => {
  if (!expirationDateStr) return 'Expiré';
  const expirationDate = parseISO(expirationDateStr);
  const now = startOfDay(new Date());
  const diff = differenceInDays(expirationDate, now);

  if (isBefore(expirationDate, now)) {
    return 'Expiré';
  }
  if (diff <= 7) {
    return 'Expire bientôt';
  }
  return 'Actif';
};

export const getRemainingDays = (expirationDateStr: string): number => {
  if (!expirationDateStr) return -1;
  const expirationDate = parseISO(expirationDateStr);
  const now = startOfDay(new Date());
  return differenceInDays(expirationDate, now);
};

export const getStatusColor = (status: SubscriptionStatus) => {
  switch (status) {
    case 'Actif': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Expire bientôt': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Expiré': return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};
