/**
 * Sample contract text and metadata for the demo mode.
 *
 * This realistic freelance services agreement is designed to trigger multiple
 * clause categories and all three risk levels (high, medium, low), plus at
 * least one unusual clause, so the demo report showcases the full feature set.
 */

import type { UploadResponse } from "@/types";

export const SAMPLE_CONTRACT_TEXT = `\
FREELANCE SERVICES AGREEMENT

This Freelance Services Agreement ("Agreement") is entered into as of January 15, 2025 \
("Effective Date") by and between Meridian Technologies Inc., a Delaware corporation \
with its principal office at 400 Innovation Drive, Austin, TX 78701 ("Company"), and \
Jordan Rivera, an independent contractor residing at 1220 Oak Street, Portland, OR 97205 \
("Contractor").

SECTION 1 — SCOPE OF SERVICES

Contractor agrees to provide software development services as described in each Statement \
of Work ("SOW") executed by both parties. Each SOW shall specify deliverables, timelines, \
and acceptance criteria. Contractor shall perform all services in a professional and \
workmanlike manner consistent with industry standards.

SECTION 2 — COMPENSATION AND PAYMENT TERMS

Company shall pay Contractor at the rate specified in each SOW. Unless otherwise stated, \
invoices are due within forty-five (45) days of receipt. Company reserves the right to \
withhold payment for deliverables that do not meet the acceptance criteria defined in the \
applicable SOW. No late-payment penalties shall apply.

SECTION 3 — TERM AND TERMINATION

This Agreement shall commence on the Effective Date and continue for a period of twelve \
(12) months, unless terminated earlier. Either party may terminate this Agreement for \
convenience by providing sixty (60) days' prior written notice. Company may terminate \
immediately for cause if Contractor breaches any material term and fails to cure within \
ten (10) business days of written notice.

SECTION 4 — INTELLECTUAL PROPERTY ASSIGNMENT

Contractor hereby irrevocably assigns to Company all right, title, and interest in and to \
any and all work product, inventions, discoveries, improvements, and materials \
(collectively, "Work Product") created, conceived, or developed by Contractor during the \
term of this Agreement, whether or not related to the services performed under any SOW. \
This assignment includes all Work Product created outside of working hours and all \
pre-existing intellectual property that Contractor incorporates into any deliverable. \
Contractor waives all moral rights in the Work Product to the fullest extent permitted by law.

SECTION 5 — CONFIDENTIALITY

Contractor agrees to maintain in strict confidence all proprietary and confidential \
information of Company ("Confidential Information") for a period of seven (7) years \
following termination of this Agreement. Confidential Information includes, without \
limitation, trade secrets, business plans, customer data, source code, financial records, \
and any information designated as confidential by Company. Contractor shall not disclose \
Confidential Information to any third party without prior written consent of Company.

SECTION 6 — NON-COMPETE AND NON-SOLICITATION

6.1 Non-Compete. During the term of this Agreement and for a period of eighteen (18) \
months following its termination, Contractor shall not, directly or indirectly, engage in \
or provide services to any business that competes with Company's products or services \
within the United States.

6.2 Non-Solicitation. During the term and for twenty-four (24) months thereafter, \
Contractor shall not solicit, recruit, or hire any employee, contractor, or consultant of \
Company, nor shall Contractor solicit any of Company's clients or prospective clients with \
whom Contractor had contact during the engagement.

SECTION 7 — INDEMNIFICATION

Contractor shall indemnify, defend, and hold harmless Company, its officers, directors, \
employees, and agents from and against any and all claims, damages, losses, liabilities, \
costs, and expenses (including reasonable attorneys' fees) arising out of or related to \
Contractor's performance under this Agreement, including any claim of intellectual property \
infringement. Company shall have no reciprocal indemnification obligation to Contractor.

SECTION 8 — LIMITATION OF LIABILITY

In no event shall Company's total aggregate liability under this Agreement exceed the \
amount paid to Contractor in the three (3) months preceding the event giving rise to the \
claim. This limitation shall apply regardless of the form of action, whether in contract, \
tort, or otherwise. This limitation shall not apply to Company's gross negligence or \
willful misconduct; however, Company's liability for Contractor's gross negligence or \
willful misconduct shall remain uncapped.

SECTION 9 — DATA PROTECTION

Contractor agrees to comply with all applicable data protection laws, including the \
California Consumer Privacy Act (CCPA), when handling personal data in connection with the \
services. Contractor shall implement reasonable technical and organizational safeguards to \
protect personal data against unauthorized access, loss, or disclosure. In the event of a \
data breach, Contractor shall notify Company within twenty-four (24) hours.

SECTION 10 — DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding \
arbitration administered by the American Arbitration Association in Austin, Texas, under \
its Commercial Arbitration Rules. The arbitration shall be conducted by a single \
arbitrator. Each party shall bear its own costs and attorneys' fees. The arbitrator's \
decision shall be final and binding. The parties waive any right to a jury trial.

SECTION 11 — GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the \
State of Texas, without regard to its conflict-of-laws principles.

SECTION 12 — FORCE MAJEURE

Neither party shall be liable for failure to perform its obligations under this Agreement \
if such failure results from circumstances beyond the party's reasonable control, \
including but not limited to acts of God, natural disasters, war, terrorism, pandemics, \
government orders, or interruption of utilities or telecommunications. The affected party \
shall promptly notify the other party and use commercially reasonable efforts to resume \
performance.

SECTION 13 — GENERAL PROVISIONS

This Agreement constitutes the entire agreement between the parties and supersedes all \
prior agreements, representations, and understandings. This Agreement may be amended only \
by a written instrument signed by both parties. If any provision is held to be invalid or \
unenforceable, the remaining provisions shall continue in full force and effect.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

Meridian Technologies Inc.
By: _________________________
Name: Sarah Chen, VP of Engineering

Contractor: Jordan Rivera
Signature: _________________________
Date: January 15, 2025`;

export const SAMPLE_UPLOAD_RESPONSE: UploadResponse = {
  filename: "sample-freelance-agreement.pdf",
  file_type: "pdf",
  page_count: 4,
  extracted_text: SAMPLE_CONTRACT_TEXT,
  char_count: SAMPLE_CONTRACT_TEXT.length,
};
