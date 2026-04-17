/**
 * Sample French CDI employment contract.
 *
 * Designed to exercise jurisdiction-aware analysis under French labor law:
 *   - clause de non-concurrence missing contrepartie financière (high risk)
 *   - probationary period within Code du travail bounds
 *   - 35-hour week framing with overtime provisions
 *   - mobility clause limited geographically
 *   - GDPR data-processing notice
 *   - inventions clause (Code de la propriété intellectuelle compliance)
 *   - severance and notice periods per Convention collective Syntec
 *
 * Snapshot harness assertions (Phase 7): must surface "non_compete" as high
 * risk, detect "FR" / "France" as jurisdiction, identify both parties.
 */

import type { UploadResponse } from "@/types";

export const FR_EMPLOYMENT_TEXT = `\
CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE

Entre les soussignés :

La société Datalume SAS, société par actions simplifiée au capital de 50 000 €, \
immatriculée au RCS de Paris sous le numéro 893 271 458, dont le siège social est \
situé 14 rue de Châteaudun, 75009 Paris, représentée par Mme Camille Bernard en sa \
qualité de Présidente, ci-après dénommée « la Société »,

ET

Monsieur Julien Lefèvre, né le 12 mars 1990 à Lyon, de nationalité française, \
demeurant 27 rue des Acacias, 75017 Paris, n° de sécurité sociale 1 90 03 69 123 456 78, \
ci-après dénommé « le Salarié »,

IL A ÉTÉ CONVENU CE QUI SUIT :

ARTICLE 1 — ENGAGEMENT

Le Salarié est engagé en qualité d'Ingénieur logiciel senior, statut Cadre, \
position 2.2, coefficient 130 selon la Convention collective nationale des bureaux \
d'études techniques, des cabinets d'ingénieurs-conseils et des sociétés de conseils \
(Syntec), à compter du 2 mai 2026, sous réserve des résultats de la visite médicale \
d'embauche.

ARTICLE 2 — PÉRIODE D'ESSAI

Le présent contrat est conclu sous réserve d'une période d'essai de quatre (4) mois, \
renouvelable une fois pour une durée maximale de quatre (4) mois supplémentaires sur \
accord exprès et écrit des deux parties, conformément à l'article L.1221-21 du Code \
du travail.

ARTICLE 3 — DURÉE DU TRAVAIL

La durée hebdomadaire de travail du Salarié est fixée à trente-cinq (35) heures, \
réparties sur cinq (5) jours du lundi au vendredi. Toute heure effectuée au-delà de \
cette durée hebdomadaire sera considérée comme heure supplémentaire et rémunérée \
conformément aux dispositions légales et conventionnelles applicables.

ARTICLE 4 — RÉMUNÉRATION

En contrepartie de son travail, le Salarié percevra une rémunération brute annuelle \
de cinquante-cinq mille euros (55 000 €), versée sur treize (13) mois, soit une \
rémunération brute mensuelle de quatre mille deux cent trente euros et soixante-dix \
centimes (4 230,77 €). Le treizième mois est versé en deux fractions égales en juin \
et décembre.

ARTICLE 5 — LIEU DE TRAVAIL ET CLAUSE DE MOBILITÉ

Le Salarié exercera ses fonctions au siège social de la Société à Paris. La Société \
se réserve le droit de modifier le lieu de travail du Salarié au sein de la région \
Île-de-France, sans que cette modification puisse être considérée comme un \
changement d'un élément essentiel du contrat. Toute mobilité au-delà de l'Île-de-France \
nécessitera l'accord exprès du Salarié.

ARTICLE 6 — CLAUSE DE NON-CONCURRENCE

À l'expiration du présent contrat, pour quelque cause que ce soit, le Salarié \
s'interdit pendant une durée de vingt-quatre (24) mois, sur l'ensemble du territoire \
de l'Union européenne, d'exercer toute activité professionnelle, directe ou indirecte, \
auprès de toute entreprise concurrente de la Société. Aucune contrepartie financière \
n'est prévue au titre de cette clause.

ARTICLE 7 — CLAUSE D'INVENTION

Conformément aux articles L.611-7 et suivants du Code de la propriété intellectuelle, \
toute invention réalisée par le Salarié dans l'exécution de ses missions ou dans le \
domaine d'activité de la Société appartiendra de plein droit à l'employeur. Le \
Salarié devra informer immédiatement la Société de toute invention. La Société \
s'engage à verser au Salarié une rémunération supplémentaire conformément aux \
dispositions de la Convention collective Syntec.

ARTICLE 8 — CONFIDENTIALITÉ

Le Salarié s'engage à observer la plus stricte confidentialité concernant toute \
information dont il pourrait avoir connaissance dans le cadre de ses fonctions, \
notamment les informations techniques, commerciales, financières et stratégiques \
de la Société. Cette obligation perdure pendant toute la durée du contrat ainsi \
que pendant cinq (5) années après sa cessation, pour quelque cause que ce soit.

ARTICLE 9 — PROTECTION DES DONNÉES PERSONNELLES

Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés \
modifiée, la Société informe le Salarié que ses données à caractère personnel font \
l'objet d'un traitement aux fins de gestion administrative, paie et formation. Le \
Salarié dispose d'un droit d'accès, de rectification, d'effacement et de portabilité \
de ses données auprès du Délégué à la Protection des Données (dpo@datalume.fr).

ARTICLE 10 — RUPTURE DU CONTRAT

En cas de rupture du contrat à l'initiative de l'une ou l'autre des parties après la \
période d'essai, le préavis applicable est de trois (3) mois, conformément à la \
Convention collective Syntec pour le statut Cadre. En cas de licenciement non motivé \
par une faute grave ou lourde, le Salarié percevra une indemnité de licenciement \
calculée selon les dispositions légales et conventionnelles.

ARTICLE 11 — DROIT APPLICABLE ET JURIDICTION COMPÉTENTE

Le présent contrat est soumis au droit français. Tout litige relatif à sa formation, \
son exécution ou sa rupture sera de la compétence du Conseil de Prud'hommes de Paris.

Fait à Paris, en deux exemplaires originaux, le 25 avril 2026.

Pour la Société                          Le Salarié
Camille Bernard                          Julien Lefèvre
Présidente`;

export const FR_EMPLOYMENT_UPLOAD: UploadResponse = {
  filename: "sample-contrat-cdi.pdf",
  file_type: "pdf",
  page_count: 3,
  extracted_text: FR_EMPLOYMENT_TEXT,
  char_count: FR_EMPLOYMENT_TEXT.length,
  text_source: "native",
};
