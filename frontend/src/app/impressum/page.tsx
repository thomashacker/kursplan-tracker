import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum – Kurs.Y",
  description: "Impressum und Anbieterkennzeichnung gemäß § 5 DDG",
};

// ─────────────────────────────────────────────────────────────────────────────
// PFLICHTANGABEN HIER AUSFÜLLEN
// Alles zwischen < > muss ersetzt werden.
// ─────────────────────────────────────────────────────────────────────────────
const BETREIBER = {
  name: "Edward Schmuhl",
  strasse: "Lynarstr 27",
  plz: "13585",
  ort: "Berlin",
  land: "Deutschland",
  email: "edwardschmuhl@web.de",
  telefon: "",
  // Nur ausfüllen wenn vorhanden (sonst null lassen):
  ustIdNr: null as string | null, // z.B. "DE123456789"
  handelsregister: null as string | null, // z.B. "HRB 12345, Amtsgericht München"
  vertretungsberechtigte: null as string | null, // z.B. "Max Mustermann (Vorsitzender)"
  // Verantwortlicher für journalistische Inhalte (§ 18 Abs. 2 MStV):
  verantwortlicher: "Edward Schmuhl",
  verantwortlicherAdresse: "Lynarstr 27, 13585 Berlin",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-5 flex items-center gap-4">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← Zurück
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            Impressum
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-10 space-y-10">
        {/* § 5 DDG – Anbieterkennzeichnung */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Angaben gemäß § 5 DDG
          </h2>
          <div className="text-sm leading-relaxed space-y-0.5">
            <p className="font-semibold text-base">{BETREIBER.name}</p>
            <p>{BETREIBER.strasse}</p>
            <p>
              {BETREIBER.plz} {BETREIBER.ort}
            </p>
            <p>{BETREIBER.land}</p>
          </div>
        </section>

        {/* Kontakt */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Kontakt
          </h2>
          <div className="text-sm leading-relaxed space-y-1">
            {BETREIBER.telefon && (
              <p>
                <span className="text-muted-foreground w-20 inline-block">Telefon:</span>
                <a href={`tel:${BETREIBER.telefon.replace(/\s/g, "")}`} className="hover:underline">
                  {BETREIBER.telefon}
                </a>
              </p>
            )}
            <p>
              <span className="text-muted-foreground w-20 inline-block">E-Mail:</span>
              <a href={`mailto:${BETREIBER.email}`} className="hover:underline">
                {BETREIBER.email}
              </a>
            </p>
          </div>
        </section>

        {/* Umsatzsteuer-ID (optional) */}
        {BETREIBER.ustIdNr && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Umsatzsteuer-Identifikationsnummer
            </h2>
            <p className="text-sm leading-relaxed">
              Gemäß § 27 a Umsatzsteuergesetz:{" "}
              <span className="font-mono">{BETREIBER.ustIdNr}</span>
            </p>
          </section>
        )}

        {/* Handelsregister (optional) */}
        {BETREIBER.handelsregister && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Registereintrag
            </h2>
            <p className="text-sm leading-relaxed">
              {BETREIBER.handelsregister}
            </p>
          </section>
        )}

        {/* Vertretungsberechtigte (optional – relevant für GmbH, e.V., etc.) */}
        {BETREIBER.vertretungsberechtigte && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Vertretungsberechtigte Person
            </h2>
            <p className="text-sm leading-relaxed">
              {BETREIBER.vertretungsberechtigte}
            </p>
          </section>
        )}

        {/* § 18 Abs. 2 MStV – Verantwortlicher für Inhalte */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Verantwortlicher für den Inhalt (§ 18 Abs. 2 MStV)
          </h2>
          <div className="text-sm leading-relaxed space-y-0.5">
            <p>{BETREIBER.verantwortlicher}</p>
            <p>{BETREIBER.verantwortlicherAdresse}</p>
          </div>
        </section>

        {/* Haftungsausschluss */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Haftungsausschluss
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-4">
            <div>
              <p className="font-medium text-foreground mb-1">
                Haftung für Inhalte
              </p>
              <p>
                Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt.
                Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
                können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter
                sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen
                Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 9
                bis 11 DDG sind wir als Diensteanbieter jedoch nicht
                verpflichtet, übermittelte oder gespeicherte fremde
                Informationen zu überwachen oder nach Umständen zu forschen, die
                auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur
                Entfernung oder Sperrung der Nutzung von Informationen nach den
                allgemeinen Gesetzen bleiben hiervon unberührt.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">
                Haftung für Links
              </p>
              <p>
                Unser Angebot enthält Links zu externen Websites Dritter, auf
                deren Inhalte wir keinen Einfluss haben. Deshalb können wir für
                diese fremden Inhalte auch keine Gewähr übernehmen. Für die
                Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
                oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten
                wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
                überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der
                Verlinkung nicht erkennbar.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Urheberrecht</p>
              <p>
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
                diesen Seiten unterliegen dem deutschen Urheberrecht. Die
                Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
                Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
                schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
                Downloads und Kopien dieser Seite sind nur für den privaten,
                nicht kommerziellen Gebrauch gestattet.
              </p>
            </div>
          </div>
        </section>

        {/* EU-Streitschlichtung */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            EU-Streitschlichtung
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p>
              Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht
              bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </div>
        </section>

        {/* Datenschutz */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Datenschutz
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              Diese Website verwendet Supabase als Backend-Dienst. Beim Besuch
              der Website werden technisch notwendige Daten (z.&nbsp;B.
              IP-Adresse, Zeitpunkt des Abrufs) verarbeitet. Weitere
              Informationen zur Datenverarbeitung entnehmen Sie bitte unserer{" "}
              <Link href="/datenschutz" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Datenschutzerklärung
              </Link>
              .
            </p>
            <p>
              Hinweis: Diese Website verwendet Schriftarten, die über{" "}
              <strong>next/font</strong> selbst gehostet werden. Es findet keine
              Übertragung von Daten an Google-Server statt.
            </p>
          </div>
        </section>

        <p className="text-xs text-muted-foreground/50 pt-4 border-t">
          Stand:{" "}
          {new Date().toLocaleDateString("de-DE", {
            year: "numeric",
            month: "long",
          })}
        </p>
      </main>
    </div>
  );
}
