import logging
import sys

from src.core.config import settings


def setup_logging() -> logging.Logger:
    log_level = logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )

    logger = logging.getLogger("core-api")
    logger.setLevel(log_level)

    return logger


logger = setup_logging()
