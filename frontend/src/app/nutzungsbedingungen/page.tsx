import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen – Kurs.Y",
  description: "Allgemeine Nutzungsbedingungen für die Kurs.Y Plattform",
};

const LAST_UPDATED = "April 2026";
const CONTACT_EMAIL = "edwardschmuhl@web.de";
const PLATFORM_NAME = "Kurs.Y";
const OPERATOR = "Edward Schmuhl";

export default function NutzungsbedingungenPage() {
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
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-syne, system-ui)" }}
            >
              Nutzungsbedingungen
            </h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-10 space-y-10">

        <p className="text-sm text-muted-foreground">
          Stand: {LAST_UPDATED} · Betreiber:{" "}
          <Link href="/impressum" className="underline underline-offset-2 hover:text-foreground transition-colors">
            {OPERATOR}
          </Link>
        </p>

        {/* § 1 */}
        <Section index="1" title="Geltungsbereich">
          <p>
            Diese Nutzungsbedingungen regeln den Zugang zur und die Nutzung der Plattform{" "}
            <strong>{PLATFORM_NAME}</strong> (nachfolgend &bdquo;Plattform&ldquo;), die unter der Domain
            kursy.app sowie zugehörigen Subdomains betrieben wird. Mit der Registrierung oder
            der Nutzung der Plattform erklärst du dich mit diesen Bedingungen einverstanden.
            Wenn du diesen Bedingungen nicht zustimmst, ist die Nutzung der Plattform nicht
            gestattet.
          </p>
        </Section>

        {/* § 2 */}
        <Section index="2" title="Leistungsbeschreibung">
          <p>
            {PLATFORM_NAME} ist eine webbasierte Software zur Verwaltung von Trainingsplänen
            für Sportvereine. Die Plattform ermöglicht es Vereinen, wöchentliche Trainingspläne
            zu erstellen, zu verwalten und öffentlich oder vereinsintern bereitzustellen.
            Folgende Kernfunktionen werden angeboten:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-3 text-muted-foreground">
            <li>Erstellung und Verwaltung von Trainingsplänen</li>
            <li>Rollen- und Rechteverwaltung (Admin, Trainer, Mitglied)</li>
            <li>Einladung von Mitgliedern per E-Mail</li>
            <li>Öffentliche oder vereinsinterne Sicht auf Trainingspläne</li>
            <li>Verwaltung von Standorten und Trainern</li>
          </ul>
          <p className="mt-3">
            Der Betreiber behält sich vor, den Funktionsumfang jederzeit zu erweitern, zu
            ändern oder einzuschränken.
          </p>
        </Section>

        {/* § 3 */}
        <Section index="3" title="Registrierung und Konto">
          <p>
            Für die vollständige Nutzung der Plattform ist eine Registrierung erforderlich.
            Bei der Registrierung müssen wahrheitsgemäße Angaben gemacht werden. Die
            Zugangsdaten sind vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben
            werden. Der Nutzer ist für alle Aktivitäten verantwortlich, die unter seinem Konto
            stattfinden.
          </p>
          <p className="mt-3">
            Die Registrierung ist nur für natürliche Personen ab 16 Jahren gestattet.
            Minderjährige unter 16 Jahren benötigen die Zustimmung eines Erziehungsberechtigten.
          </p>
          <p className="mt-3">
            Der Betreiber behält sich das Recht vor, Konten bei Verstoß gegen diese
            Nutzungsbedingungen ohne Vorankündigung zu sperren oder zu löschen.
          </p>
        </Section>

        {/* § 4 */}
        <Section index="4" title="Pflichten der Nutzer">
          <p>Nutzer verpflichten sich, die Plattform nicht zu nutzen, um:</p>
          <ul className="list-disc list-inside space-y-1 mt-3 text-muted-foreground">
            <li>rechtswidrige Inhalte zu veröffentlichen oder zu verbreiten,</li>
            <li>
              andere Nutzer zu belästigen, zu bedrohen oder deren Rechte zu verletzen,
            </li>
            <li>
              die Plattform durch automatisierte Zugriffe (Bots, Scraper) zu belasten,
            </li>
            <li>
              Sicherheitsmechanismen zu umgehen oder in fremde Systeme einzudringen,
            </li>
            <li>
              Spam, Werbung oder kommerzielle Nachrichten ohne Einwilligung zu versenden.
            </li>
          </ul>
        </Section>

        {/* § 5 */}
        <Section index="5" title="Inhalte und Urheberrecht">
          <p>
            Nutzer behalten das Urheberrecht an eigenen Inhalten, die sie auf der Plattform
            einstellen (z.&nbsp;B. Trainingsinhalte, Beschreibungen). Sie räumen dem Betreiber
            jedoch das nicht-exklusive, weltweite und unentgeltliche Recht ein, diese Inhalte
            zur Bereitstellung des Dienstes zu nutzen, zu speichern und anzuzeigen.
          </p>
          <p className="mt-3">
            Nutzer sind dafür verantwortlich, dass von ihnen eingestellte Inhalte keine Rechte
            Dritter verletzen. Der Betreiber haftet nicht für urheberrechtsverletzende Inhalte
            von Nutzern.
          </p>
        </Section>

        {/* § 6 */}
        <Section index="6" title="Verfügbarkeit und Haftung">
          <p>
            Der Betreiber bemüht sich um eine hohe Verfügbarkeit der Plattform, übernimmt jedoch
            keine Garantie für eine ununterbrochene Verfügbarkeit. Geplante oder ungeplante
            Wartungsarbeiten können zu vorübergehenden Einschränkungen führen.
          </p>
          <p className="mt-3">
            Die Haftung des Betreibers ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.
            Eine Haftung für leichte Fahrlässigkeit besteht nur bei Verletzung wesentlicher
            Vertragspflichten (Kardinalpflichten). Die Haftung für mittelbare Schäden,
            Datenverluste und entgangenen Gewinn ist ausgeschlossen, soweit gesetzlich zulässig.
          </p>
        </Section>

        {/* § 7 */}
        <Section index="7" title="Datenschutz">
          <p>
            Die Verarbeitung personenbezogener Daten erfolgt gemäß der Datenschutz-Grundverordnung
            (DSGVO) und dem Bundesdatenschutzgesetz (BDSG). Weitere Informationen zur
            Datenverarbeitung findest du in unserer{" "}
            <Link href="/datenschutz" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </Section>

        {/* § 8 */}
        <Section index="8" title="Kündigung und Kontoauflösung">
          <p>
            Nutzer können ihr Konto jederzeit über die Kontoeinstellungen oder per E-Mail an{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            löschen lassen. Mit der Löschung werden alle personenbezogenen Daten gelöscht,
            soweit dem keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
          <p className="mt-3">
            Der Betreiber kann das Vertragsverhältnis mit einer Frist von 30 Tagen ohne
            Angabe von Gründen kündigen. Das Recht zur außerordentlichen Kündigung bei
            wichtigem Grund bleibt unberührt.
          </p>
        </Section>

        {/* § 9 */}
        <Section index="9" title="Änderungen der Nutzungsbedingungen">
          <p>
            Der Betreiber behält sich vor, diese Nutzungsbedingungen jederzeit zu ändern.
            Nutzer werden über wesentliche Änderungen per E-Mail oder durch einen deutlichen
            Hinweis auf der Plattform informiert. Widerspricht ein Nutzer den geänderten
            Bedingungen nicht innerhalb von 30 Tagen nach Benachrichtigung, gelten die
            geänderten Bedingungen als akzeptiert.
          </p>
        </Section>

        {/* § 10 */}
        <Section index="10" title="Anwendbares Recht und Gerichtsstand">
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
            UN-Kaufrechts. Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang
            mit diesen Nutzungsbedingungen ist, soweit gesetzlich zulässig, Berlin.
          </p>
          <p className="mt-3">
            Für Verbraucher innerhalb der EU gilt ergänzend: Die EU-Kommission stellt eine
            Plattform zur Online-Streitbeilegung bereit unter{" "}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </Section>

        {/* § 11 */}
        <Section index="11" title="Salvatorische Klausel">
          <p>
            Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam oder
            undurchführbar sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen
            davon unberührt. Die unwirksame Bestimmung gilt als durch eine wirksame Regelung
            ersetzt, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten
            kommt.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground/50 pt-4 border-t">
          Stand: {LAST_UPDATED} · Bei Fragen:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        § {index} {title}
      </h2>
      <div className="text-sm leading-relaxed text-foreground space-y-2">{children}</div>
    </section>
  );
}
