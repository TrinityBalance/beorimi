from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, Request


@dataclass(frozen=True)
class AuthenticatedUser:
    sub: str
    claims: dict[str, Any]


def get_current_user(request: Request) -> AuthenticatedUser:
    event = request.scope.get("aws.event", {})
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims", {})
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Authentication required")
    return AuthenticatedUser(sub=subject, claims=claims)
