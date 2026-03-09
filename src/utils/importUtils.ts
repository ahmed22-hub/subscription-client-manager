import * as XLSX from 'xlsx';
import { format, parse, isValid, parseISO, startOfDay } from 'date-fns';

export type RowStatus = 'Valid' | 'Repaired' | 'Invalid' | 'Ignored';

export interface ImportRow {
  clientName: string;
  phone: string;
  expirationDate: string;
  notes: string;
  referenceDate: string;
}

export interface ValidationResult {
  row: number;
  status: RowStatus;
  errors: string[];
  repairs: string[];
  data: Partial<ImportRow>;
}

const ALIASES: Record<string, keyof ImportRow> = {
  'clientname': 'clientName', 'nomduclient': 'clientName', 'nomclient': 'clientName', 'client': 'clientName', 'nom': 'clientName',
  'phone': 'phone', 'telephone': 'phone', 'téléphone': 'phone', 'tel': 'phone', 'mobile': 'phone',
  'expirationdate': 'expirationDate', 'datedexpiration': 'expirationDate', 'dateexpiration': 'expirationDate', 'expiration': 'expirationDate', 'expirydate': 'expirationDate',
  'notes': 'notes', 'remarque': 'notes', 'remarques': 'notes', 'note': 'notes',
  'referencedate': 'referenceDate', 'datedereference': 'referenceDate', 'datereference': 'referenceDate', 'reference': 'referenceDate'
};

const PLACEHOLDERS = ['-', '--', 'n/a', 'na', 'null', 'vide', 'none', 'aucun'];

export const normalizeHeader = (str: string): string => {
  return str.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Accents
    .replace(/[^a-z0-9]/g, '') // Punctuation/Spaces
    .trim();
};

const cleanText = (val: any): { value: string, repaired: boolean } => {
  if (val === null || val === undefined) return { value: '', repaired: false };
  let str = String(val).trim().replace(/\s+/g, ' ');
  if (PLACEHOLDERS.includes(str.toLowerCase())) return { value: '', repaired: true };
  return { value: str, repaired: str !== String(val) };
};

const cleanPhone = (val: any): { value: string, repaired: boolean } => {
  const { value: raw } = cleanText(val);
  if (!raw) return { value: '', repaired: false };
  const cleaned = raw.replace(/[^\d+]/g, '');
  return { value: cleaned, repaired: cleaned !== raw };
};

const robustParseDate = (val: any): { value: string, repaired: boolean, error?: string } => {
  if (!val) return { value: '', repaired: false };

  // 1. Excel Serial
  if (typeof val === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      return { value: format(new Date(d.y, d.m - 1, d.d), 'yyyy-MM-dd'), repaired: true };
    } catch { return { value: '', repaired: false, error: 'Format Excel invalide' }; }
  }

  let str = String(val).trim().replace(/[.-]/g, '/');
  
  // Try ISO
  const iso = parseISO(str);
  if (isValid(iso)) return { value: format(iso, 'yyyy-MM-dd'), repaired: str !== String(val) };

  // Try DD/MM/YYYY
  const fr = parse(str, 'dd/MM/yyyy', new Date());
  if (isValid(fr)) return { value: format(fr, 'yyyy-MM-dd'), repaired: true };

  // Try common JS date
  const jsDate = new Date(str);
  if (isValid(jsDate)) return { value: format(jsDate, 'yyyy-MM-dd'), repaired: true };

  return { value: '', repaired: false, error: 'Date illisible' };
};

export const parseExcelFile = async (file: File): Promise<{
  sheetName: string;
  headerRow: number;
  mapping: Record<string, string>;
  results: ValidationResult[];
  summary: { total: number; valid: number; repaired: number; invalid: number; ignored: number };
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('client')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

        // 1. Detect Header Row (scan first 5)
        let headerIdx = 0;
        let bestScore = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const score = rows[i].filter(cell => ALIASES[normalizeHeader(String(cell))]).length;
          if (score > bestScore) { bestScore = score; headerIdx = i; }
        }

        const rawHeaders = rows[headerIdx].map(h => String(h || ''));
        const mapping: Record<string, string> = {};
        const colMap: Record<string, number> = {};

        rawHeaders.forEach((h, i) => {
          const key = ALIASES[normalizeHeader(h)];
          if (key) { mapping[h] = key; colMap[key] = i; }
        });

        // 2. Process Data
        const results: ValidationResult[] = rows.slice(headerIdx + 1).map((row, idx) => {
          const errors: string[] = [];
          const repairs: string[] = [];
          const data: Partial<ImportRow> = {};
          
          // Check if row is empty
          if (row.every(c => !String(c).trim())) return { row: idx + headerIdx + 2, status: 'Ignored', errors: [], repairs: [], data: {} };

          // Map & Clean
          const nameClean = cleanText(row[colMap['clientName']]);
          data.clientName = nameClean.value;
          if (nameClean.repaired) repairs.push('Nom nettoyé');

          const phoneClean = cleanPhone(row[colMap['phone']]);
          data.phone = phoneClean.value;
          if (phoneClean.repaired) repairs.push('Téléphone normalisé');

          const expDate = robustParseDate(row[colMap['expirationDate']]);
          data.expirationDate = expDate.value;
          if (expDate.repaired) repairs.push('Date réparée');
          if (expDate.error) errors.push(expDate.error);

          const refDate = robustParseDate(row[colMap['referenceDate']]);
          data.referenceDate = refDate.value;
          if (refDate.repaired) repairs.push('Date réf. réparée');

          data.notes = cleanText(row[colMap['notes']]).value;

          // Validation
          if (!data.clientName && !data.expirationDate) return { row: idx + headerIdx + 2, status: 'Ignored', errors: [], repairs: [], data: {} };
          if (!data.clientName) errors.push('Nom manquant');
          if (!data.expirationDate && !expDate.error) errors.push('Date manquante');

          let status: RowStatus = errors.length > 0 ? 'Invalid' : (repairs.length > 0 ? 'Repaired' : 'Valid');

          return { row: idx + headerIdx + 2, status, errors, repairs, data };
        });

        const filtered = results.filter(r => r.status !== 'Ignored');
        resolve({
          sheetName,
          headerRow: headerIdx + 1,
          mapping,
          results: filtered,
          summary: {
            total: filtered.length,
            valid: filtered.filter(r => r.status === 'Valid').length,
            repaired: filtered.filter(r => r.status === 'Repaired').length,
            invalid: filtered.filter(r => r.status === 'Invalid').length,
            ignored: results.length - filtered.length
          }
        });
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
};
