import type { TrainingSession, Profile } from "@/types";
import { formatTime } from "@/lib/utils/date";

interface Props {
  session: TrainingSession;
  trainers: Profile[];
  canEdit: boolean;
  isToday?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function SessionCard({ session, trainers, canEdit, isToday, onEdit, onDelete }: Props) {
  const cancelled = session.is_cancelled;
  const trainerProfiles: Profile[] = session.session_trainers?.length
    ? session.session_trainers.map((st) => trainers.find((t) => t.id === st.user_id)).filter((t): t is Profile => Boolean(t))
    : trainers.filter((t) => t.id === session.trainer_id);

  const types = session.session_types ?? [];
  const topics = session.topics ?? [];

  return (
    <div
      className={`relative rounded-xl border p-3 text-sm group transition-shadow hover:shadow-sm ${
        cancelled
          ? "border-destructive/30 bg-destructive/5 opacity-75"
          : isToday
          ? "border-primary/40 bg-primary/5 bg-card"
          : "border-border bg-card"
      }`}
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

      {/* Type chips */}
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {types.map((t) => (
            <span key={t} className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Topic chips */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {topics.map((t) => (
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

      {/* Trainers */}
      {trainerProfiles.length > 0 && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {trainerProfiles.map((t) => t.full_name).join(", ")}
        </p>
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
