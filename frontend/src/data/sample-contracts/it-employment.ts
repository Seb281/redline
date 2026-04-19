/**
 * SP-2 — Sample Italian employment contract (dirigente / middle-manager tier).
 *
 * Italian jurisdiction with explicit governing-law clause so Pass 0 returns
 * source_type="stated", country="IT". Drafted to exercise several IT catalog
 * entries plus EU-wide citations.
 *
 * SP-2 statute coverage:
 *   - IT_CC_2125 (post-termination non-compete) → §10 five-year nationwide
 *     non-compete with token consideration
 *   - IT_CC_1341 (onerous clauses separate-signature) → §11 arbitration +
 *     forum selection + penalty clauses lumped into miscellaneous section
 *   - IT_CC_1229 (void exclusion for dolo/colpa grave) → §8 broad liability
 *     waiver that purports to cover gross negligence
 *   - IT_CC_1375 (good-faith execution / abuso del diritto) → §9 unilateral
 *     mobility and role-assignment discretion
 *   - EU_GDPR → §12 data-protection notice
 */

import type { UploadResponse } from "@/types";

export const IT_EMPLOYMENT_TEXT = `\
CONTRATTO INDIVIDUALE DI LAVORO SUBORDINATO A TEMPO INDETERMINATO

Tra

NovaSpark Italia S.r.l., società a responsabilità limitata di diritto \
italiano, iscritta al Registro delle Imprese di Milano al n. MI-2147865, \
codice fiscale e partita IVA 09876543210, con sede legale in Via Manzoni 31, \
20121 Milano, in persona del legale rappresentante pro tempore dott. Marco \
Bianchi, Amministratore Delegato (di seguito, "il Datore di lavoro"),

e

Sig.ra Elena Conti, nata a Firenze il 4 ottobre 1988, codice fiscale \
CNTLNE88R44D612J, residente in Via dei Pepi 18, 50122 Firenze (di seguito, \
"la Lavoratrice"),

SI CONVIENE E STIPULA QUANTO SEGUE.

ART. 1 — OGGETTO DEL CONTRATTO

La Lavoratrice è assunta con contratto di lavoro subordinato a tempo \
indeterminato, con inquadramento nel livello Quadro del CCNL Commercio, \
servizi e terziario, con decorrenza dal 1° giugno 2026, per svolgere le \
mansioni di Responsabile Sviluppo Prodotto presso la sede di Milano.

ART. 2 — PERIODO DI PROVA

Le parti convengono un periodo di prova di sei (6) mesi di effettiva \
prestazione lavorativa. Durante tale periodo ciascuna delle parti potrà \
recedere dal contratto senza preavviso e senza obbligo di motivazione.

ART. 3 — ORARIO DI LAVORO

L'orario normale di lavoro è fissato in quaranta (40) ore settimanali, \
distribuite dal lunedì al venerdì. Considerato l'inquadramento, la \
Lavoratrice è tenuta a prestare la propria opera anche oltre l'orario \
normale di lavoro, senza diritto ad alcuna maggiorazione, in funzione delle \
esigenze aziendali.

ART. 4 — RETRIBUZIONE

La retribuzione annua lorda è fissata in settantaduemila euro \
(72.000,00 €), comprensiva della tredicesima e quattordicesima mensilità, \
corrisposta in dodici (12) rate mensili posticipate.

ART. 5 — FERIE

Competono alla Lavoratrice quattro (4) settimane di ferie annue retribuite, \
da fruire compatibilmente con le esigenze organizzative e produttive \
aziendali, previa autorizzazione del superiore gerarchico.

ART. 6 — TRASFERTE

La Lavoratrice potrà essere inviata in trasferta in Italia e all'estero. Le \
spese di viaggio, vitto e alloggio saranno rimborsate a piè di lista previa \
presentazione di idonea documentazione, secondo le policy aziendali \
unilateralmente definite dal Datore di lavoro.

ART. 7 — PROPRIETÀ INTELLETTUALE

Ogni invenzione, opera dell'ingegno, software, know-how o risultato creativo \
realizzato dalla Lavoratrice nell'esecuzione del rapporto o comunque \
utilizzando mezzi o informazioni aziendali, si intende di esclusiva \
proprietà del Datore di lavoro, senza obbligo di ulteriore corrispettivo \
rispetto alla retribuzione ordinaria.

ART. 8 — LIMITAZIONE DI RESPONSABILITÀ

La Lavoratrice assume in proprio ogni responsabilità per danni arrecati al \
Datore di lavoro o a terzi, anche in caso di colpa grave o dolo, con \
espressa rinuncia a far valere nei confronti del Datore di lavoro qualsiasi \
eccezione o compensazione. La responsabilità del Datore di lavoro per \
eventuali danni subiti dalla Lavoratrice è in ogni caso limitata a una \
mensilità di retribuzione.

ART. 9 — JUS VARIANDI E CLAUSOLA DI MOBILITÀ

Il Datore di lavoro si riserva la facoltà, a propria insindacabile \
discrezione e senza necessità di specifica motivazione, di (i) modificare in \
qualsiasi momento le mansioni assegnate, anche assegnando mansioni inferiori \
rispetto a quelle di cui all'art. 1, e (ii) trasferire la Lavoratrice presso \
qualsiasi sede, filiale, cantiere o società del gruppo, in Italia o \
all'estero, con preavviso di sette (7) giorni. La Lavoratrice rinuncia sin \
d'ora a qualsiasi contestazione al riguardo.

ART. 10 — PATTO DI NON CONCORRENZA

(1) Per un periodo di cinque (5) anni successivi alla cessazione del \
rapporto, per qualsivoglia causa, la Lavoratrice si impegna a non svolgere, \
direttamente o indirettamente, alcuna attività lavorativa, imprenditoriale \
o di consulenza a favore di soggetti operanti nel settore dello sviluppo \
software, sull'intero territorio nazionale italiano e nell'ambito dell'Unione \
europea.

(2) A titolo di corrispettivo per l'assunzione del presente patto, verrà \
corrisposta alla Lavoratrice, alla cessazione del rapporto, una somma una \
tantum pari a cinquemila euro (5.000,00 €) lordi.

ART. 11 — CLAUSOLE VARIE

Le parti espressamente convengono che (i) qualsiasi controversia relativa al \
presente contratto sarà devoluta in via esclusiva al Tribunale del Lavoro di \
Milano, (ii) eventuali inadempimenti della Lavoratrice comporteranno il \
pagamento di una penale pari a tre (3) mensilità di retribuzione, (iii) il \
Datore di lavoro potrà recedere unilateralmente dal contratto con preavviso \
di quindici (15) giorni nelle ipotesi di riorganizzazione aziendale, e (iv) \
la Lavoratrice rinuncia preventivamente a qualsiasi diritto di \
contestazione del provvedimento disciplinare.

ART. 12 — TRATTAMENTO DEI DATI PERSONALI

I dati personali della Lavoratrice saranno trattati dal Datore di lavoro in \
qualità di titolare del trattamento, in conformità al Regolamento (UE) \
2016/679 ("GDPR") e al D.Lgs. 196/2003 (Codice Privacy). La Lavoratrice \
prende atto dell'informativa di cui all'art. 13 GDPR consegnata \
contestualmente al presente contratto.

ART. 13 — LEGGE APPLICABILE

Il presente contratto è disciplinato dalla legge italiana. Per quanto non \
espressamente previsto si rinvia alle disposizioni del Codice Civile, alle \
leggi speciali in materia di lavoro subordinato e al CCNL applicabile.

Milano, 18 aprile 2026.

Per il Datore di lavoro                   La Lavoratrice
dott. Marco Bianchi                       Sig.ra Elena Conti
Amministratore Delegato`;

export const IT_EMPLOYMENT_UPLOAD: UploadResponse = {
  filename: "contratto-lavoro-it.pdf",
  file_type: "pdf",
  page_count: 4,
  extracted_text: IT_EMPLOYMENT_TEXT,
  char_count: IT_EMPLOYMENT_TEXT.length,
  text_source: "native",
};
