import logging
import sys

from pythonjsonlogger.json import JsonFormatter


class WorkerJsonFormatter(JsonFormatter):
    """JSON formatter that includes service name and standard fields."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["service"] = "processa-ai-worker"
        log_record["level"] = record.levelname


_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(
    WorkerJsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    )
)

logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger("processa-ai-worker")
