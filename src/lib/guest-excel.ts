import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Invitation } from '@/components/dashboard/EditGuestSheet';

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

export interface ParseWarning {
  row_number: number;
  group_name: string;
  message: string;
}

export interface ParseResult {
  valid: ParsedGuest[];
  errors: ParseError[];
  warnings: ParseWarning[];
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
  'שם המשפחה או הזוג (מומלץ)',
  'מספר ראשי, 05X... (מומלץ)',
  'מספר נוסף (אופציונלי)',
  'מספר שלם, לפחות 1 (ברירת מחדל: 1)',
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

        // Auto-detect where data starts — skip header and optional instruction rows
        let startIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 3); i++) {
          const name = String(rows[i]['שם קבוצה'] ?? '').trim();
          const phone = String(rows[i]['טלפון 1'] ?? '').trim();
          // Row with column names → header row
          if (name === 'שם קבוצה' || phone === 'טלפון 1') { startIdx = i + 1; continue; }
          // Row with instructional text → instruction row
          if (name.includes('חובה') || name.includes('מומלץ') || phone.includes('חובה') || phone.includes('מומלץ') || phone.includes('05X')) { startIdx = i + 1; continue; }
          break;
        }
        const dataRows = rows.slice(startIdx);

        const valid: ParsedGuest[] = [];
        const errors: ParseError[] = [];
        const warnings: ParseWarning[] = [];

        dataRows.forEach((row, idx) => {
          const rowNum = idx + startIdx + 1; // 1-indexed Excel row number
          const groupName = String(row['שם קבוצה'] ?? '').trim();
          const phone1Raw = String(row['טלפון 1'] ?? '').trim();
          const phone2Raw = String(row['טלפון 2'] ?? '').trim();
          const paxRaw = String(row['כמות מוזמנים'] ?? '').trim();
          const side = String(row['צד'] ?? '').trim() || null;
          const guestGroup = String(row['קבוצה'] ?? '').trim() || null;
          const autoRaw = String(row['שליחה אוטומטית'] ?? '').trim().toLowerCase();

          // Step A: Skip completely empty rows (ALL fields blank)
          if (!groupName && !phone1Raw && !phone2Raw && !paxRaw && !side && !guestGroup && !autoRaw) return;

          const displayName = groupName || phone1Raw || `שורה ${rowNum}`;

          // Step B: Hard errors

          // Both name AND phone missing (but has other data)
          if (!groupName && !phone1Raw) {
            errors.push({
              row_number: rowNum,
              group_name: `שורה ${rowNum}`,
              errors: [`שורה ${rowNum} לא נכנסה — חסרים גם שם וגם טלפון`],
            });
            return;
          }

          // Pax explicitly 0, negative, or non-numeric (not missing, but bad value)
          if (paxRaw !== '') {
            const paxNum = Number(paxRaw);
            if (isNaN(paxNum) || paxNum <= 0 || !Number.isInteger(paxNum)) {
              errors.push({
                row_number: rowNum,
                group_name: displayName,
                errors: [`שורה ${rowNum} — רשומה ${displayName} לא נכנסה, מספר מוזמנים שגוי (${paxRaw})`],
              });
              return;
            }
          }

          // Step C: Process valid row with possible warnings
          const rowWarnings: string[] = [];
          const phoneNumbers: string[] = [];

          // Phone1 logic
          if (!phone1Raw) {
            rowWarnings.push(`רשומה ${groupName} נקלטה — יש להשלים טלפון ידנית`);
          } else if (!isValidPhone(phone1Raw)) {
            rowWarnings.push(`רשומה ${displayName} — פורמט טלפון נראה לא תקין (${phone1Raw}), יש לבדוק`);
            phoneNumbers.push(normalizePhone(phone1Raw));
          } else {
            phoneNumbers.push(normalizePhone(phone1Raw));
          }

          // Name logic
          if (!groupName && phone1Raw) {
            rowWarnings.push(`רשומה עם טלפון ${phone1Raw} נקלטה — יש להשלים שם ידנית`);
          }

          // Phone2 logic
          if (phone2Raw) {
            if (!isValidPhone(phone2Raw)) {
              rowWarnings.push(`רשומה ${displayName} — פורמט טלפון 2 נראה לא תקין (${phone2Raw}), יש לבדוק`);
            }
            phoneNumbers.push(normalizePhone(phone2Raw));
          }

          // Pax logic
          let invited_pax: number;
          if (paxRaw === '') {
            rowWarnings.push(`רשומה ${displayName} — לא הוזן מספר מוזמנים, הוזן אוטומטית 1`);
            invited_pax = 1;
          } else {
            invited_pax = Number(paxRaw);
          }

          const isAutomated = autoRaw === 'לא' || autoRaw === 'no' || autoRaw === 'false' ? false : true;

          valid.push({
            row_number: rowNum,
            group_name: groupName,
            phone_numbers: phoneNumbers,
            invited_pax,
            side,
            guest_group: guestGroup,
            is_automated: isAutomated,
          });

          for (const msg of rowWarnings) {
            warnings.push({ row_number: rowNum, group_name: displayName, message: msg });
          }
        });

        resolve({ valid, errors, warnings });
      } catch {
        reject(new Error('שגיאה בפענוח הקובץ — ודא שהפורמט xlsx'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────

const EXPORT_COLUMNS = [
  'שם קבוצה',
  'טלפון 1',
  'טלפון 2',
  'כמות מוזמנים',
  'צד',
  'קבוצה',
  'שליחה אוטומטית',
  'סטטוס',
  'מגיעים בפועל',
  'הודעות שנשלחו',
];

const RSVP_LABELS: Record<string, string> = {
  attending: 'מגיע',
  pending:   'ממתין',
  declined:  'לא מגיע',
};

export function exportGuests(guests: Invitation[], filename: string): void {
  const rows = guests.map(g => ({
    'שם קבוצה':        g.group_name ?? '',
    'טלפון 1':         g.phone_numbers?.[0] ?? '',
    'טלפון 2':         g.phone_numbers?.[1] ?? '',
    'כמות מוזמנים':    g.invited_pax ?? '',
    'צד':              g.side ?? '',
    'קבוצה':           g.guest_group ?? '',
    'שליחה אוטומטית': g.is_automated === false ? 'לא' : 'כן',
    'סטטוס':           RSVP_LABELS[g.rsvp_status ?? ''] ?? '',
    'מגיעים בפועל':    g.confirmed_pax ?? '',
    'הודעות שנשלחו':  g.messages_sent_count ?? 0,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });

  ws['!cols'] = [
    { wch: 20 }, // שם קבוצה
    { wch: 15 }, // טלפון 1
    { wch: 15 }, // טלפון 2
    { wch: 14 }, // כמות מוזמנים
    { wch: 10 }, // צד
    { wch: 14 }, // קבוצה
    { wch: 16 }, // שליחה אוטומטית
    { wch: 12 }, // סטטוס
    { wch: 14 }, // מגיעים בפועל
    { wch: 16 }, // הודעות שנשלחו
  ];
  ws['!sheetViews'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'מוזמנים');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, filename);
}
