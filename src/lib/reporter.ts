const STORAGE_KEY = 'prishtina_raporton_tokens';

export interface ReporterEntry {
  complaintId: string;
  token: string;
}

export function getReporterEntries(): ReporterEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReporterEntry[];
  } catch {
    return [];
  }
}

export function addReporterEntry(entry: ReporterEntry): void {
  const entries = getReporterEntries();
  if (!entries.find((e) => e.complaintId === entry.complaintId)) {
    entries.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

export function isReporter(complaintId: string): boolean {
  return getReporterEntries().some((e) => e.complaintId === complaintId);
}

export function getToken(complaintId: string): string | null {
  const entry = getReporterEntries().find((e) => e.complaintId === complaintId);
  return entry?.token ?? null;
}
