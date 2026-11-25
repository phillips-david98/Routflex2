"""2,500 synthetic customers through the real API and atomic snapshot files.

CORE transport and Customer DB are isolated test fixtures. This proves backend
persistence, not an authenticated browser end-to-end recovery session.
"""
from copy import deepcopy
import json
from pathlib import Path
from time import perf_counter
import unittest
from unittest.mock import patch

from models import Customer
from order_write_schemas import customer_key
import test_snapshot_writes as fixture


class StateRecoveryScaleTest(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = fixture.SnapshotWriteTest.asyncSetUp
    core_client = fixture.SnapshotWriteTest.core_client
    handle_core = fixture.SnapshotWriteTest.handle_core
    binding = fixture.SnapshotWriteTest.binding
    core = fixture.SnapshotWriteTest.core
    save = fixture.SnapshotWriteTest.save
    read = fixture.SnapshotWriteTest.read

    async def test_2500_real_file_roundtrip_conflict_failure_and_retry(self):
        count = 2500
        with self.sessions.begin() as db:
            db.add_all([Customer(tenant_id=fixture.A, company_id="", source_system="CRM",
                external_customer_id=f"scale-{i}", name=f"Synthetic {i}",
                lat=-15.6, lon=-56.1, segmento="A", frequencia="W", curva="A",
                tempo_atendimento=10) for i in range(count)])
        plan = fixture.state(populated=False)
        plan["clients"] = [{"id": f"scale-{i}-w3", "customerKey": customer_key("CRM", "", f"scale-{i}"),
            "week": 3, "day": "FRI", "driverId": "driver-one", "sequence": i + 1,
            "clientCode": f"scale-{i}", "clientName": f"Synthetic {i}"} for i in range(count)]
        evidence = {"customers": count, "scope": "temporary isolated test files and SQLite",
            "coreTransport": "simulated", "browserEndToEnd": False, "steps": []}

        async def persist(label, payload, expected):
            start = perf_counter()
            response = await self.save(payload, expected)
            elapsed = (perf_counter() - start) * 1000
            self.assertEqual(response.status_code, 200, response.text)
            saved = response.json()
            self.assertEqual(saved["revision"], expected + 1)
            self.assertEqual(len(saved["clients"]), count)
            self.assertEqual({key: saved[key] for key in payload}, payload)
            self.assertEqual((await self.read()).json(), saved)
            files = list(self.root.rglob("*.json"))
            self.assertEqual(len(files), 1)
            self.assertEqual(json.loads(files[0].read_text(encoding="utf-8")), saved)
            evidence["steps"].append({"step": label, "writeMs": round(elapsed, 2),
                "revision": saved["revision"], "customers": len(saved["clients"]),
                "httpFreshReadAndDiskExact": True})
            return saved

        saved = await persist("initial", plan, 0)
        plan["clients"][0]["sequence"] = count + 1
        saved = await persist("single customer change", plan, 1)
        for i, client in enumerate(plan["clients"]):
            client.update(week=4, day="SUN", sequence=count - i)
        saved = await persist("mass applied changes", plan, 2)
        # An unsaved/discarded copy never touches the authoritative file.
        unsaved = deepcopy(plan)
        for client in unsaved["clients"]:
            client.update(week=5, day="MON")
        self.assertEqual((await self.read()).json(), saved)
        self.assertEqual((await self.read()).json(), saved)
        plan["clients"][1]["sequence"] = count + 2
        saved = await persist("edit after discarded local copy", plan, 3)
        saved = await persist("explicit save of restored local content", unsaved, 4)
        stale = await self.save(plan, 4)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual((await self.read()).json(), saved)
        with patch("tenant_snapshots.os.replace", side_effect=OSError("controlled disk failure")):
            failed = await self.save(plan, 5)
        self.assertEqual(failed.status_code, 503)
        self.assertEqual((await self.read()).json(), saved)
        self.assertEqual(list(self.root.rglob("*.tmp")), [])
        saved = await persist("retry after atomic disk failure", plan, 5)
        evidence.update(conflictStatus=stale.status_code, failureStatus=failed.status_code,
            finalRevision=saved["revision"], finalCustomers=len(saved["clients"]),
            driversExact=saved["drivers"] == plan["drivers"], routesExact=saved["routes"] == plan["routes"])
        destination = Path(__file__).resolve().parents[2] / ".tmp/planning-state-recovery-01/backend-2500.json"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
