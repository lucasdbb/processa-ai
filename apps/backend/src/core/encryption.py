from cryptography.fernet import Fernet

from src.core.config import settings


def get_fernet() -> Fernet:
    """Get Fernet instance for encryption/decryption."""
    if not settings.ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY is not set")
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_token(token: str) -> str:
    """Encrypt a token string."""
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt an encrypted token string."""
    f = get_fernet()
    return f.decrypt(encrypted_token.encode()).decode()
