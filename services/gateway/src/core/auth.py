from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """
    Extrai e valida o token de autenticação do usuário.
    Por enquanto apenas extrai o token - validação completa será feita pelos microserviços.
    """
    token = None

    # 1. Tentar header Authorization Bearer
    if credentials:
        token = credentials.credentials

    # 2. Tentar cookie (fallback)
    if not token:
        token = request.cookies.get("access_token")

    # 3. Tentar header Authorization sem Bearer
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação não fornecido",
        )

    # Retorna token para ser repassado aos microserviços
    return {"token": token}


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """Versão opcional - não falha se não houver token."""
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None


def require_internal_auth(request: Request):
    """Valida token interno para comunicação entre serviços."""
    # Por enquanto não valida - implementar futuramente se necessário
    return True
