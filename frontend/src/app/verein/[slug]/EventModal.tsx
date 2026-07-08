"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import type { PublicSession } from "./PublicPlanClient";

interface Props {
  event: PublicSession | null;
  onClose: () => void;
}

const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function daysUntil(iso: string): number {
  const target = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0)  return "Vorbei";
  if (d === 0) return "Heute";
  if (d === 1) return "Morgen";
  if (d < 7)  return `in ${d} Tagen`;
  if (d < 14) return "nächste Woche";
  if (d < 30) return `in ${Math.round(d / 7)} Wochen`;
  return `in ${Math.round(d / 30)} Monaten`;
}

// ── Icons ───────────────────────────────────────────────────────────────────
const iconProps = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IconClose  = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
const IconClock  = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>);
const IconPin    = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);
const IconUsers  = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const IconEuro   = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><path d="M4 10h11"/><path d="M4 14h11"/><path d="M19 5a7 7 0 1 0 0 14"/></svg>);
const IconTarget = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>);
const IconUser   = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const IconMail   = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/></svg>);
const IconPdf    = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>);
const IconLink   = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" {...iconProps} {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>);
const IconArrow  = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M12 5l7 7-7 7"/></svg>);
const IconSpark  = (p: React.SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z"/></svg>);

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-500/12 border border-amber-500/25 flex items-center justify-center text-amber-700 dark:text-amber-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">{label}</p>
        <p className="text-sm text-foreground truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function EventModal({ event, onClose }: Props) {
  const reduced = useReducedMotion();

  // Escape to close
  useEffect(() => {
    if (!event) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        >
          <motion.div
            key="modal"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl bg-card border border-amber-500/25 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {(() => {
              const date = new Date(event.dateKey + "T00:00:00");
              const weekday = WEEKDAYS_DE[date.getDay()];
              const month = MONTHS_DE[date.getMonth()];
              const dateLong = `${weekday}, ${date.getDate()}. ${month} ${date.getFullYear()}`;
              const countdown = countdownLabel(event.dateKey);
              const soon = daysUntil(event.dateKey) <= 3;
              const meta = event.metadata;
              const heroImage  = event.media.find((m) => m.kind === "image");
              const otherMedia = event.media.filter((m) => m.kind !== "image");

              return (
                <>
                  {/* Hero image or amber banner */}
                  {heroImage ? (
                    <div className="relative w-full h-40 sm:h-48 shrink-0 bg-secondary overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImage.url} alt={heroImage.caption ?? ""} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    </div>
                  ) : (
                    <div className="relative h-16 shrink-0 bg-amber-500/10 border-b border-amber-500/20 overflow-hidden">
                      {/* Tiny spark accents */}
                      <IconSpark className="absolute top-3 left-6 w-2 h-2 text-amber-400/80" />
                      <IconSpark className="absolute top-6 right-10 w-2.5 h-2.5 text-amber-500/70" />
                      <IconSpark className="absolute bottom-2 left-1/3 w-1.5 h-1.5 text-amber-300" />
                    </div>
                  )}

                  {/* Close button (over hero) */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                    aria-label="Schließen"
                  >
                    <IconClose className="w-3.5 h-3.5" />
                  </button>

                  {/* Scrollable body */}
                  <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-5">
                    {/* Eyebrow */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-400">
                        <IconSpark className="w-3 h-3" /> Event
                      </span>
                      <span className="text-muted-foreground/50 text-[10px]">·</span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                          soon ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {soon && !reduced && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        {countdown}
                      </span>
                    </div>

                    {/* Title */}
                    <h2
                      className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-foreground"
                      style={{ fontFamily: "var(--font-syne, system-ui)" }}
                    >
                      {event.title || "Event"}
                    </h2>

                    {/* Date long */}
                    <p className="mt-1.5 text-sm text-muted-foreground">{dateLong}</p>

                    {/* Description */}
                    {event.description && (
                      <p className="mt-3 text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                        {event.description}
                      </p>
                    )}

                    {/* Info block */}
                    <div className="mt-4 divide-y divide-border/60">
                      <MetaRow
                        icon={<IconClock className="w-4 h-4" />}
                        label="Uhrzeit"
                        value={`${event.timeStart.slice(0, 5)} – ${event.timeEnd.slice(0, 5)}`}
                      />
                      {event.location && (
                        <MetaRow
                          icon={<IconPin className="w-4 h-4" />}
                          label="Ort"
                          value={
                            event.location.mapsUrl ? (
                              <a href={event.location.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {event.location.name}
                              </a>
                            ) : (
                              event.location.name
                            )
                          }
                        />
                      )}
                      {meta.capacity && (
                        <MetaRow icon={<IconUsers  className="w-4 h-4" />} label="Kapazität"     value={meta.capacity} />
                      )}
                      {meta.cost && (
                        <MetaRow icon={<IconEuro   className="w-4 h-4" />} label="Kosten"        value={meta.cost} />
                      )}
                      {meta.age_range && (
                        <MetaRow icon={<IconTarget className="w-4 h-4" />} label="Altersgruppe"  value={meta.age_range} />
                      )}
                      {meta.contact_name && (
                        <MetaRow icon={<IconUser   className="w-4 h-4" />} label="Ansprechpartner" value={meta.contact_name} />
                      )}
                      {meta.contact_email && (
                        <MetaRow
                          icon={<IconMail className="w-4 h-4" />}
                          label="Kontakt"
                          value={
                            <a href={`mailto:${meta.contact_email}`} className="text-primary hover:underline break-all">
                              {meta.contact_email}
                            </a>
                          }
                        />
                      )}
                    </div>

                    {/* Trainers — respects the club's "show trainers publicly" setting
                        (data comes empty when the toggle is off). */}
                    {event.trainers.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Trainer</p>
                        <div className="flex flex-wrap gap-2">
                          {event.trainers.map((t) => (
                            <span
                              key={t.name}
                              className="inline-flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full bg-secondary/60 border border-border text-sm text-foreground/85"
                            >
                              {t.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={t.avatarUrl} alt={t.name} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <span className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">
                                  {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="truncate max-w-[10rem]">{t.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Groups — respects the club's "show groups publicly" setting
                        (data comes empty when the toggle is off). */}
                    {event.groups && event.groups.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Gruppen</p>
                        <div className="flex flex-wrap gap-1.5">
                          {event.groups.map((g) => (
                            <span
                              key={g.name}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                              style={{
                                backgroundColor: g.color ? `${g.color}18` : undefined,
                                borderColor: g.color ? `${g.color}55` : undefined,
                                color: g.color ?? undefined,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color ?? "#94a3b8" }} />
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attachments */}
                    {otherMedia.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Anhänge</p>
                        <div className="flex flex-wrap gap-2">
                          {otherMedia.map((m) => {
                            const Icon = m.kind === "pdf" ? IconPdf : IconLink;
                            return (
                              <a
                                key={m.id}
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium text-foreground/85"
                              >
                                <Icon className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                                <span className="max-w-[12rem] truncate">{m.caption ?? (m.kind === "pdf" ? "PDF" : "Link")}</span>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CTA row (sticky-ish footer) */}
                  {meta.signup_url && (
                    <div className="p-4 sm:p-5 border-t border-border bg-background/70 backdrop-blur-sm">
                      <a
                        href={meta.signup_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
                      >
                        Anmelden
                        <IconArrow className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
