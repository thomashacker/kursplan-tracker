import type { TrainingSession, Profile, SessionColor, VirtualTrainer } from "@/types";
import { SESSION_COLORS } from "@/types";
import { formatTime } from "@/lib/utils/date";

interface Props {
  session: TrainingSession;
  trainers: Profile[];
  virtualTrainers: VirtualTrainer[];
  canEdit: boolean;
  isToday?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAttendance?: () => void;
}

export function SessionCard({ session, trainers, virtualTrainers, canEdit, isToday, onEdit, onDelete, onAttendance }: Props) {
  const cancelled = session.is_cancelled;
  const colorKey = (session.color ?? "neutral") as SessionColor;
  const colorCfg = SESSION_COLORS[colorKey] ?? SESSION_COLORS.neutral;
  const hasColor = colorKey !== "neutral" && !cancelled;

  const trainerProfiles: Profile[] = session.session_trainers?.length
    ? session.session_trainers.filter((st) => st.user_id).map((st) => trainers.find((t) => t.id === st.user_id)).filter((t): t is Profile => Boolean(t))
    : trainers.filter((t) => t.id === session.trainer_id);

  const virtualTrainerDisplays: VirtualTrainer[] = (session.session_trainers ?? [])
    .filter((st) => st.virtual_trainer_id)
    .map((st) => virtualTrainers.find((vt) => vt.id === st.virtual_trainer_id))
    .filter((vt): vt is VirtualTrainer => Boolean(vt));

  const types = session.session_types ?? [];
  const topics = session.topics ?? [];

  return (
    <div
      className={`relative rounded-xl border p-3 text-sm group transition-shadow hover:shadow-sm ${
        cancelled
          ? "border-destructive/30 bg-destructive/5 opacity-75"
          : isToday && !hasColor
          ? "border-primary/40 bg-primary/5 bg-card"
          : "border-border bg-card"
      }`}
      style={hasColor ? { backgroundColor: colorCfg.bg, borderColor: colorCfg.border } : undefined}
    >
      {/* Recurring badge */}
      {session.template_id && !session.is_modified && !cancelled && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/70 mb-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Wöchentlich
        </span>
      )}
      {session.template_id && session.is_modified && !cancelled && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 mb-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Individuell angepasst
        </span>
      )}

      {/* Cancelled badge */}
      {cancelled && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive mb-1.5">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Abgesagt
        </span>
      )}

      {/* Time */}
      <div className={`text-xs mb-1.5 font-mono ${cancelled ? "text-muted-foreground/60 line-through" : "text-muted-foreground"}`}>
        {formatTime(session.time_start)} – {formatTime(session.time_end)}
      </div>

      {/* Topic chips — prominent */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {topics.map((t) => (
            <span key={t} className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Type chips — subtle */}
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {types.map((t) => (
            <span key={t} className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Empty state when no types/topics */}
      {types.length === 0 && topics.length === 0 && (
        <p className="text-xs text-muted-foreground/60 mb-1.5 italic">Kein Typ / Thema</p>
      )}

      {/* Trainers, virtual trainers + guests */}
      {(trainerProfiles.length > 0 || virtualTrainerDisplays.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {trainerProfiles.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {t.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatar_url} alt={t.full_name} className="w-4 h-4 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                  {t.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              )}
              {t.full_name}
            </span>
          ))}
          {virtualTrainerDisplays.map((vt) => (
            <span key={vt.id} className="inline-flex items-center gap-1 text-xs text-indigo-700 dark:text-indigo-400">
              {vt.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vt.avatar_url} alt={vt.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[8px] font-bold shrink-0 text-indigo-700 dark:text-indigo-400">
                  {vt.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              )}
              {vt.name}
            </span>
          ))}
        </div>
      )}

      {/* Location */}
      {session.locations && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {session.locations.name}
        </p>
      )}

      {/* Description */}
      {session.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">{session.description}</p>
      )}

      {/* Attendance button — visible to all, subtle */}
      {onAttendance && !cancelled && (
        <button
          type="button"
          onClick={onAttendance}
          className="mt-1.5 w-full flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-1 hover:border-border/80 hover:bg-secondary/50 transition-colors"
          title="Anwesenheit erfassen"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <polyline points="16 11 18 13 22 9"/>
          </svg>
          Anwesenheit
        </button>
      )}

      {/* Edit / Delete — always visible on mobile, hover-revealed on desktop */}
      {canEdit && (
        <div className="absolute top-2 right-2 flex gap-1 md:hidden md:group-hover:flex">
          <button type="button" onClick={onEdit}
            className="w-7 h-7 md:w-6 md:h-6 flex items-center justify-center rounded-md bg-secondary/80 md:bg-transparent hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Bearbeiten">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button type="button" onClick={onDelete}
            className="w-7 h-7 md:w-6 md:h-6 flex items-center justify-center rounded-md bg-secondary/80 md:bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Löschen">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
