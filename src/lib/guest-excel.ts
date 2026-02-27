import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedGuest {
  row_number: number;
  group_name: string;
  phone_numbers: string[];
  invited_pax: number;
  side: string | null;
  guest_group: string | null;
  is_automated: boolean;
}

export interface ParseError {
  row_number: number;
  group_name: string;
  errors: string[];
}

export interface ParseResult {
  valid: ParsedGuest[];
  errors: ParseError[];
}

// ─── Column mapping ──────────────────────────────────────────────────────────

const COLUMNS = [
  'שם קבוצה',
  'טלפון 1',
  'טלפון 2',
  'כמות מוזמנים',
  'צד',
  'קבוצה',
  'שליחה אוטומטית',
];

const INSTRUCTIONS = [
  'שם המשפחה או הזוג (חובה)',
  'מספר ראשי, 05X... (חובה)',
  'מספר נוסף (אופציונלי)',
  'מספר שלם, לפחות 1 (חובה)',
  'חתן / כלה (אופציונלי)',
  'משפחה / חברים / עבודה (אופציונלי)',
  'כן / לא, ברירת מחדל: כן',
];

// ─── Phone normalization ─────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

function isValidPhone(raw: string): boolean {
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}

// ─── Template download ───────────────────────────────────────────────────────

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new();
  const data = [COLUMNS, INSTRUCTIONS];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths (approximate characters)
  ws['!cols'] = [
    { wch: 20 }, // שם קבוצה
    { wch: 15 }, // טלפון 1
    { wch: 15 }, // טלפון 2
    { wch: 14 }, // כמות מוזמנים
    { wch: 10 }, // צד
    { wch: 14 }, // קבוצה
    { wch: 16 }, // שליחה אוטומטית
  ];

  // Set RTL on the sheet
  ws['!sheetViews'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'מוזמנים');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'תבנית_מוזמנים.xlsx');
}

// ─── File parsing ────────────────────────────────────────────────────────────

export function parseGuestFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { header: COLUMNS, defval: '' });

        // Skip header row and instruction row
        const dataRows = rows.slice(2);

        const valid: ParsedGuest[] = [];
        const errors: ParseError[] = [];

        dataRows.forEach((row, idx) => {
          const rowNum = idx + 3; // 1-indexed, skip header + instructions
          const groupName = String(row['שם קבוצה'] ?? '').trim();
          const phone1Raw = String(row['טלפון 1'] ?? '').trim();
          const phone2Raw = String(row['טלפון 2'] ?? '').trim();
          const paxRaw = row['כמות מוזמנים'];
          const side = String(row['צד'] ?? '').trim() || null;
          const guestGroup = String(row['קבוצה'] ?? '').trim() || null;
          const autoRaw = String(row['שליחה אוטומטית'] ?? '').trim().toLowerCase();

          // Skip completely empty rows
          if (!groupName && !phone1Raw) return;

          const rowErrors: string[] = [];

          if (!groupName) rowErrors.push('שם קבוצה חסר');
          if (!phone1Raw) rowErrors.push('טלפון 1 חסר');
          else if (!isValidPhone(phone1Raw)) rowErrors.push('טלפון 1 לא תקין');
          if (phone2Raw && !isValidPhone(phone2Raw)) rowErrors.push('טלפון 2 לא תקין');

          const pax = Number(paxRaw);
          if (!paxRaw || isNaN(pax) || pax < 1 || !Number.isInteger(pax)) {
            rowErrors.push('כמות מוזמנים חייבת להיות מספר שלם >= 1');
          }

          if (rowErrors.length > 0) {
            errors.push({ row_number: rowNum, group_name: groupName || `שורה ${rowNum}`, errors: rowErrors });
            return;
          }

          const phoneNumbers = [normalizePhone(phone1Raw)];
          if (phone2Raw) phoneNumbers.push(normalizePhone(phone2Raw));

          const isAutomated = autoRaw === 'לא' || autoRaw === 'no' || autoRaw === 'false' ? false : true;

          valid.push({
            row_number: rowNum,
            group_name: groupName,
            phone_numbers: phoneNumbers,
            invited_pax: pax,
            side,
            guest_group: guestGroup,
            is_automated: isAutomated,
          });
        });

        resolve({ valid, errors });
      } catch {
        reject(new Error('שגיאה בפענוח הקובץ — ודא שהפורמט xlsx'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
