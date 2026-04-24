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
  created_by: string;
  created_at: string;
  updated_at: string;
  training_sessions?: TrainingSession[];
}

export interface ClubTopic {
  id: string;
  club_id: string;
  name: string;
  created_at: string;
}

export interface ClubSessionType {
  id: string;
  club_id: string;
  name: string;
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
  created_at: string;
  updated_at: string;
  locations?: Location;
  profiles?: Profile; // trainer profile (deprecated, use session_trainers)
  session_trainers?: SessionTrainer[];
}


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
