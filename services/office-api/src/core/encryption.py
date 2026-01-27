from cryptography.fernet import Fernet

from src.core.config import settings
from src.core.logging import logger

_fernet: Fernet | None = None


def get_fernet() -> Fernet:
    """Get or create Fernet instance for encryption/decryption."""
    global _fernet
    if _fernet is None:
        if not settings.ENCRYPTION_KEY:
            raise ValueError("ENCRYPTION_KEY not configured")
        _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    return _fernet


def encrypt_token(token: str) -> str:
    """Encrypt a token for secure storage."""
    try:
        fernet = get_fernet()
        return fernet.encrypt(token.encode()).decode()
    except Exception as e:
        logger.error(f"Failed to encrypt token: {e}")
        raise


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a stored token."""
    try:
        fernet = get_fernet()
        return fernet.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        logger.error(f"Failed to decrypt token: {e}")
        raise
