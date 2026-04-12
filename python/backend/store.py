from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class DocumentRecord:
    document_id: str
    source: dict[str, Any]
    normalize_request: dict[str, Any]
    normalize_meta: dict[str, Any]
    analysis: dict[str, Any] | None = None
    prompt_analysis: dict[str, Any] | None = None
    reconstruction: dict[str, Any] | None = None
    scene: dict[str, Any] | None = None
    exports: dict[str, Any] | None = None


@dataclass
class InMemoryStore:
    documents: dict[str, DocumentRecord] = field(default_factory=dict)

    def reset(self) -> None:
        self.documents.clear()

    def save_document(self, record: DocumentRecord) -> None:
        self.documents[record.document_id] = record

    def get_document(self, document_id: str) -> DocumentRecord | None:
        return self.documents.get(document_id)


store = InMemoryStore()
