export interface UsageSnapshot {
  id: string;
  club_id: string;
  taken_at: string;
  db_bytes: number | string;
  storage_bytes: number | string;
  session_count: number;
  teilnehmer_count: number;
  media_count: number;
  last_activity_at: string | null;
}

export interface OwnerRow {
  ownerId: string;
  ownerSince: string;
  clubCount: number;
  dbBytes: number;
  storageBytes: number;
  storageDelta: number;
  sessionCount: number;
  teilnehmerCount: number;
  mediaCount: number;
  staffCount: number;
  lastActivity: string | null;
}
