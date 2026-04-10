"""Contract overview prompt and tool schema for LLM Pass 0."""

OVERVIEW_SYSTEM_PROMPT = """\
You are a legal document analyst. Your task is to extract high-level metadata \
from a contract. Identify the type of contract, the parties involved, key dates, \
financial terms, and the most important terms at a glance.

Rules:
- Extract only what is explicitly stated in the text. Do not infer or guess.
- If a field is not clearly stated, set it to null.
- For key_terms, list 3-5 of the most important substantive terms — the things \
  someone would want to know before reading the full contract.
- Keep key_terms concise: one sentence each, plain English, no legal jargon.
"""

OVERVIEW_USER_PROMPT = """\
Extract the high-level overview from this contract:

{contract_text}"""

OVERVIEW_TOOL = {
    "name": "extract_overview",
    "description": "Return high-level metadata about the contract.",
    "input_schema": {
        "type": "object",
        "properties": {
            "contract_type": {
                "type": "string",
                "description": "Type of contract (e.g., 'Freelance Services Agreement', 'NDA', 'Employment Contract').",
            },
            "parties": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Names of the parties involved.",
            },
            "effective_date": {
                "type": ["string", "null"],
                "description": "Effective or start date if stated.",
            },
            "duration": {
                "type": ["string", "null"],
                "description": "Contract duration if stated (e.g., '12 months').",
            },
            "total_value": {
                "type": ["string", "null"],
                "description": "Total contract value if stated (e.g., '$120,000').",
            },
            "governing_jurisdiction": {
                "type": ["string", "null"],
                "description": "Governing law jurisdiction if stated.",
            },
            "key_terms": {
                "type": "array",
                "items": {"type": "string"},
                "description": "3-5 most important terms, one sentence each, plain English.",
            },
        },
        "required": ["contract_type", "parties", "key_terms"],
    },
}
