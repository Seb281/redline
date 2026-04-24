/**
 * Sample German permanent employment contract (unbefristeter Arbeitsvertrag).
 *
 * Designed to exercise jurisdiction-aware analysis under German labor law:
 *   - Six-month probation at the statutory ceiling (BGB §622 Abs. 3)
 *   - Overtime flat-rate clause covering all extra hours (BGB §307 AGB
 *     transparency — likely invalid as unbounded)
 *   - Post-contractual non-compete with under-statutory Karenzentschädigung
 *     (HGB §74 Abs. 2 requires at least half the last gross remuneration;
 *     contract stipulates 25%)
 *   - Broad IP-assignment language covering free-time inventions
 *     (ArbnErfG §§4–5 — conflicts with the distinction between
 *     Diensterfindungen and freie Erfindungen)
 *   - Liquidated-damages clause (Vertragsstrafe) pegged at three monthly
 *     salaries (BGB §307 Inhaltskontrolle — potentially excessive AGB)
 *   - GDPR employee-data-processing notice
 *   - Gerichtsstand + anwendbares Recht Frankfurt am Main
 *
 * SP-2 statute coverage:
 *   - DE_KARENZENTSCHAEDIGUNG → §11 Wettbewerbsverbot (compensation
 *     below the statutory half-salary minimum)
 *   - DE_ARBNERFG → §12 Erfindungen (assignment of freie Erfindungen)
 *   - DE_BGB_307 → §6 Überstunden-Pauschale, §13 Vertragsstrafe
 *   - DE_BGB_276 not triggered (no liability carve-out in an
 *     employment contract; retained on the DE allowlist for the SaaS
 *     archetype only)
 *   - EU_GDPR → §15 Datenschutz
 *
 * Snapshot harness assertions: must detect "DE" / "Germany" as
 * jurisdiction, identify both parties, and surface "non_compete" as
 * high risk (missing statutory Karenzentschädigung level).
 */

import type { UploadResponse } from "@/types";

export const DE_EMPLOYMENT_TEXT = `\
UNBEFRISTETER ARBEITSVERTRAG

Zwischen

Sudenberg Technologies GmbH, eingetragen im Handelsregister des Amtsgerichts \
Frankfurt am Main unter HRB 118 342, vertreten durch den Geschäftsführer Herrn \
Dr. Tobias Weiß, Mainzer Landstraße 47, 60329 Frankfurt am Main (nachfolgend \
"Arbeitgeberin")

und

Herrn Dr. Maximilian Vogt, geboren am 4. Februar 1989 in Leipzig, deutsche \
Staatsangehörigkeit, wohnhaft Bornheimer Landwehr 112, 60385 Frankfurt am Main, \
Sozialversicherungsnummer 25 040289 V 123 (nachfolgend "Arbeitnehmer")

wird folgender Arbeitsvertrag geschlossen:

§ 1 TÄTIGKEIT UND EINSTIEG

Der Arbeitnehmer wird ab dem 1. August 2026 als Senior Data Engineer in \
Vollzeit eingestellt. Er ist dem Leiter der Abteilung Data Platform direkt \
unterstellt. Die Arbeitgeberin behält sich vor, dem Arbeitnehmer auch andere \
seiner Vorbildung und seinen Fähigkeiten entsprechende zumutbare Tätigkeiten \
zuzuweisen.

§ 2 PROBEZEIT

Die ersten sechs (6) Monate des Arbeitsverhältnisses gelten als Probezeit. \
Während der Probezeit kann das Arbeitsverhältnis von beiden Seiten mit einer \
Frist von zwei (2) Wochen gekündigt werden (§ 622 Abs. 3 BGB).

§ 3 ARBEITSZEIT

Die regelmäßige wöchentliche Arbeitszeit beträgt vierzig (40) Stunden, verteilt \
auf fünf (5) Arbeitstage von Montag bis Freitag. Beginn, Ende und Pausen der \
Arbeitszeit richten sich nach den betrieblichen Bedürfnissen.

§ 4 VERGÜTUNG

(1) Der Arbeitnehmer erhält ein jährliches Bruttogehalt von fünfundachtzigtausend \
Euro (85.000 €), zahlbar in dreizehn (13) gleichen Monatsraten. Das dreizehnte \
Monatsgehalt wird hälftig mit dem Juni- und dem Novembergehalt ausgezahlt.

(2) Die Vergütung wird jeweils zum Monatsende auf das vom Arbeitnehmer benannte \
Konto überwiesen.

§ 5 URLAUB

Der Arbeitnehmer hat Anspruch auf einen Jahresurlaub von fünfundzwanzig (25) \
Arbeitstagen. Die Urlaubsplanung ist mit dem Vorgesetzten abzustimmen.

§ 6 ÜBERSTUNDEN

Mit dem in § 4 vereinbarten Bruttogehalt sind sämtliche vom Arbeitnehmer \
geleisteten Überstunden, Mehrarbeit, Sonn- und Feiertagsarbeit sowie \
Bereitschaftsdienste vollständig und abschließend abgegolten. Ein gesonderter \
Überstundenausgleich in Geld oder Freizeit findet nicht statt.

§ 7 ARBEITSUNFÄHIGKEIT

Im Fall der durch Krankheit verursachten Arbeitsunfähigkeit hat der Arbeitnehmer \
die Arbeitgeberin unverzüglich zu unterrichten und bei einer Dauer von mehr als \
drei (3) Kalendertagen eine ärztliche Arbeitsunfähigkeitsbescheinigung \
vorzulegen. Die Lohnfortzahlung richtet sich nach dem Entgeltfortzahlungsgesetz \
(EntgFG).

§ 8 NEBENTÄTIGKEITEN

Der Arbeitnehmer darf entgeltliche oder unentgeltliche Nebentätigkeiten \
jeglicher Art nur mit vorheriger schriftlicher Zustimmung der Arbeitgeberin \
ausüben. Die Zustimmung wird erteilt, soweit berechtigte betriebliche Belange \
nicht entgegenstehen.

§ 9 GEHEIMHALTUNG

Der Arbeitnehmer verpflichtet sich, über alle Geschäfts- und Betriebs­geheimnisse \
sowie sonstige vertrauliche Informationen, die ihm im Rahmen seiner Tätigkeit \
bekannt werden, Stillschweigen zu bewahren. Diese Verpflichtung besteht auch \
nach Beendigung des Arbeitsverhältnisses für die Dauer von fünf (5) Jahren \
unbegrenzt fort.

§ 10 ARBEITNEHMERSCHUTZRECHTLICHE VORSCHRIFTEN

Die Vorschriften des Arbeitsschutzgesetzes, des Arbeitszeitgesetzes sowie der \
einschlägigen berufsgenossenschaftlichen Unfallverhütungs­vorschriften werden \
beiderseits beachtet.

§ 11 NACHVERTRAGLICHES WETTBEWERBSVERBOT

(1) Der Arbeitnehmer verpflichtet sich, nach Beendigung des \
Arbeitsverhältnisses für die Dauer von zwölf (12) Monaten keine Tätigkeit für \
ein Unternehmen auszuüben, das mit der Arbeitgeberin in unmittelbarem oder \
mittelbarem Wettbewerb steht. Das Verbot erstreckt sich räumlich auf das gesamte \
Gebiet der Europäischen Union und sachlich auf alle Geschäftsfelder, in denen \
die Arbeitgeberin zum Zeitpunkt des Ausscheidens tätig ist.

(2) Als Karenzentschädigung zahlt die Arbeitgeberin für die Dauer des \
Wettbewerbsverbots monatlich fünfundzwanzig Prozent (25 %) der vom Arbeitnehmer \
zuletzt bezogenen monatlichen Bruttovergütung.

(3) Die Arbeitgeberin ist berechtigt, auf das Wettbewerbsverbot bis zur \
Beendigung des Arbeitsverhältnisses durch schriftliche Erklärung zu verzichten.

§ 12 ERFINDUNGEN UND GEISTIGES EIGENTUM

Sämtliche Erfindungen, Entwicklungen, urheberrechtlich geschützten Werke und \
sonstigen Arbeitsergebnisse, die der Arbeitnehmer während der Dauer des \
Arbeitsverhältnisses schafft – gleichgültig, ob sie in unmittelbarem Zusammenhang \
mit seiner Tätigkeit stehen oder in der Freizeit entstehen – gehen mit ihrer \
Entstehung vollständig und ausschließlich auf die Arbeitgeberin über. Eine \
gesonderte Vergütung für Diensterfindungen wird nicht geschuldet.

§ 13 VERTRAGSSTRAFE

Für jeden Fall des schuldhaften Verstoßes gegen die Geheimhaltungspflicht (§ 9), \
gegen das nachvertragliche Wettbewerbsverbot (§ 11) oder gegen die \
Erfinderregelung (§ 12) ist der Arbeitnehmer verpflichtet, eine Vertragsstrafe \
in Höhe von drei (3) Bruttomonatsgehältern an die Arbeitgeberin zu zahlen. Die \
Geltendmachung weitergehenden Schadensersatzes bleibt der Arbeitgeberin \
vorbehalten.

§ 14 KÜNDIGUNG

(1) Nach Ablauf der Probezeit kann das Arbeitsverhältnis von beiden Seiten mit \
einer Frist von drei (3) Monaten zum Monatsende gekündigt werden; die \
gesetzlichen Kündigungsfristen nach § 622 Abs. 2 BGB bleiben für die \
Arbeitgeberin unberührt.

(2) Jede Kündigung bedarf der Schriftform.

§ 15 DATENSCHUTZ

Die Arbeitgeberin erhebt, verarbeitet und nutzt personenbezogene Daten des \
Arbeitnehmers ausschließlich zum Zweck der Durchführung, Abwicklung und \
Beendigung des Arbeitsverhältnisses sowie zur Erfüllung gesetzlicher \
Verpflichtungen, insbesondere nach Maßgabe der DSGVO (Verordnung (EU) 2016/679) \
und des BDSG. Der Arbeitnehmer ist über seine Rechte nach Art. 12–22 DSGVO \
gesondert informiert worden; zuständiger Ansprechpartner ist die Datenschutz­beauftragte \
der Arbeitgeberin (dsb@sudenberg.tech).

§ 16 SCHLUSSBESTIMMUNGEN

(1) Änderungen und Ergänzungen dieses Vertrages bedürfen zu ihrer Wirksamkeit \
der Schriftform. Dies gilt auch für die Aufhebung der Schriftformklausel.

(2) Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam \
sein oder werden, so wird die Wirksamkeit der übrigen Bestimmungen hiervon \
nicht berührt. An die Stelle der unwirksamen Bestimmung tritt eine Regelung, \
die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.

(3) Es gilt ausschließlich das Recht der Bundesrepublik Deutschland. \
Ausschließlicher Gerichtsstand für alle Streitigkeiten aus und im Zusammenhang \
mit diesem Vertrag ist, soweit gesetzlich zulässig, Frankfurt am Main.

Frankfurt am Main, den 26. Mai 2026

________________________                  ________________________
Dr. Tobias Weiß                           Dr. Maximilian Vogt
Sudenberg Technologies GmbH               Arbeitnehmer`;

export const DE_EMPLOYMENT_UPLOAD: UploadResponse = {
  filename: "sample-arbeitsvertrag.pdf",
  file_type: "pdf",
  page_count: 4,
  extracted_text: DE_EMPLOYMENT_TEXT,
  char_count: DE_EMPLOYMENT_TEXT.length,
  text_source: "native",
};
