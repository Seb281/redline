/**
 * Sample German SaaS service agreement with bundled GDPR processor (DPA)
 * addendum.
 *
 * Designed to exercise:
 *   - Auto-renewal with long notice period (high risk)
 *   - Liability cap that may conflict with BGB §276 (gross negligence carve-out)
 *   - SLA credits insufficient to cover real damages
 *   - GDPR Auftragsverarbeitungsvertrag (AVV) compliant clauses
 *   - Subprocessor approval mechanism
 *   - International data transfer to USA via Standard Contractual Clauses
 *   - Audit rights with reasonable notice
 *   - Gerichtsstand Berlin
 *
 * Snapshot harness assertions (Phase 7): must surface "data_protection" and
 * "limitation_of_liability" categories, detect "DE" / "Germany" as jurisdiction,
 * identify both parties.
 */

import type { UploadResponse } from "@/types";

export const DE_SAAS_DPA_TEXT = `\
SOFTWARE-AS-A-SERVICE VERTRAG MIT AUFTRAGSVERARBEITUNGSVEREINBARUNG

Zwischen

Northwind Software GmbH, eingetragen im Handelsregister des Amtsgerichts Berlin-Charlottenburg \
unter HRB 198472 B, vertreten durch den Geschäftsführer Herrn Lukas Hoffmann, \
Friedrichstraße 88, 10117 Berlin (nachfolgend "Anbieter")

und

Heinrichs & Koll Beratung GmbH, eingetragen im Handelsregister des Amtsgerichts München \
unter HRB 245103, vertreten durch die Geschäftsführerin Frau Annika Richter, \
Maximilianstraße 12, 80539 München (nachfolgend "Kunde")

wird folgender Vertrag geschlossen:

§ 1 VERTRAGSGEGENSTAND

Der Anbieter stellt dem Kunden die SaaS-Lösung "Northwind Analytics" gemäß der \
beigefügten Leistungsbeschreibung (Anlage 1) zur Verfügung. Der Zugang erfolgt über \
das Internet unter https://app.northwind-analytics.de.

§ 2 LAUFZEIT UND KÜNDIGUNG

(1) Der Vertrag beginnt am 1. Juni 2026 und hat eine Mindestlaufzeit von \
sechsunddreißig (36) Monaten.

(2) Der Vertrag verlängert sich automatisch um jeweils weitere zwölf (12) Monate, \
sofern er nicht mit einer Frist von neun (9) Monaten zum jeweiligen Vertragsende \
schriftlich gekündigt wird.

(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.

§ 3 VERGÜTUNG

(1) Der Kunde zahlt eine monatliche Pauschale in Höhe von achttausendvierhundert Euro \
(8.400 €) zuzüglich der gesetzlichen Umsatzsteuer.

(2) Die Vergütung ist jeweils zum 15. eines Monats im Voraus für den laufenden \
Monat fällig. Bei Zahlungsverzug werden Verzugszinsen in Höhe von neun (9) \
Prozentpunkten über dem Basiszinssatz gemäß § 247 BGB berechnet.

§ 4 SERVICE LEVEL AGREEMENT

(1) Der Anbieter gewährleistet eine durchschnittliche jährliche Verfügbarkeit von \
99,5 % gemessen pro Kalendermonat.

(2) Bei Unterschreitung der vereinbarten Verfügbarkeit erhält der Kunde \
Service-Gutschriften in Höhe von maximal fünf (5) % der monatlichen Vergütung. \
Weitergehende Schadensersatzansprüche wegen Nichteinhaltung der Verfügbarkeit sind \
ausgeschlossen.

§ 5 HAFTUNG

(1) Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des \
Körpers oder der Gesundheit sowie für Schäden, die auf einer vorsätzlichen oder \
grob fahrlässigen Pflichtverletzung des Anbieters, seiner gesetzlichen Vertreter \
oder Erfüllungsgehilfen beruhen.

(2) Im Übrigen ist die Haftung des Anbieters für Schäden, gleich aus welchem \
Rechtsgrund, auf einen Betrag in Höhe der vom Kunden in den letzten zwölf (12) \
Monaten vor dem schadensbegründenden Ereignis gezahlten Vergütung begrenzt.

(3) Die Haftung für entgangenen Gewinn, mittelbare Schäden und Folgeschäden ist \
ausgeschlossen, soweit nicht Vorsatz oder grobe Fahrlässigkeit vorliegt.

§ 6 GEHEIMHALTUNG

Beide Parteien verpflichten sich, alle im Rahmen dieses Vertrages bekannt gewordenen \
vertraulichen Informationen der jeweils anderen Partei geheim zu halten und nur für \
Zwecke dieses Vertrages zu verwenden. Diese Pflicht besteht für die Dauer von fünf \
(5) Jahren über das Vertragsende hinaus fort.

§ 7 GERICHTSSTAND UND ANWENDBARES RECHT

(1) Es gilt ausschließlich das Recht der Bundesrepublik Deutschland unter Ausschluss \
des UN-Kaufrechts (CISG).

(2) Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang \
mit diesem Vertrag ist Berlin, sofern der Kunde Kaufmann im Sinne des HGB ist.

ANLAGE 2 — AUFTRAGSVERARBEITUNGSVEREINBARUNG (AVV) GEMÄSS ART. 28 DSGVO

§ AVV-1 GEGENSTAND DER AUFTRAGSVERARBEITUNG

Der Anbieter verarbeitet im Auftrag des Kunden personenbezogene Daten ausschließlich \
zur Erbringung der vertragsgegenständlichen SaaS-Leistungen. Art und Umfang der \
Verarbeitung ergeben sich aus Anlage 1 und der vom Kunden im System hinterlegten \
Konfiguration.

§ AVV-2 KATEGORIEN BETROFFENER PERSONEN UND DATEN

Verarbeitet werden Stamm- und Kontaktdaten von Mitarbeitern des Kunden, von Endkunden \
des Kunden sowie deren Nutzungs- und Transaktionsdaten innerhalb der Plattform.

§ AVV-3 WEISUNGSGEBUNDENHEIT

Der Anbieter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte \
Weisung des Kunden. Sollte der Anbieter der Auffassung sein, dass eine Weisung gegen \
geltendes Datenschutzrecht verstößt, wird er den Kunden unverzüglich darauf hinweisen.

§ AVV-4 TECHNISCH-ORGANISATORISCHE MASSNAHMEN

Der Anbieter trifft die in Anlage 3 zu dieser AVV beschriebenen technischen und \
organisatorischen Maßnahmen gemäß Art. 32 DSGVO. Hierzu gehören insbesondere \
Verschlüsselung der Daten bei Übertragung (TLS 1.2 oder höher) und Speicherung \
(AES-256), Zugriffskontrollen, regelmäßige Pen-Tests und ein dokumentiertes \
Notfallmanagement.

§ AVV-5 UNTERAUFTRAGSVERARBEITER

(1) Der Kunde erteilt seine allgemeine Genehmigung zum Einsatz von \
Unterauftragsverarbeitern. Eine aktuelle Liste ist unter \
https://northwind-analytics.de/subprocessors abrufbar.

(2) Der Anbieter informiert den Kunden mindestens dreißig (30) Tage vor Hinzuziehung \
eines neuen Unterauftragsverarbeiters per E-Mail an dpo@heinrichs-koll.de. Der Kunde \
kann der Beauftragung innerhalb dieser Frist aus wichtigem Grund widersprechen.

§ AVV-6 INTERNATIONALE DATENÜBERMITTLUNGEN

Soweit personenbezogene Daten in Drittländer außerhalb des EWR übermittelt werden \
(insbesondere USA), erfolgt dies ausschließlich auf Grundlage der EU-Standard­vertrags­klauseln \
(Standard Contractual Clauses, SCCs, Durchführungsbeschluss (EU) 2021/914), \
ergänzt um geeignete zusätzliche Maßnahmen gemäß den Empfehlungen 01/2020 des EDSA.

§ AVV-7 BETROFFENENRECHTE

Der Anbieter unterstützt den Kunden bei der Erfüllung der Rechte betroffener \
Personen (Art. 12-23 DSGVO) durch geeignete technische und organisatorische \
Maßnahmen, soweit möglich.

§ AVV-8 MELDUNG VON DATENSCHUTZVORFÄLLEN

Der Anbieter informiert den Kunden unverzüglich, spätestens jedoch innerhalb von \
vierundzwanzig (24) Stunden, über jeden Verstoß gegen den Schutz personenbezogener \
Daten gemäß Art. 4 Nr. 12 DSGVO.

§ AVV-9 KONTROLLRECHTE DES KUNDEN

Der Kunde kann sich, mit angemessener Vorankündigung von mindestens dreißig (30) \
Tagen und höchstens einmal jährlich, von der Einhaltung der vereinbarten technischen \
und organisatorischen Maßnahmen überzeugen. Anstelle einer Vor-Ort-Prüfung akzeptiert \
der Kunde aktuelle Zertifizierungen (ISO 27001, SOC 2 Type II) sowie ein aktuelles \
Audit-Bericht eines unabhängigen Dritten.

§ AVV-10 LÖSCHUNG NACH VERTRAGSENDE

Nach Beendigung des Hauptvertrages löscht der Anbieter alle personenbezogenen Daten \
des Kunden binnen sechzig (60) Tagen, sofern keine gesetzlichen Aufbewahrungspflichten \
entgegenstehen. Auf Wunsch des Kunden werden die Daten zuvor in einem strukturierten, \
gängigen und maschinenlesbaren Format zurückgegeben.

Berlin, den 18. April 2026

________________________                  ________________________
Lukas Hoffmann                            Annika Richter
Northwind Software GmbH                   Heinrichs & Koll Beratung GmbH`;

export const DE_SAAS_DPA_UPLOAD: UploadResponse = {
  filename: "sample-saas-vertrag.pdf",
  file_type: "pdf",
  page_count: 5,
  extracted_text: DE_SAAS_DPA_TEXT,
  char_count: DE_SAAS_DPA_TEXT.length,
};
