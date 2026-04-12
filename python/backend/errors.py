from __future__ import annotations


class BackendError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, issues: list[dict[str, str]] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.issues = issues or []


class DocumentNotFound(BackendError):
    def __init__(self, document_id: str):
        super().__init__(
            code="document_not_found",
            message=f"Document not found: {document_id}",
            status_code=404,
        )


class NodeNotFound(BackendError):
    def __init__(self, node_id: str):
        super().__init__(
            code="node_not_found",
            message=f"Node not found: {node_id}",
            status_code=404,
        )


class ContractViolation(BackendError):
    def __init__(self, message: str, issues: list[dict[str, str]] | None = None):
        super().__init__(
            code="contract_violation",
            message=message,
            status_code=400,
            issues=issues,
        )
