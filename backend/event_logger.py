from datetime import datetime, timezone
from pathlib import Path
import json
from typing import Dict, List


EVENT_LOG_FILE = Path(__file__).resolve().parent / "event_log.jsonl"


def append_event(customer_id: str, action: str, user: str, metadata: Dict | None = None) -> Dict:
    record = {
        "customer_id": str(customer_id),
        "action": str(action),
        "user": str(user or "system"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }
    EVENT_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with EVENT_LOG_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, ensure_ascii=True) + "\n")
    return record


def read_events(limit: int = 200) -> List[Dict]:
    if not EVENT_LOG_FILE.exists():
        return []

    lines = EVENT_LOG_FILE.read_text(encoding="utf-8").splitlines()
    selected = lines[-max(1, min(limit, 2000)):]

    events: List[Dict] = []
    for line in selected:
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events
