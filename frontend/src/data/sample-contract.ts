/**
 * Sample contract text and metadata for the demo mode.
 *
 * This realistic freelance services agreement is designed to trigger multiple
 * clause categories and all three risk levels (high, medium, low), plus at
 * least one unusual clause, so the demo report showcases the full feature set.
 *
 * The contract uses Dutch jurisdiction (governed by the laws of the Netherlands)
 * to demonstrate jurisdiction-aware analysis — e.g. the aggressive non-compete
 * triggers a note about Dutch compensation requirements, the 45-day payment
 * term raises EU Late Payment Directive concerns, and GDPR replaces CCPA.
 */

import type { UploadResponse } from "@/types";

export const SAMPLE_CONTRACT_TEXT = `\
FREELANCE SERVICES AGREEMENT

This Freelance Services Agreement ("Agreement") is entered into as of March 3, 2025 \
("Effective Date") by and between Luminar B.V., a private limited liability company \
(besloten vennootschap) incorporated under the laws of the Netherlands, registered with \
the Chamber of Commerce (Kamer van Koophandel) under number 74829156, with its registered \
office at Herengracht 182, 1016 BR Amsterdam, the Netherlands ("Company"), and \
Sofia van Dijk, an independent contractor (zelfstandige zonder personeel) residing at \
Oudegracht 45, 3511 AK Utrecht, the Netherlands ("Contractor").

SECTION 1 — SCOPE OF SERVICES

Contractor agrees to provide software development and UX design services as described in \
each Statement of Work ("SOW") executed by both parties. Each SOW shall specify \
deliverables, timelines, acceptance criteria, and the applicable hourly or fixed-fee rate. \
Contractor shall perform all services in a professional manner consistent with generally \
accepted industry standards and practices in the Netherlands.

SECTION 2 — COMPENSATION AND PAYMENT TERMS

Company shall pay Contractor at the rate specified in each SOW. Unless otherwise stated, \
invoices are due within forty-five (45) calendar days of receipt. All amounts are in euros \
(EUR) and exclusive of value-added tax (btw), which Contractor shall charge at the \
applicable statutory rate. Company reserves the right to withhold payment for deliverables \
that do not meet the acceptance criteria defined in the applicable SOW. No late-payment \
penalties or interest shall apply, notwithstanding any statutory entitlements.

SECTION 3 — TERM AND TERMINATION

This Agreement shall commence on the Effective Date and continue for a period of twelve \
(12) months, unless terminated earlier. Either party may terminate this Agreement for \
convenience by providing sixty (60) days' prior written notice. Company may terminate \
immediately for cause (met onmiddellijke ingang) if Contractor breaches any material term \
and fails to cure within ten (10) business days of written notice.

SECTION 4 — INTELLECTUAL PROPERTY ASSIGNMENT

Contractor hereby irrevocably assigns to Company all right, title, and interest in and to \
any and all work product, inventions, discoveries, improvements, and materials \
(collectively, "Work Product") created, conceived, or developed by Contractor during the \
term of this Agreement, whether or not related to the services performed under any SOW. \
This assignment includes all Work Product created outside of working hours and all \
pre-existing intellectual property (voorbestaand intellectueel eigendom) that Contractor \
incorporates into any deliverable, regardless of when such pre-existing IP was created. \
Contractor waives all moral rights (persoonlijkheidsrechten) in the Work Product to the \
fullest extent permitted by Dutch law. Contractor shall execute any documents and take any \
actions reasonably necessary to perfect Company's ownership of the Work Product.

SECTION 5 — CONFIDENTIALITY

Contractor agrees to maintain in strict confidence all proprietary and confidential \
information of Company ("Confidential Information") for a period of seven (7) years \
following termination of this Agreement. Confidential Information includes, without \
limitation, trade secrets (bedrijfsgeheimen), business plans, customer data, source code, \
financial records, and any information designated as confidential by Company. Contractor \
shall not disclose Confidential Information to any third party without prior written \
consent of Company. The obligations under this Section shall survive any termination or \
expiration of this Agreement.

SECTION 6 — NON-COMPETE AND NON-SOLICITATION

6.1 Non-Compete. During the term of this Agreement and for a period of eighteen (18) \
months following its termination, Contractor shall not, directly or indirectly, engage in \
or provide services to any business that competes with Company's products or services \
anywhere within the European Union. No separate compensation shall be payable to Contractor \
in connection with this non-compete restriction.

6.2 Non-Solicitation. During the term and for twenty-four (24) months thereafter, \
Contractor shall not solicit, recruit, or hire any employee, contractor, or consultant of \
Company, nor shall Contractor solicit any of Company's clients or prospective clients with \
whom Contractor had contact during the engagement.

SECTION 7 — INDEMNIFICATION

Contractor shall indemnify, defend, and hold harmless (vrijwaren) Company, its managing \
directors (bestuurders), employees, and agents from and against any and all claims, \
damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising \
out of or related to Contractor's performance under this Agreement, including any claim of \
intellectual property infringement. Company shall have no reciprocal indemnification \
obligation to Contractor.

SECTION 8 — LIMITATION OF LIABILITY

In no event shall Company's total aggregate liability under this Agreement exceed the \
amount paid to Contractor in the three (3) months preceding the event giving rise to the \
claim. This limitation shall apply regardless of the form of action, whether in contract, \
tort (onrechtmatige daad), or otherwise. This limitation shall not apply to Company's \
gross negligence (grove schuld) or willful misconduct (opzet); however, Contractor's \
liability for gross negligence or willful misconduct shall remain uncapped while Company's \
liability for Contractor's gross negligence remains subject to the three-month cap.

SECTION 9 — DATA PROTECTION

9.1 Compliance. Contractor agrees to comply with all applicable data protection laws, \
including Regulation (EU) 2016/679 (General Data Protection Regulation, "GDPR") and the \
Dutch GDPR Implementation Act (Uitvoeringswet AVG), when processing personal data in \
connection with the services. Contractor shall act as a processor (verwerker) within the \
meaning of Article 4(8) GDPR where applicable.

9.2 Technical Measures. Contractor shall implement appropriate technical and organizational \
measures (passende technische en organisatorische maatregelen) in accordance with Article \
32 GDPR to protect personal data against unauthorized access, loss, alteration, or \
disclosure.

9.3 Breach Notification. In the event of a personal data breach as defined in Article \
4(12) GDPR, Contractor shall notify Company without undue delay and in any event within \
seventy-two (72) hours of becoming aware of the breach, in compliance with Article 33 GDPR.

SECTION 10 — DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding \
arbitration administered by the Netherlands Arbitration Institute (Nederlands Arbitrage \
Instituut, "NAI") in Amsterdam, the Netherlands, under its Arbitration Rules. The \
arbitration shall be conducted in English by a single arbitrator. Each party shall bear its \
own costs and legal fees. The arbitrator's award shall be final and binding and may be \
entered as a judgment in any court of competent jurisdiction.

SECTION 11 — GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the \
Netherlands, without regard to its conflict-of-laws principles. The applicability of the \
Vienna Convention on the International Sale of Goods (CISG) is expressly excluded.

SECTION 12 — FORCE MAJEURE

Neither party shall be liable for failure to perform its obligations under this Agreement \
if such failure results from circumstances beyond the party's reasonable control \
(overmacht), including but not limited to acts of God, natural disasters, war, terrorism, \
pandemics, government orders, sanctions, or interruption of utilities or \
telecommunications. The affected party shall promptly notify the other party and use \
commercially reasonable efforts to resume performance.

SECTION 13 — GENERAL PROVISIONS

13.1 Entire Agreement. This Agreement constitutes the entire agreement between the parties \
and supersedes all prior agreements, representations, and understandings.

13.2 Amendments. This Agreement may be amended only by a written instrument signed by both \
parties.

13.3 Severability. If any provision is held to be invalid or unenforceable by a competent \
Dutch court, the remaining provisions shall continue in full force and effect.

13.4 Language. This Agreement is drawn up in English. In the event of any discrepancy \
between translated versions and the English original, the English text shall prevail.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

Luminar B.V.
By: _________________________
Name: Thomas de Vries, Managing Director (Directeur)

Contractor: Sofia van Dijk
Signature: _________________________
Date: March 3, 2025`;

export const SAMPLE_UPLOAD_RESPONSE: UploadResponse = {
  filename: "sample-freelance-agreement.pdf",
  file_type: "pdf",
  page_count: 4,
  extracted_text: SAMPLE_CONTRACT_TEXT,
  char_count: SAMPLE_CONTRACT_TEXT.length,
};
