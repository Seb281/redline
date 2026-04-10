"""Clause analysis prompts and tool schemas for LLM Pass 2."""

CATEGORY_ENUM = [
    "non_compete",
    "liability",
    "termination",
    "ip_assignment",
    "confidentiality",
    "governing_law",
    "indemnification",
    "data_protection",
    "payment_terms",
    "limitation_of_liability",
    "force_majeure",
    "dispute_resolution",
    "other",
]

ANALYSIS_SYSTEM_PROMPT = """\
You are a legal risk analyst. You assess contract clauses from the perspective \
of the weaker/non-drafting party — the freelancer, employee, or smaller company.

For each clause, provide:
1. A category from: {categories}
2. A short descriptive title (3-6 words)
3. A plain-English explanation (1-2 sentences, no legal jargon)
4. A risk level: low, medium, or high
5. A specific risk explanation — why this level, what makes it risky or safe
6. A negotiation suggestion — ONLY for medium and high risk clauses. \
   Set to null for low risk.
7. Whether this clause is unusual compared to standard contracts of this type. \
   A clause is unusual if its terms, scope, duration, or obligations deviate \
   significantly from what is typical for its category.
8. If unusual, a brief explanation of what specifically is atypical and why it \
   matters. Set to null if the clause is not unusual.

Risk calibration:
- non_compete: >12 months or nationwide/continental scope = high; \
  6-12 months local = medium; <6 months limited = low
- liability: unlimited liability = high; capped at contract value = medium; \
  reasonable caps with exclusions = low
- ip_assignment: covers pre-existing IP or work outside scope = high; \
  limited to deliverables created during engagement = low
- termination: no termination right or >90 days notice = high; \
  30-90 days = medium; <30 days mutual = low
- payment_terms: >60 days or no late payment provisions = high; \
  30-60 days = medium; <30 days with penalties = low
- indemnification: broad/uncapped indemnification by one party = high; \
  mutual and capped = low
- confidentiality: >5 years or perpetual with broad scope = high; \
  2-5 years reasonable scope = medium; standard NDA terms = low
- limitation_of_liability: excludes gross negligence/willful misconduct = high; \
  standard exclusions = low
- For other categories: assess how much the clause restricts the weaker party's \
  rights or creates asymmetric obligations.
""".format(categories=", ".join(CATEGORY_ENUM))

ANALYSIS_BATCH_USER_PROMPT = """\
Analyze all of the following contract clauses:

{clauses_json}"""

ANALYSIS_SINGLE_USER_PROMPT = """\
Analyze this contract clause:

{clause_json}"""

_ANALYZED_CLAUSE_SCHEMA = {
    "type": "object",
    "properties": {
        "clause_text": {"type": "string", "description": "Original clause text."},
        "category": {"type": "string", "enum": CATEGORY_ENUM},
        "title": {"type": "string", "description": "Short title (3-6 words)."},
        "plain_english": {
            "type": "string",
            "description": "Plain-English explanation (1-2 sentences).",
        },
        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "risk_explanation": {"type": "string", "description": "Why this risk level."},
        "negotiation_suggestion": {
            "type": ["string", "null"],
            "description": "Suggestion for medium/high risk. Null for low risk.",
        },
        "is_unusual": {
            "type": "boolean",
            "description": "True if this clause deviates from standard contract norms for its category.",
        },
        "unusual_explanation": {
            "type": ["string", "null"],
            "description": "What is atypical and why it matters. Null if not unusual.",
        },
    },
    "required": [
        "clause_text",
        "category",
        "title",
        "plain_english",
        "risk_level",
        "risk_explanation",
        "negotiation_suggestion",
        "is_unusual",
        "unusual_explanation",
    ],
}

ANALYSIS_BATCH_TOOL = {
    "name": "analyze_clauses",
    "description": "Return analysis for all clauses.",
    "input_schema": {
        "type": "object",
        "properties": {
            "clauses": {
                "type": "array",
                "items": _ANALYZED_CLAUSE_SCHEMA,
            },
        },
        "required": ["clauses"],
    },
}

ANALYSIS_SINGLE_TOOL = {
    "name": "analyze_clause",
    "description": "Return analysis for this single clause.",
    "input_schema": _ANALYZED_CLAUSE_SCHEMA,
}
