export type Role = "admin" | "trainer" | "member";
export type MembershipStatus = "pending" | "active" | "suspended";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_id: string;
  role: Role;
  status: MembershipStatus;
  invited_by: string | null;
  joined_at: string;
  profiles?: Profile;
  clubs?: Club;
}

export interface Invitation {
  id: string;
  club_id: string;
  email: string;
  role: Role;
  token: string;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  clubs?: Pick<Club, "name" | "slug">;
}

export interface Location {
  id: string;
  club_id: string;
  name: string;
  address: string | null;
  maps_url: string | null;
  notes: string | null;
}

export interface TrainingWeek {
  id: string;
  club_id: string;
  week_start: string; // ISO date string (YYYY-MM-DD)
  is_published: boolean;
  notes: string | null;
  // Days of the week the notes banner is visible (0=Mo … 6=So).
  notes_visible_dow: number[];
  created_by: string;
  created_at: string;
  updated_at: string;
  training_sessions?: TrainingSession[];
}

export interface ClubTopic {
  id: string;
  club_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface ClubSessionType {
  id: string;
  club_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface VirtualTrainer {
  id: string;
  club_id: string;
  name: string;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface SessionTrainer {
  session_id: string;
  user_id: string | null;
  virtual_trainer_id?: string | null;
  profiles?: Pick<Profile, "id" | "full_name">;
}

export type SessionKind = "training" | "event";

export interface TrainingSession {
  id: string;
  week_id: string;
  day_of_week: number; // 0=Mon, 6=Sun
  time_start: string; // "HH:MM:SS"
  time_end: string;
  location_id: string | null;
  topic: string | null; // legacy title, now nullable
  topics: string[]; // content topics (from club_topics)
  session_types: string[]; // audience/level categories (from club_session_types)
  description: string | null;
  trainer_id: string | null; // kept for backward compat (first trainer)
  is_cancelled: boolean;
  template_id: string | null; // set if this session was generated from a recurring template
  is_modified: boolean; // true = user edited this occurrence individually (skip bulk future edits)
  guest_trainers: string[]; // free-text names for guest / external trainers
  tags: string[];
  notes: string | null;
  color: string | null;
  sort_order: number | null;
  probetraining_count: number; // trial visitors — anonymous counter
  // event support
  kind: SessionKind;
  title: string | null;         // required when kind === "event"
  is_pinned: boolean;           // always visible in public view even under filters
  event_date: string | null;    // YYYY-MM-DD; set when kind === "event"
  metadata: Record<string, unknown>; // capacity, signup_url, cost, age_range, …
  created_at: string;
  updated_at: string;
  // attendance
  expected_attendance?: ExpectedAttendance;
  locations?: Location;
  profiles?: Profile; // trainer profile (deprecated, use session_trainers)
  session_trainers?: SessionTrainer[];
  session_media?: SessionMedia[];
}

export type SessionMediaKind = "image" | "pdf" | "link";

export interface SessionMedia {
  id: string;
  session_id: string;
  kind: SessionMediaKind;
  url: string;
  caption: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

/** Per-session cap on attached media (enforced client-side; UI hides upload above it). */
export const SESSION_MEDIA_MAX = 5;
export const SESSION_MEDIA_IMAGE_MAX_MB = 5;
export const SESSION_MEDIA_PDF_MAX_MB   = 10;

/** Common event-metadata field descriptors. Freeform jsonb so add-a-field is a one-line UI change. */
export const EVENT_METADATA_FIELDS = [
  { key: "capacity",       label: "Kapazität",        placeholder: "z.B. 20", type: "text" },
  { key: "signup_url",     label: "Anmeldung (URL)",  placeholder: "https://…",  type: "url"  },
  { key: "cost",           label: "Kosten",           placeholder: "z.B. €15 / kostenlos", type: "text" },
  { key: "age_range",      label: "Altersgruppe",     placeholder: "z.B. U12–U16", type: "text" },
  { key: "contact_name",   label: "Ansprechpartner",  placeholder: "Name",         type: "text" },
  { key: "contact_email",  label: "Kontakt (E-Mail)", placeholder: "mail@…",       type: "email" },
] as const;


export interface SessionTemplate {
  id: string;
  club_id: string;
  name: string;
  day_of_week: number | null;
  time_start: string | null;
  time_end: string | null;
  location_id: string | null;
  topic: string | null;
  topics: string[];
  session_types: string[];
  description: string | null;
  default_trainer_id: string | null;
  trainer_ids: string[];
  virtual_trainer_ids: string[];
  guest_trainers: string[];
  tags: string[];
  is_cancelled: boolean;
  color: string | null;
  sort_order: number | null;
}

export type SessionColor = "neutral" | "blue" | "yellow" | "green" | "orange" | "pink";

export const SESSION_COLORS: Record<SessionColor, { label: string; hex: string; bg: string; border: string }> = {
  neutral: { label: "Standard", hex: "#94a3b8", bg: "",                          border: "" },
  blue:    { label: "Blau",     hex: "#3b82f6", bg: "rgba(59,130,246,0.08)",     border: "rgba(59,130,246,0.35)" },
  yellow:  { label: "Gelb",     hex: "#f59e0b", bg: "rgba(245,158,11,0.08)",     border: "rgba(245,158,11,0.40)" },
  green:   { label: "Grün",     hex: "#22c55e", bg: "rgba(34,197,94,0.08)",      border: "rgba(34,197,94,0.35)" },
  orange:  { label: "Orange",   hex: "#f97316", bg: "rgba(249,115,22,0.08)",     border: "rgba(249,115,22,0.35)" },
  pink:    { label: "Pink",     hex: "#ec4899", bg: "rgba(236,72,153,0.08)",     border: "rgba(236,72,153,0.35)" },
};

export const DAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  trainer: "Trainer",
  member: "Mitglied",
};

// ── Teilnehmer (attendance tracking) ─────────────────────────────────────────

export interface Teilnehmer {
  id: string;
  club_id: string;
  name: string;
  /** Editable "member since" date — used for growth stats. YYYY-MM-DD. */
  joined_on: string;
  /** NULL = still active. When set, treated as soft-deleted (ausgetreten). */
  left_on: string | null;
  notes: string | null;
  /** Ad-hoc extensions (t-shirt size, phone, dietary, …). Free-form. */
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  // joined relations
  groups?: TeilnehmerGroup[];
}

export interface TeilnehmerGroup {
  id: string;
  club_id: string;
  name: string;
  color: string | null;
  created_at: string;
  // joined relations
  members?: Teilnehmer[];
  member_count?: number;
}

export interface TeilnehmerGroupMember {
  group_id: string;
  teilnehmer_id: string;
}

export type AttendanceStatus = "present" | "absent" | "excused";
export type AttendanceMethod = "qr" | "manual";
export type ExpectedAttendance = "everyone" | "groups" | "open";

export interface SessionAttendance {
  id: string;
  session_id: string;
  teilnehmer_id: string;
  status: AttendanceStatus;
  checked_in_at: string;
  checked_in_by: string | null;
  method: AttendanceMethod;
  // joined
  teilnehmer?: Teilnehmer;
}

export interface SessionExpectedGroup {
  session_id: string;
  group_id: string;
  teilnehmer_groups?: TeilnehmerGroup;
}

/** QR code payload — encoded on every Teilnehmer card */
export interface TeilnehmerQRPayload {
  id: string;   // Teilnehmer UUID
  name: string; // display name (for add-by-scan flow)
}

// ── Trainer availability (absence windows) ───────────────────────────────────

export type AbsenceReason = "sick" | "vacation" | "other";

export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  sick: "Krank",
  vacation: "Urlaub",
  other: "Abwesend",
};

export interface TrainerAvailability {
  id: string;
  club_id: string;
  user_id: string | null;
  virtual_trainer_id: string | null;
  start_date: string; // YYYY-MM-DD, inclusive
  end_date: string;   // YYYY-MM-DD, inclusive
  reason: AbsenceReason;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const SUGGESTED_TAGS = [
  "Technik",
  "Taktik",
  "Kondition",
  "Kraft",
  "Ausdauer",
  "Teamtraining",
  "Anfänger",
  "Fortgeschritten",
  "Kinder",
  "Erwachsene",
  "Wettkampfvorbereitung",
];
