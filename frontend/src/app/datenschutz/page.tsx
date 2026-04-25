import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Kurs.Y",
  description: "Datenschutzerklärung gemäß DSGVO für die Kurs.Y Plattform",
};

export default function DatenschutzPage() {
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
            Datenschutzerklärung
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Präambel */}
        <section id="praembel" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Präambel
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              Mit der folgenden Datenschutzerklärung möchten wir Sie darüber aufklären, welche
              Arten Ihrer personenbezogenen Daten (nachfolgend auch kurz als &bdquo;Daten&ldquo;
              bezeichnet) wir zu welchen Zwecken und in welchem Umfang im Rahmen der
              Bereitstellung unserer Applikation verarbeiten.
            </p>
            <p>Die verwendeten Begriffe sind nicht geschlechtsspezifisch.</p>
            <p className="text-foreground/60">Stand: 25. April 2026</p>
          </div>
        </section>

        {/* Inhaltsübersicht */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inhaltsübersicht
          </h2>
          <nav className="text-sm leading-relaxed space-y-1.5">
            {[
              { href: "#praembel", label: "Präambel" },
              { href: "#verantwortlicher", label: "Verantwortlicher" },
              { href: "#uebersicht", label: "Übersicht der Verarbeitungen" },
              { href: "#rechtsgrundlagen", label: "Maßgebliche Rechtsgrundlagen" },
              { href: "#sicherheit", label: "Sicherheitsmaßnahmen" },
              { href: "#uebermittlung", label: "Übermittlung von personenbezogenen Daten" },
              { href: "#speicherung", label: "Allgemeine Informationen zur Datenspeicherung und Löschung" },
              { href: "#rechte", label: "Rechte der betroffenen Personen" },
              { href: "#webhosting", label: "Bereitstellung des Onlineangebots und Webhosting" },
              { href: "#registrierung", label: "Registrierung, Anmeldung und Nutzerkonto" },
              { href: "#aenderung", label: "Änderung und Aktualisierung" },
              { href: "#begriffe", label: "Begriffsdefinitionen" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="block text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                {label}
              </a>
            ))}
          </nav>
        </section>

        {/* Verantwortlicher */}
        <section id="verantwortlicher" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Verantwortlicher
          </h2>
          <div className="text-sm leading-relaxed space-y-1">
            <p className="font-semibold text-foreground">Edward Schmuhl</p>
            <p className="text-muted-foreground">Lynarstr 27</p>
            <p className="text-muted-foreground">13585 Berlin</p>
            <p className="mt-2 text-muted-foreground">
              E-Mail:{" "}
              <a href="mailto:edwardschmuhl@web.de" className="text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity">
                edwardschmuhl@web.de
              </a>
            </p>
            <p className="text-muted-foreground">
              Impressum:{" "}
              <Link href="/impressum" className="text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity">
                kursy.app/impressum
              </Link>
            </p>
          </div>
        </section>

        {/* Übersicht der Verarbeitungen */}
        <section id="uebersicht" className="space-y-4 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Übersicht der Verarbeitungen
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Die nachfolgende Übersicht fasst die Arten der verarbeiteten Daten und die Zwecke
            ihrer Verarbeitung zusammen und verweist auf die betroffenen Personen.
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-foreground mb-1.5">Arten der verarbeiteten Daten</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Bestandsdaten</li>
                <li>Kontaktdaten</li>
                <li>Inhaltsdaten</li>
                <li>Nutzungsdaten</li>
                <li>Meta-, Kommunikations- und Verfahrensdaten</li>
                <li>Protokolldaten</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1.5">Kategorien betroffener Personen</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Nutzer (Vereinsadmins, Trainer)</li>
                <li>Vereinsmitglieder und Trainingsteilnehmer</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1.5">Zwecke der Verarbeitung</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Sicherheitsmaßnahmen</li>
                <li>Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit</li>
                <li>Informationstechnische Infrastruktur</li>
                <li>Bereitstellung von Nutzerkonten und Applikationsfunktionen</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Rechtsgrundlagen */}
        <section id="rechtsgrundlagen" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Maßgebliche Rechtsgrundlagen
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              Im Folgenden erhalten Sie eine Übersicht der Rechtsgrundlagen der DSGVO, auf
              deren Basis wir personenbezogene Daten verarbeiten. Bitte nehmen Sie zur Kenntnis,
              dass neben den Regelungen der DSGVO nationale Datenschutzvorgaben in Ihrem bzw.
              unserem Wohn- oder Sitzland gelten können.
            </p>
            <ul className="space-y-2">
              <li>
                <strong className="text-foreground">Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO)</strong> –
                Die Verarbeitung ist für die Erfüllung eines Vertrags, dessen Vertragspartei die
                betroffene Person ist, oder zur Durchführung vorvertraglicher Maßnahmen
                erforderlich. Gilt für die Bereitstellung des Nutzerkontos und der
                Plattformfunktionen.
              </li>
              <li>
                <strong className="text-foreground">Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO)</strong> –
                Die Verarbeitung ist zur Wahrung der berechtigten Interessen des Verantwortlichen
                oder eines Dritten notwendig, vorausgesetzt, dass die Interessen, Grundrechte und
                Grundfreiheiten der betroffenen Person nicht überwiegen. Gilt insbesondere für
                Sicherheitsmaßnahmen und die Verarbeitung von Protokolldaten.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Nationale Datenschutzregelungen in Deutschland:</strong>{" "}
              Zusätzlich zu den Datenschutzregelungen der DSGVO gelten nationale Regelungen zum
              Datenschutz in Deutschland. Hierzu gehört insbesondere das Bundesdatenschutzgesetz
              (BDSG), das Spezialregelungen zum Auskunftsrecht, Löschungsrecht,
              Widerspruchsrecht sowie zur Verarbeitung besonderer Kategorien personenbezogener
              Daten enthält.
            </p>
          </div>
        </section>

        {/* Sicherheitsmaßnahmen */}
        <section id="sicherheit" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sicherheitsmaßnahmen
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              Wir treffen nach Maßgabe der gesetzlichen Vorgaben unter Berücksichtigung des
              Stands der Technik, der Implementierungskosten und der Art, des Umfangs, der
              Umstände und der Zwecke der Verarbeitung geeignete technische und organisatorische
              Maßnahmen, um ein dem Risiko angemessenes Schutzniveau zu gewährleisten.
            </p>
            <p>
              Zu den Maßnahmen gehören insbesondere die Sicherung der Vertraulichkeit, Integrität
              und Verfügbarkeit von Daten durch Kontrolle des physischen und logischen Zugangs
              zu den Daten. Ferner berücksichtigen wir den Schutz personenbezogener Daten bereits
              bei der Entwicklung und Auswahl von Hardware, Software sowie Verfahren entsprechend
              dem Prinzip des Datenschutzes durch Technikgestaltung und datenschutzfreundliche
              Voreinstellungen.
            </p>
            <p>
              <strong className="text-foreground">TLS-/SSL-Verschlüsselung (HTTPS):</strong>{" "}
              Alle Datenübertragungen zwischen dem Browser des Nutzers und unseren Servern
              sind durch TLS/SSL-Verschlüsselung gesichert, erkennbar am HTTPS-Präfix in der
              URL.
            </p>
          </div>
        </section>

        {/* Übermittlung */}
        <section id="uebermittlung" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Übermittlung von personenbezogenen Daten
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Im Rahmen unserer Verarbeitung von personenbezogenen Daten werden Daten an
            folgende Dienstleister übermittelt: <strong className="text-foreground">Render Services, Inc.</strong>{" "}
            (Hosting des Frontends) und <strong className="text-foreground">Supabase Inc.</strong>{" "}
            (Datenbankbetrieb, Server in der EU). Mit beiden Dienstleistern bestehen
            Auftragsverarbeitungsverträge gemäß Art.&nbsp;28 DSGVO.
          </p>
        </section>

        {/* Datenspeicherung & Löschung */}
        <section id="speicherung" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Allgemeine Informationen zur Datenspeicherung und Löschung
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              Wir löschen personenbezogene Daten, die wir verarbeiten, gemäß den gesetzlichen
              Bestimmungen, sobald die zugrundeliegenden Einwilligungen widerrufen werden oder
              keine weiteren rechtlichen Grundlagen für die Verarbeitung bestehen. Ausnahmen
              bestehen, wenn gesetzliche Pflichten eine längere Aufbewahrung erfordern.
            </p>
            <p>
              Personenbezogene Daten werden gelöscht, sobald der Zweck der Verarbeitung entfallen
              ist und keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Für
              Nutzerkonten bedeutet dies: Löschung zeitnah nach Eingang einer
              Löschungsanfrage. Protokolldaten (Logfiles) werden nach spätestens 30 Tagen
              gelöscht oder anonymisiert.
            </p>
          </div>
        </section>

        {/* Rechte der betroffenen Personen */}
        <section id="rechte" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Rechte der betroffenen Personen
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              Ihnen stehen als Betroffene nach der DSGVO verschiedene Rechte zu (Art. 15–21
              DSGVO):
            </p>
            <ul className="space-y-2">
              <li>
                <strong className="text-foreground">Widerspruchsrecht:</strong> Sie haben das
                Recht, aus Gründen Ihrer besonderen Situation jederzeit gegen die Verarbeitung
                Sie betreffender personenbezogener Daten Widerspruch einzulegen.
              </li>
              <li>
                <strong className="text-foreground">Widerrufsrecht bei Einwilligungen:</strong>{" "}
                Sie haben das Recht, erteilte Einwilligungen jederzeit zu widerrufen.
              </li>
              <li>
                <strong className="text-foreground">Auskunftsrecht:</strong> Sie haben das
                Recht, eine Bestätigung darüber zu verlangen, ob betreffende Daten verarbeitet
                werden, und auf Auskunft über diese Daten sowie auf Kopie entsprechend den
                gesetzlichen Vorgaben.
              </li>
              <li>
                <strong className="text-foreground">Recht auf Berichtigung:</strong> Sie haben
                das Recht, die Vervollständigung oder Berichtigung Sie betreffender unrichtiger
                Daten zu verlangen.
              </li>
              <li>
                <strong className="text-foreground">Recht auf Löschung und Einschränkung:</strong>{" "}
                Sie haben das Recht zu verlangen, dass Sie betreffende Daten unverzüglich
                gelöscht werden, bzw. alternativ eine Einschränkung der Verarbeitung zu verlangen.
              </li>
              <li>
                <strong className="text-foreground">Recht auf Datenübertragbarkeit:</strong>{" "}
                Sie haben das Recht, Sie betreffende Daten in einem strukturierten, gängigen und
                maschinenlesbaren Format zu erhalten oder deren Übermittlung an einen anderen
                Verantwortlichen zu fordern.
              </li>
              <li>
                <strong className="text-foreground">Beschwerde bei Aufsichtsbehörde:</strong>{" "}
                Sie haben das Recht auf Beschwerde bei einer Datenschutzaufsichtsbehörde,
                insbesondere in dem Mitgliedstaat Ihres gewöhnlichen Aufenthaltsorts, wenn Sie
                der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen die DSGVO verstößt.
              </li>
            </ul>
          </div>
        </section>

        {/* Webhosting */}
        <section id="webhosting" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Bereitstellung des Onlineangebots und Webhosting
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              Wir verarbeiten die Daten der Nutzer, um ihnen unsere Online-Dienste zur Verfügung
              stellen zu können. Zu diesem Zweck verarbeiten wir die IP-Adresse des Nutzers, die
              notwendig ist, um die Inhalte und Funktionen unserer Online-Dienste an den Browser
              oder das Endgerät der Nutzer zu übermitteln.
            </p>
            <p>
              Das Frontend wird über <strong className="text-foreground">Render Services, Inc.</strong>{" "}
              (San Francisco, CA, USA) gehostet. Render
              verarbeitet dabei Zugriffsdaten (IP-Adresse, Zeitstempel, aufgerufene Seiten) zum
              Zweck der Auslieferung und Absicherung des Dienstes. Mit Render besteht ein
              Auftragsverarbeitungsvertrag. Weitere Informationen:{" "}
              <a
                href="https://render.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 text-foreground hover:opacity-70 transition-opacity"
              >
                render.com/privacy
              </a>
              .
            </p>
            <p>
              Die Datenbank wird über <strong className="text-foreground">Supabase</strong>{" "}
              (Supabase Inc., USA) betrieben. Der genutzte
              Datenbankserver befindet sich innerhalb der Europäischen Union. Supabase
              verarbeitet personenbezogene Daten ausschließlich im Rahmen der Bereitstellung
              der Datenbankinfrastruktur. Mit Supabase besteht ein Auftragsverarbeitungsvertrag
              gemäß Art.&nbsp;28 DSGVO.
            </p>
            <dl className="space-y-2">
              <div>
                <dt className="font-medium text-foreground">Verarbeitete Datenarten</dt>
                <dd>
                  Nutzungsdaten, Meta- und Kommunikationsdaten, Protokolldaten (IP-Adressen,
                  Zeitangaben, Seitenaufrufe)
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Betroffene Personen</dt>
                <dd>Nutzer (Webseitenbesucher, Nutzer von Onlinediensten)</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Zwecke der Verarbeitung</dt>
                <dd>
                  Bereitstellung des Onlineangebotes, Sicherheitsmaßnahmen, IT-Infrastruktur
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Rechtsgrundlage</dt>
                <dd>Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO)</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Löschung von Logfiles</dt>
                <dd>
                  Logfile-Informationen werden für die Dauer von maximal 30 Tagen gespeichert
                  und danach gelöscht oder anonymisiert.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Registrierung, Anmeldung und Nutzerkonto */}
        <section id="registrierung" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Registrierung, Anmeldung und Nutzerkonto
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              Nutzer können ein Nutzerkonto anlegen. Im Rahmen der Registrierung werden die
              erforderlichen Pflichtangaben mitgeteilt und zu Zwecken der Bereitstellung des
              Nutzerkontos auf Grundlage vertraglicher Pflichterfüllung verarbeitet. Zu den
              verarbeiteten Daten gehören insbesondere die Anmelde-Informationen (Name,
              E-Mail-Adresse und Passwort).
            </p>
            <p>
              Die Daten der Nutzer werden für die Zwecke der Bereitstellung des Nutzerkontos
              und dessen Funktionen verwendet. Im Rahmen der Inanspruchnahme unserer
              Registrierungs- und Anmeldefunktionen sowie der Nutzung des Nutzerkontos speichern
              wir die IP-Adresse und den Zeitpunkt der jeweiligen Nutzeraktion.
            </p>
            <p>
              Die Daten werden über Supabase in der Europäischen Union gespeichert (siehe
              Abschnitt &bdquo;Bereitstellung des Onlineangebots und Webhosting&ldquo;).
            </p>
            <dl className="space-y-2 mt-1">
              <div>
                <dt className="font-medium text-foreground">Verarbeitete Datenarten</dt>
                <dd>Bestandsdaten (Name, E-Mail-Adresse); Protokolldaten (IP-Adresse, Zeitstempel)</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Betroffene Personen</dt>
                <dd>Nutzer (Vereinsadmins, Trainer)</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Zwecke der Verarbeitung</dt>
                <dd>Bereitstellung des Nutzerkontos und der Applikationsfunktionen; Sicherheitsmaßnahmen</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Aufbewahrung und Löschung</dt>
                <dd>
                  Das Nutzerkonto wird auf Anfrage des Nutzers zeitnah gelöscht. Dabei werden
                  alle personenbezogenen Daten entfernt, soweit dem keine gesetzlichen
                  Aufbewahrungspflichten entgegenstehen.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Rechtsgrundlagen</dt>
                <dd>
                  Vertragserfüllung und vorvertragliche Anfragen (Art.&nbsp;6 Abs.&nbsp;1
                  S.&nbsp;1 lit.&nbsp;b) DSGVO); Berechtigte Interessen (Art.&nbsp;6
                  Abs.&nbsp;1 S.&nbsp;1 lit.&nbsp;f) DSGVO)
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Änderung und Aktualisierung */}
        <section id="aenderung" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Änderung und Aktualisierung
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              Wir bitten Sie, sich regelmäßig über den Inhalt unserer Datenschutzerklärung zu
              informieren. Wir passen die Datenschutzerklärung an, sobald die Änderungen der von
              uns durchgeführten Datenverarbeitungen dies erforderlich machen. Wir informieren
              Sie, sobald durch die Änderungen eine Mitwirkungshandlung Ihrerseits (z.&nbsp;B.
              Einwilligung) oder eine sonstige individuelle Benachrichtigung erforderlich wird.
            </p>
          </div>
        </section>

        {/* Begriffsdefinitionen */}
        <section id="begriffe" className="space-y-3 scroll-mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Begriffsdefinitionen
          </h2>
          <dl className="text-sm leading-relaxed space-y-4">
            {[
              {
                term: "Bestandsdaten",
                def: "Wesentliche Informationen für die Identifikation und Verwaltung von Benutzerkonten und Vertragspartnern, z.&nbsp;B. Namen, Kontaktinformationen und Nutzer-IDs.",
              },
              {
                term: "Inhaltsdaten",
                def: "Informationen, die im Zuge der Erstellung und Veröffentlichung von Inhalten generiert werden, z.&nbsp;B. Trainingsbeschreibungen, Texte und Metadaten.",
              },
              {
                term: "Kontaktdaten",
                def: "Informationen zur Kommunikation mit Personen, z.&nbsp;B. Telefonnummern, Adressen und E-Mail-Adressen.",
              },
              {
                term: "Meta-, Kommunikations- und Verfahrensdaten",
                def: "Informationen über die Art und Weise der Datenverarbeitung und -übermittlung, z.&nbsp;B. Zeitstempel, IP-Adressen, Protokolleinträge.",
              },
              {
                term: "Nutzungsdaten",
                def: "Informationen darüber, wie Nutzer mit der Plattform interagieren: Seitenaufrufe, Klickpfade, Verweildauer, verwendete Geräte.",
              },
              {
                term: "Personenbezogene Daten",
                def: "Alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person beziehen (Art. 4 Nr. 1 DSGVO).",
              },
              {
                term: "Protokolldaten",
                def: "Informationen über Ereignisse und Aktivitäten in einem System, z.&nbsp;B. Zeitstempel, IP-Adressen, Fehlermeldungen.",
              },
              {
                term: "Verantwortlicher",
                def: "Die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung personenbezogener Daten entscheidet (Art. 4 Nr. 7 DSGVO).",
              },
              {
                term: "Verarbeitung",
                def: "Jeder Vorgang im Zusammenhang mit personenbezogenen Daten, z.&nbsp;B. Erheben, Speichern, Übermitteln oder Löschen (Art. 4 Nr. 2 DSGVO).",
              },
            ].map(({ term, def }) => (
              <div key={term}>
                <dt className="font-medium text-foreground">{term}</dt>
                <dd
                  className="text-muted-foreground mt-0.5"
                  dangerouslySetInnerHTML={{ __html: def }}
                />
              </div>
            ))}
          </dl>
        </section>

        <p className="text-xs text-muted-foreground/40 pt-4 border-t">
          Erstellt mit Datenschutz-Generator.de von Dr. Thomas Schwenke, angepasst für Kurs.Y.
          Stand: April 2026.
        </p>
      </main>
    </div>
  );
}
