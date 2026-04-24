/**
 * Sample French commercial lease (bail commercial) under the statutory
 * regime of Code de commerce L.145-1 et seq.
 *
 * Designed to exercise jurisdiction-aware analysis under French commercial
 * tenancy law — a B2B archetype distinct from the other fixtures in the
 * corpus:
 *   - Monoactivity destination clause constraining déspécialisation
 *     (L.145-47) — not unlawful per se, but a material restriction
 *   - Charges transfer wholesale to the preneur including taxe foncière
 *     and gros entretien (Loi Pinel 2014-626 requires itemization and
 *     prohibits transfer of article 606 Code civil repairs — clause
 *     réputée non écrite in so far as it contradicts L.145-40-2)
 *   - Clause résolutoire triggered on unpaid rent after a one-month
 *     commandement — statutory mechanic but procedurally strict
 *   - Clause pénale fixing a 15% penalty on arrears (Code civil
 *     art. 1231-5 — judicially revisable if manifestly excessive)
 *   - Blanket ban on assignment that purports to extend to an
 *     acquéreur du fonds de commerce (L.145-16 — any clause forbidding
 *     assignment to the fonds buyer is nulle)
 *   - Unbalanced restitution clause transferring all improvements
 *     without indemnity (Code civil art. 1171 — adhesion imbalance in
 *     a non-negotiated boilerplate agreement)
 *   - GDPR data-processing notice for preneur contact + financial data
 *
 * SP-2 statute coverage:
 *   - FR_CC_1171 → §11 Restitution and §4 Destination (adhesion imbalance)
 *   - FR_CC_1231_5 → §9 Clause pénale (15% penalty revisable)
 *   - FR_CCOM_L442_1 → §10 Termination provisions (B2B abrupt termination
 *     and significant imbalance in established commercial relationship)
 *   - FR_CODE_TRAVAIL_NONCOMPETE not triggered (employment-only)
 *   - EU_GDPR → §14 Protection des données
 *   - Code de commerce L.145-* articles sit outside the 33-entry
 *     allowlist; Pass 2 emits `general_principle` fallback for those
 *     (the 2026-Q2 allowlist review intentionally omitted them to
 *     keep the frontend catalog focused — see applicable-law.ts).
 *
 * Snapshot harness assertions: must detect "FR" / "France" as
 * jurisdiction, identify both parties (SCI bailleur + SARL preneur),
 * and surface at least one high-risk clause among §8 Clause résolutoire,
 * §9 Clause pénale, and §11 Restitution.
 */

import type { UploadResponse } from "@/types";

export const FR_COMMERCIAL_LEASE_TEXT = `\
BAIL COMMERCIAL

Entre les soussignés :

La SCI Kervadec, société civile immobilière au capital de 200 000 €, \
immatriculée au RCS de Paris sous le numéro 821 439 557, dont le siège social \
est situé 3 rue du Bac, 75007 Paris, représentée par son gérant Monsieur \
Éric Kervadec, ci-après dénommée « le Bailleur »,

ET

La société Moulinette Bistrot SARL, société à responsabilité limitée au \
capital de 30 000 €, immatriculée au RCS de Paris sous le numéro 902 118 364, \
dont le siège social est situé 12 rue de Lappe, 75011 Paris, représentée par \
sa gérante Madame Hélène Dubreuil, ci-après dénommée « le Preneur »,

IL A ÉTÉ CONVENU CE QUI SUIT :

ARTICLE 1 — DÉSIGNATION DES LOCAUX

Le Bailleur donne à bail au Preneur, qui accepte, un local commercial situé \
en rez-de-chaussée et sous-sol d'un immeuble sis 42 rue du Faubourg \
Saint-Antoine, 75011 Paris, d'une superficie totale de cent vingt-cinq \
(125) m² (dont 85 m² en rez-de-chaussée et 40 m² en sous-sol), tel que figurant \
au plan annexé au présent bail. Les locaux sont destinés à recevoir du public \
et bénéficient d'une vitrine sur rue d'une longueur de 6,20 mètres.

ARTICLE 2 — DURÉE DU BAIL

Le présent bail est conclu pour une durée de neuf (9) années entières et \
consécutives qui commencent à courir le 1er juillet 2026 pour se terminer le \
30 juin 2035. Conformément à l'article L.145-4 du Code de commerce, le Preneur \
a la faculté de donner congé à l'expiration de chaque période triennale, sous \
réserve d'un préavis de six (6) mois signifié par acte extrajudiciaire ou par \
lettre recommandée avec accusé de réception.

ARTICLE 3 — DESTINATION DES LOCAUX

Les locaux sont exclusivement destinés à l'exploitation d'une activité de \
restauration traditionnelle et de débit de boissons sur place, à l'exclusion \
de toute autre activité. Toute modification de la destination, même partielle, \
requerra l'accord préalable et écrit du Bailleur et suivra la procédure de \
déspécialisation prévue aux articles L.145-47 et suivants du Code de commerce. \
Le Preneur fera son affaire personnelle de l'obtention de toutes autorisations \
administratives, notamment la licence IV et l'autorisation de terrasse.

ARTICLE 4 — LOYER ET INDEXATION

(1) Le loyer annuel est fixé à quarante-huit mille euros (48 000 €) hors taxes \
et hors charges, payable trimestriellement et d'avance, le premier jour de \
chaque trimestre civil, soit douze mille euros (12 000 €) par trimestre.

(2) Le loyer sera indexé automatiquement chaque année à la date anniversaire \
de la prise d'effet du bail sur la variation annuelle de l'Indice des Loyers \
Commerciaux (ILC) publié par l'INSEE, l'indice de base étant celui du trimestre \
précédant la prise d'effet du bail.

(3) En cas de suppression de l'ILC, les parties conviennent de lui substituer \
l'indice qui s'en rapprocherait le plus, à défaut de quoi la révision se fera \
conformément à l'article L.145-38 du Code de commerce.

ARTICLE 5 — DÉPÔT DE GARANTIE

Le Preneur remet à la signature des présentes un dépôt de garantie d'un montant \
de douze mille euros (12 000 €), soit l'équivalent de trois (3) mois de loyer \
hors taxes et hors charges. Ce dépôt sera restitué au Preneur à l'expiration du \
bail, déduction faite des sommes éventuellement dues au Bailleur et sous \
réserve de la remise des locaux en parfait état.

ARTICLE 6 — CHARGES, IMPÔTS ET TRAVAUX

(1) Le Preneur remboursera au Bailleur, à titre de provisions trimestrielles \
avec régularisation annuelle, l'ensemble des charges de copropriété, taxes \
locatives, taxe d'enlèvement des ordures ménagères ainsi que la taxe foncière \
et ses taxes accessoires.

(2) Le Preneur prendra à sa charge exclusive l'ensemble des réparations, \
grosses ou menues, y compris celles visées à l'article 606 du Code civil, \
ainsi que toutes les mises aux normes et travaux de conformité qui seraient \
exigés par l'administration durant le cours du bail.

(3) Le Preneur maintiendra les locaux en parfait état d'entretien pendant toute \
la durée du bail.

ARTICLE 7 — CESSION ET SOUS-LOCATION

(1) Toute cession du présent bail, y compris au profit d'un acquéreur du \
fonds de commerce exploité dans les locaux, est strictement interdite sans \
l'agrément préalable et écrit du Bailleur, lequel pourra refuser son agrément \
de manière discrétionnaire et sans motivation.

(2) La sous-location, totale ou partielle, est également interdite en toute \
hypothèse.

(3) Toute cession ou sous-location consentie en violation des alinéas \
précédents entraînera la résiliation de plein droit du présent bail.

ARTICLE 8 — CLAUSE RÉSOLUTOIRE

À défaut de paiement d'un seul terme de loyer, de provision sur charges ou de \
toute autre somme exigible au titre du présent bail à son échéance, et un (1) \
mois après un commandement de payer demeuré infructueux signifié par acte \
extrajudiciaire visant expressément la présente clause, le bail sera résilié \
de plein droit, sans qu'il soit besoin d'une décision de justice. Le Preneur \
devra quitter les lieux sous huitaine et, à défaut, pourra en être expulsé sur \
simple ordonnance de référé.

ARTICLE 9 — CLAUSE PÉNALE

Toute somme due au Bailleur et non réglée à son échéance portera de plein droit \
et sans mise en demeure préalable intérêt au taux d'intérêt légal majoré de \
cinq (5) points. En outre, à titre de clause pénale, le Preneur devra au \
Bailleur une indemnité forfaitaire égale à quinze pour cent (15 %) des sommes \
dues, avec un minimum de mille euros (1 000 €) par échéance impayée, étant \
expressément convenu que le Bailleur renonce par avance à toute demande de \
modération de cette clause pénale.

ARTICLE 10 — RÉSILIATION ANTICIPÉE POUR INEXÉCUTION

Outre les cas prévus à l'article 8, le Bailleur pourra, à son entière \
discrétion, résilier le présent bail avec un préavis de trente (30) jours en \
cas de manquement du Preneur à l'une quelconque de ses obligations, sans que \
le Preneur ne puisse prétendre à une quelconque indemnité, ni au versement \
d'une indemnité d'éviction au titre de l'article L.145-14 du Code de commerce, \
lequel droit est réputé expressément exclu par les parties.

ARTICLE 11 — RESTITUTION DES LOCAUX

À l'expiration du bail, pour quelque cause que ce soit, le Preneur devra \
restituer les locaux en parfait état d'entretien. Toutes les améliorations, \
embellissements et installations fixes qui auraient été réalisés par le \
Preneur au cours du bail deviendront la propriété du Bailleur sans indemnité \
ni récompense d'aucune sorte, le Bailleur conservant toutefois la faculté \
d'exiger la remise en l'état initial aux frais exclusifs du Preneur.

ARTICLE 12 — ASSURANCES

Le Preneur s'engage à souscrire et à maintenir en vigueur pendant toute la \
durée du bail, auprès d'une compagnie notoirement solvable, toutes polices \
d'assurance utiles couvrant les locaux, leur contenu, sa responsabilité civile \
d'exploitant et le risque perte d'exploitation. Le Preneur justifiera \
annuellement du paiement des primes au Bailleur.

ARTICLE 13 — DROIT DE PRÉEMPTION

Conformément à l'article L.145-46-1 du Code de commerce, en cas de vente du \
local objet du présent bail, le Bailleur informera le Preneur de son projet \
par lettre recommandée avec accusé de réception, indiquant le prix et les \
conditions de la vente envisagée. Le Preneur disposera d'un délai d'un (1) mois \
à compter de la réception de cette notification pour exercer son droit de \
préemption.

ARTICLE 14 — PROTECTION DES DONNÉES PERSONNELLES

Conformément au Règlement (UE) 2016/679 (RGPD), le Bailleur informe le Preneur \
que les données personnelles de son représentant légal collectées à l'occasion \
de la conclusion et de l'exécution du présent bail sont traitées aux seules \
fins de gestion locative, de comptabilité et de recouvrement. Les personnes \
concernées disposent d'un droit d'accès, de rectification, d'effacement et \
d'opposition auprès du Bailleur (rgpd@sci-kervadec.fr).

ARTICLE 15 — DROIT APPLICABLE ET JURIDICTION COMPÉTENTE

Le présent bail est soumis au droit français et notamment aux dispositions \
des articles L.145-1 et suivants du Code de commerce. Tout litige relatif à sa \
formation, son interprétation, son exécution ou sa résiliation sera de la \
compétence exclusive du Tribunal judiciaire de Paris.

Fait à Paris, en trois exemplaires originaux, le 18 mai 2026.

Pour le Bailleur                          Pour le Preneur
Éric Kervadec                             Hélène Dubreuil
Gérant, SCI Kervadec                      Gérante, Moulinette Bistrot SARL`;

export const FR_COMMERCIAL_LEASE_UPLOAD: UploadResponse = {
  filename: "sample-bail-commercial.pdf",
  file_type: "pdf",
  page_count: 5,
  extracted_text: FR_COMMERCIAL_LEASE_TEXT,
  char_count: FR_COMMERCIAL_LEASE_TEXT.length,
  text_source: "native",
};
