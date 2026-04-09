"""Clause extraction prompt and tool schema for LLM Pass 1."""

EXTRACTION_SYSTEM_PROMPT = """\
You are a legal document analyzer. Your task is to identify and extract every \
significant clause from the provided contract text.

Rules:
- Extract the exact original text of each clause — do not paraphrase or summarize.
- Skip boilerplate: signature blocks, date lines, headers, recitals, and \
  definitions-only sections.
- Focus on substantive clauses that create obligations, restrictions, rights, \
  or liabilities for either party.
- Include the section reference (e.g., "Section 8.2") when identifiable from \
  the text.
- If a clause spans multiple paragraphs, include the full text as one clause.
"""

EXTRACTION_USER_PROMPT = """\
Extract all significant clauses from this contract:

{contract_text}"""

EXTRACTION_TOOL = {
    "name": "extract_clauses",
    "description": "Return all identified clauses from the contract.",
    "input_schema": {
        "type": "object",
        "properties": {
            "clauses": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "clause_text": {
                            "type": "string",
                            "description": "Exact original text of the clause.",
                        },
                        "section_reference": {
                            "type": "string",
                            "description": "Section number if identifiable (e.g., 'Section 3.1').",
                        },
                    },
                    "required": ["clause_text"],
                },
            },
        },
        "required": ["clauses"],
    },
}
