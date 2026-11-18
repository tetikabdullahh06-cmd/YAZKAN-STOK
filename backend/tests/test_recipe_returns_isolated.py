"""Standalone/offline regressions for durable per-line recipe receipts.

Run: python3 -B -m unittest discover -s backend/tests -p 'test_recipe_*isolated.py' -v
Only actual selected server definitions are compiled. Mongo/env/startup is never
imported, and socket/open_connection operations are blocked for every test.
"""
import ast
import asyncio
from copy import deepcopy
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import List, Optional
import unittest
from unittest.mock import patch
import uuid

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator

SERVER_PATH = Path(__file__).resolve().parents[1] / "server.py"
MODELS = {"RecipeLineIn", "RecipeIn", "RecipeBindIn", "RecipeReturnIn", "RecipeReturnItemIn", "ToolHolderScrapIn"}
HANDLERS = {"clean", "new_id", "now_utc", "create_recipe", "update_recipe", "delete_recipe", "bind_recipe",
            "get_recipe_returns", "return_recipe_items", "update_toolholder_scrap", "delete_toolholder_scrap"}
USER = {"id": "admin", "name": "Offline administrator", "role": "admin"}
MISSING = object()


def load_definitions(db):
    tree = ast.parse(SERVER_PATH.read_text(encoding="utf-8"), filename=str(SERVER_PATH))
    selected = []
    for node in tree.body:
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and (
            node.name in MODELS | HANDLERS or node.name.startswith("_recipe_")):
            node.decorator_list = []  # route decorators only; retain real Pydantic validators
            selected.append(node)
    found = {node.name for node in selected}
    assert MODELS | HANDLERS <= found, (MODELS | HANDLERS) - found
    namespace = {"BaseModel": BaseModel, "Field": Field, "field_validator": field_validator,
                 "Optional": Optional, "List": List, "Depends": Depends, "HTTPException": HTTPException,
                 "require_admin": lambda: USER, "get_current_user": lambda: USER,
                 "datetime": datetime, "date": date, "timezone": timezone, "uuid": uuid,
                 "ReturnDocument": SimpleNamespace(AFTER=True), "db": db}
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(SERVER_PATH), "exec"), namespace)
    return SimpleNamespace(**namespace)


def lookup(document, key):
    value = document
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            return MISSING
        value = value[part]
    return value


def matches(document, query):
    for key, expected in query.items():
        actual = lookup(document, key)
        if isinstance(expected, dict):
            for operator, value in expected.items():
                if operator == "$exists":
                    if (actual is not MISSING) != value:
                        return False
                elif operator == "$ne":
                    if actual is not MISSING and (value in actual if isinstance(actual, list) else actual == value):
                        return False
                elif operator == "$gte":
                    if actual is MISSING or actual < value:
                        return False
                else:
                    raise AssertionError(f"Unsupported query operator {operator}")
        elif expected is None:
            if actual is not MISSING and actual is not None:
                return False
        elif actual is MISSING or actual != expected:
            return False
    return True


class AtomicCollection:
    """Mongo-like predicates and updates execute atomically, with scheduling at await boundaries."""
    def __init__(self, db, name, documents=()):
        self.db, self.name = db, name
        self.rows = {row.get("_id", row.get("id")): deepcopy(row) for row in documents}

    def document(self, identity):
        return next((row for row in self.rows.values() if row.get("id", row.get("_id")) == identity), None)

    async def find_one(self, query, projection=None):
        await asyncio.sleep(0)
        row = next((deepcopy(row) for row in self.rows.values() if matches(row, query)), None)
        if row is not None and projection and projection.get("_id") == 0:
            row.pop("_id", None)
        return row

    def apply_update(self, document, update, inserting):
        for operator, fields in update.items():
            if operator == "$set":
                document.update(deepcopy(fields))
            elif operator == "$setOnInsert":
                if inserting:
                    document.update(deepcopy(fields))
            elif operator == "$inc":
                for key, delta in fields.items():
                    document[key] = document.get(key, 0) + delta
            elif operator == "$addToSet":
                for key, value in fields.items():
                    values = document.setdefault(key, [])
                    if value not in values:
                        values.append(deepcopy(value))
            elif operator == "$unset":
                for key in fields:
                    document.pop(key, None)
            else:
                raise AssertionError(f"Unsupported update operator {operator}")

    async def update_one(self, query, update, upsert=False):
        await asyncio.sleep(0)
        self.db.writes.append((self.name, "update_one", deepcopy(query), deepcopy(update)))
        self.db.inject(self.name, query, update, "before")
        row = next((row for row in self.rows.values() if matches(row, query)), None)
        matched, inserting = row is not None, False
        if row is None and upsert:
            row = {key: value for key, value in query.items() if not isinstance(value, dict)}
            inserting = True
            key = row.get("_id", row.get("id"))
            assert key not in self.rows, "Duplicate unique Mongo _id"
            self.rows[key] = row
        if row is not None:
            self.apply_update(row, update, inserting)
        self.db.inject(self.name, query, update, "after")
        return SimpleNamespace(matched_count=int(matched), modified_count=int(matched), upserted_id=row.get("_id") if inserting else None)

    async def insert_one(self, document):
        await asyncio.sleep(0)
        self.db.writes.append((self.name, "insert_one", deepcopy(document)))
        key = document.get("_id", document["id"])
        assert key not in self.rows
        self.rows[key] = deepcopy(document)
        return SimpleNamespace(inserted_id=key)

    async def delete_one(self, query):
        await asyncio.sleep(0)
        self.db.writes.append((self.name, "delete_one", deepcopy(query)))
        key = next((key for key, row in self.rows.items() if matches(row, query)), None)
        if key is not None:
            del self.rows[key]
        return SimpleNamespace(deleted_count=int(key is not None))


class FakeDB:
    def __init__(self):
        self.writes, self.failure = [], None
        self.products = AtomicCollection(self, "products", [
            {"id": "p", "name": "Drill", "code": "D1", "brand": "Brand", "unit": "adet", "current_stock": 20},
            {"id": "p2", "name": "Insert", "code": "I1", "current_stock": 10}])
        self.toolholders = AtomicCollection(self, "toolholders", [
            {"id": "h", "name": "Holder", "code": "H1", "brand": "Holder brand", "current_stock": 10}])
        self.machines = AtomicCollection(self, "machines", [{"id": "m", "name": "CNC", "code": "M1"}])
        for name in ("recipes", "recipe_movements", "movements", "toolholder_movements", "toolholder_scraps", "personnel", "counters"):
            setattr(self, name, AtomicCollection(self, name))

    def inject(self, collection, query, update, phase):
        if self.failure and self.failure(collection, query, update, phase):
            self.failure = None
            raise RuntimeError("Injected durable-operation failure")

    def snapshot(self):
        return {name: deepcopy(value.rows) for name, value in vars(self).items() if isinstance(value, AtomicCollection)}


def recipe_document(status="bound", duplicates=False):
    lines = [
        {"kind": "product", "reference_id": "p", "quantity": 5, "name": "Drill", "code": "D1", "brand": "Brand", "tool_no": "T01", "pair_id": "pair"},
        {"kind": "toolholder", "reference_id": "h", "quantity": 3, "name": "Holder", "code": "H1", "brand": "Holder brand", "tool_no": "T01", "pair_id": "pair"},
    ]
    if duplicates:
        lines.append({**lines[0], "quantity": 4, "tool_no": "T02"})
    result = {"id": "r", "name": "Recipe", "workpiece_name": "Part", "status": status, "lines": lines,
              "document_no": "T2.298", "revision_no": "00"}
    if status != "draft":
        result.update({"machine_id": "m", "machine_name": "CNC", "machine_code": "M1", "bound_at": "2026-11-01T00:00:00Z"})
    return result


class RecipeReturnTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        for target in ("socket.create_connection", "socket.socket.connect", "socket.socket.connect_ex", "asyncio.open_connection"):
            blocker = patch(target, side_effect=AssertionError("Network forbidden in isolated tests"))
            blocker.start()
            self.addCleanup(blocker.stop)
        self.reset()

    def reset(self, status="bound", duplicates=False):
        self.db = FakeDB()
        self.production = load_definitions(self.db)
        self.db.recipes.rows["r"] = recipe_document(status, duplicates)
        self.original_lines = deepcopy(self.db.recipes.rows["r"]["lines"])

    def stock(self):
        return self.db.products.document("p")["current_stock"], self.db.toolholders.document("h")["current_stock"]

    def body(self, request_id="receipt-1", items=None, **kwargs):
        if items is None:
            items = [{"line_id": "0", "quantity": 1, "condition": "healthy"}]
        return self.production.RecipeReturnIn(request_id=request_id, items=items, **kwargs)

    async def receive(self, body):
        return await self.production.return_recipe_items("r", body, user=USER)

    async def bind(self, request_id=None):
        values = {"machine_id": "m"}
        if request_id is not None:
            values["request_id"] = request_id
        return await self.production.bind_recipe("r", self.production.RecipeBindIn(**values), user=USER)

    async def edit_template(self, reference_id="p2", quantity=2, **fields):
        values = {"name": "Next recipe", "workpiece_name": "Next part", "machine_code": "CARD-CNC",
                  "lines": [{"kind": "product", "reference_id": reference_id, "quantity": quantity,
                             "tool_no": "T99", "cutting_speed": "new speed"}], **fields}
        return await self.production.update_recipe("r", self.production.RecipeIn(**values), user=USER)

    async def finish_cycle(self, request_id, condition="healthy"):
        info = await self.production.get_recipe_returns("r", user=USER)
        body = self.body(request_id, [{"line_id": line["line_id"], "quantity": line["outstanding_quantity"], "condition": condition}
                                      for line in info["lines"] if line["outstanding_quantity"] > 0],
                         execution_id=info["execution_id"], return_date="2026-11-18")
        result = await self.receive(body)
        return body, result

    async def start_second_cycle(self):
        self.reset("draft")
        first_bind = await self.bind("bind-one")
        first_return_body, first_return = await self.finish_cycle("return-one")
        await self.edit_template()
        second_bind = await self.bind("bind-two")
        return first_bind, first_return_body, first_return, second_bind

    async def assert_http(self, status, awaitable):
        with self.assertRaises(HTTPException) as caught:
            await awaitable
        self.assertEqual(caught.exception.status_code, status)

    async def test_get_legacy_bound_is_read_only_and_uses_original_quantity(self):
        initial = self.db.snapshot()
        result = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual(set(result), {"recipe", "lines", "history", "pending_operation", "execution", "execution_id", "execution_no", "execution_history"})
        self.assertEqual(result["execution"]["lines"], self.original_lines)
        self.assertEqual(result["execution_no"], 1)
        self.assertEqual(result["execution_history"], [])
        self.assertEqual(result["execution_id"], self.production._recipe_operation_id("r", "bind", "bind:r"))
        self.assertEqual(result["history"], [])
        self.assertIsNone(result["pending_operation"])
        for index, line in enumerate(result["lines"]):
            self.assertEqual(set(line), {"line_id", "kind", "reference_id", "name", "code", "brand", "sent_quantity",
                                         "healthy_quantity", "broken_quantity", "scrap_quantity", "outstanding_quantity"})
            self.assertEqual(line["line_id"], str(index))
            self.assertEqual(line["sent_quantity"], (5, 3)[index])
            self.assertEqual(line["outstanding_quantity"], line["sent_quantity"])
            self.assertEqual(line["healthy_quantity"] + line["broken_quantity"] + line["scrap_quantity"], 0)
        self.assertEqual(self.db.snapshot(), initial)
        self.assertEqual(self.db.writes, [])

    async def test_mixed_partial_and_full_archive_independent_product_holder(self):
        first = await self.receive(self.body(items=[{"line_id": "0", "quantity": 2, "condition": "healthy"},
                                                  {"line_id": "1", "quantity": 1, "condition": "broken", "note": "Holder broken"}],
                                             return_date="2026-11-18", note="First receipt"))
        self.assertEqual(self.stock(), (22, 10))
        self.assertEqual(first["recipe"]["status"], "bound")
        self.assertFalse(first["duplicate"])
        event = first["return"]
        self.assertEqual((event["healthy_quantity"], event["scrap_quantity"], event["broken_quantity"]), (2, 1, 1))
        self.assertEqual((event["machine_id"], event["user_id"], event["date"]), ("m", USER["id"], "2026-11-18"))
        self.assertEqual(event["items"][1]["note"], "Holder broken")
        self.assertEqual(first["recipe"]["lines"], self.original_lines)
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual([line["outstanding_quantity"] for line in info["lines"]], [3, 2])
        self.assertEqual([line["broken_quantity"] for line in info["lines"]], [0, 1])
        scraps = list(self.db.toolholder_scraps.rows.values())
        self.assertEqual(len(scraps), 1)
        holder_scrap = scraps[0]
        self.assertEqual(holder_scrap["stock_type"], "holder")
        self.assertEqual(holder_scrap["tool_holder_id"], "h")
        self.assertEqual(holder_scrap["scrap_reason"], "Kırıldı")
        self.assertTrue(holder_scrap["stock_already_deducted"])
        self.assertEqual(holder_scrap["source"], "recipe_return")
        self.assertEqual(holder_scrap["stock_delta"], 0)
        self.assertTrue(holder_scrap["record_no"].startswith("YAZKANİŞLEME"))
        second = await self.receive(self.body("receipt-2", [{"line_id": "0", "quantity": 3, "condition": "scrap"},
                                                          {"line_id": "1", "quantity": 2, "condition": "healthy"}]))
        self.assertEqual(self.stock(), (22, 12))
        self.assertEqual(second["recipe"]["status"], "returned")
        self.assertIn("returned_at", second["recipe"])
        self.assertNotIn("pending_operation", second["recipe"])
        self.assertEqual(second["recipe"]["lines"], self.original_lines)
        self.assertEqual(len(second["recipe"]["return_history"]), 2)
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual([line["outstanding_quantity"] for line in info["lines"]], [0, 0])
        product_scrap = next(row for row in self.db.toolholder_scraps.rows.values() if row["stock_type"] == "product")
        self.assertEqual((product_scrap["product_id"], product_scrap["recipe_line_id"], product_scrap["quantity"]), ("p", "0", 3))
        self.assertEqual(product_scrap["scrap_reason"], "Hurda / Kullanım dışı")
        for key in ("code", "name", "brand", "qty", "unit", "date", "reason", "note", "machine_id", "machine_name", "machine_code", "production_product", "user_name", "return_id", "condition"):
            self.assertIn(key, product_scrap)
        self.assertEqual(sorted(row["type"] for row in self.db.movements.rows.values()), ["in", "recipe_scrap"])
        self.assertEqual(sorted(row["type"] for row in self.db.toolholder_movements.rows.values()), ["in", "recipe_scrap"])
        for row in self.db.movements.rows.values():
            self.assertEqual(row["source"], "recipe_return")
        await self.assert_http(409, self.receive(self.body("extra")))
        rebound = await self.bind("next-cycle")
        self.assertEqual(rebound["recipe"]["execution_no"], 2)
        self.assertEqual(len(rebound["recipe"]["execution_history"]), 1)

    async def test_quantity_validation_zero_negative_nan_inf_precision_and_invalid_scrap(self):
        initial = self.db.snapshot()
        for quantity in (0, -1, float("nan"), float("inf"), float("-inf"), 0.0000001, 1.1234567, True):
            with self.subTest(quantity=quantity):
                with self.assertRaises(ValidationError):
                    self.body(items=[{"line_id": "0", "quantity": quantity, "condition": "healthy"}])
        for condition in ("invalid", "broken-ish", "", "SCRAP"):
            with self.assertRaises(ValidationError):
                self.body(items=[{"line_id": "0", "quantity": 1, "condition": condition}])
        for bad_date in ("2026-02-30", "20261118", "2026-1-01", "2026-W47-3", "2026-11-18T00:00:00", ""):
            with self.assertRaises(ValidationError):
                self.body(return_date=bad_date)
        for request_id in ("", "   "):
            with self.assertRaises(ValidationError):
                self.body(request_id)
        with self.assertRaises(ValidationError):
            self.production.RecipeReturnIn(items=[])
        default = self.body()
        self.assertEqual(default.return_date, date.today().isoformat())
        self.assertEqual(default.note, "")
        self.assertEqual(self.db.snapshot(), initial)
        self.assertEqual(self.db.writes, [])

    async def test_all_items_validated_before_writes_missing_duplicate_overlimit_empty(self):
        good = {"line_id": "1", "quantity": 1, "condition": "healthy"}
        invalid_items = [[], [{"line_id": "0", "quantity": 5.000001, "condition": "healthy"}],
                         [good, good], [good, {"line_id": "99", "quantity": 1, "condition": "scrap"}],
                         [{"line_id": "00", "quantity": 1, "condition": "healthy"}],
                         [good, {"line_id": "-1", "quantity": 1, "condition": "broken"}]]
        for items in invalid_items:
            with self.subTest(items=items):
                initial = self.db.snapshot()
                await self.assert_http(400, self.receive(self.body(items=items)))
                self.assertEqual(self.db.snapshot(), initial)
                self.assertEqual(self.db.writes, [])
        del self.db.toolholders.rows["h"]
        initial = self.db.snapshot()
        await self.assert_http(404, self.receive(self.body(items=[{"line_id": "0", "quantity": 1, "condition": "healthy"}, good])))
        self.assertEqual(self.db.snapshot(), initial)
        self.assertEqual(self.db.writes, [])

    async def test_draft_and_missing_recipe_rejected_without_writes(self):
        self.reset("draft")
        await self.assert_http(409, self.receive(self.body()))
        self.assertEqual(self.db.writes, [])
        self.db.recipes.rows.clear()
        await self.assert_http(404, self.receive(self.body()))
        await self.assert_http(404, self.production.get_recipe_returns("r", user=USER))
        await self.assert_http(404, self.bind())
        self.assertEqual(self.db.writes, [])

    async def test_inclusive_limits_and_six_decimal_receipts(self):
        self.db.recipes.rows["r"]["lines"][0]["quantity"] = 0.3
        await self.receive(self.body("a", [{"line_id": "0", "quantity": 0.1, "condition": "healthy"}]))
        await self.receive(self.body("b", [{"line_id": "0", "quantity": 0.2, "condition": "broken"}]))
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual(info["lines"][0]["outstanding_quantity"], 0)
        initial = self.db.snapshot()
        await self.assert_http(400, self.receive(self.body("over", [{"line_id": "0", "quantity": 0.000001, "condition": "healthy"}])))
        self.assertEqual(self.db.snapshot(), initial)
        result = await self.receive(self.body("six", [{"line_id": "1", "quantity": 0.123456, "condition": "healthy"}]))
        self.assertEqual(result["recipe"]["return_totals"]["1"]["healthy"], 0.123456)

    async def test_completed_request_replay_and_conflicting_payload(self):
        body = self.body(return_date="2026-11-18", note="Original")
        first = await self.receive(body)
        initial, writes = self.db.snapshot(), len(self.db.writes)
        second = await self.receive(body)
        self.assertTrue(second["duplicate"])
        self.assertEqual(second["return"], first["return"])
        self.assertEqual(self.db.snapshot(), initial)
        self.assertEqual(len(self.db.writes), writes)
        await self.assert_http(409, self.receive(self.body(return_date="2026-11-18", note="Changed")))
        await self.assert_http(409, self.receive(self.body(items=[{"line_id": "0", "quantity": 2, "condition": "healthy"}])))
        self.assertEqual(self.db.snapshot(), initial)

    async def test_concurrent_duplicate_returns_are_atomic_and_single_history(self):
        results = await asyncio.gather(*(self.receive(self.body()) for _ in range(8)))
        self.assertTrue(all(result["ok"] for result in results))
        self.assertEqual(sum(not result["duplicate"] for result in results), 1)
        self.assertEqual(self.stock(), (21, 10))
        self.assertEqual(len(self.db.recipes.rows["r"]["return_history"]), 1)
        self.assertEqual(len(self.db.recipe_movements.rows), 1)
        self.assertEqual(len(self.db.movements.rows), 1)
        self.assertEqual(len(self.db.products.document("p")["recipe_stock_operations"]), 1)

    async def test_concurrent_different_requests_serialize_and_reject_conflict(self):
        results = await asyncio.gather(self.receive(self.body("a")), self.receive(self.body("b")), return_exceptions=True)
        self.assertEqual(sum(isinstance(result, dict) for result in results), 1)
        conflict = next(result for result in results if isinstance(result, HTTPException))
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(self.stock(), (21, 10))
        self.assertEqual(len(self.db.recipes.rows["r"]["return_history"]), 1)

    async def test_failure_after_stock_write_preserves_original_journal_and_resumes(self):
        body = self.body(items=[{"line_id": "0", "quantity": 2, "condition": "healthy", "note": "Original product"},
                                {"line_id": "1", "quantity": 1, "condition": "scrap"}], return_date="2026-11-18", note="Original body")
        self.db.failure = lambda collection, query, update, phase: collection == "products" and "$inc" in update and phase == "after"
        with self.assertRaisesRegex(RuntimeError, "Injected"):
            await self.receive(body)
        self.assertEqual(self.stock(), (22, 10))
        pending = deepcopy(self.db.recipes.rows["r"]["pending_operation"])
        self.assertEqual(pending["body"], body.model_dump(exclude_unset=True))
        self.assertEqual(len(pending["stocks"]), 1)
        self.assertEqual(len(pending["scraps"]), 1)
        self.assertNotIn("return_history", self.db.recipes.rows["r"])
        self.assertEqual(self.db.recipe_movements.rows, {})
        before_get = self.db.snapshot()
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual(info["pending_operation"], {key: pending[key] for key in ("type", "request_id", "body")})
        self.assertEqual(self.db.snapshot(), before_get)
        await self.assert_http(409, self.receive(self.body("other")))
        await self.assert_http(409, self.receive(self.body(note="Different")))
        await self.assert_http(409, self.bind())
        self.assertEqual(self.db.recipes.rows["r"]["pending_operation"], pending)
        resumed = await self.receive(body)
        self.assertEqual(resumed["return"], pending["event"])
        self.assertEqual(self.stock(), (22, 10))
        self.assertNotIn("pending_operation", resumed["recipe"])
        self.assertEqual(len(resumed["recipe"]["return_history"]), 1)
        self.assertEqual(len(self.db.recipe_movements.rows), 2)
        self.assertEqual(len(self.db.toolholder_scraps.rows), 1)
        initial = self.db.snapshot()
        self.assertTrue((await self.receive(body))["duplicate"])
        self.assertEqual(self.db.snapshot(), initial)

    async def test_log_scrap_and_finalization_failures_can_retry_without_duplicates(self):
        for target in ("recipe_movements", "movements", "toolholder_movements", "toolholder_scraps", "final"):
            with self.subTest(target=target):
                self.reset()
                body = self.body(items=[{"line_id": "0", "quantity": 1, "condition": "healthy"},
                                        {"line_id": "1", "quantity": 1, "condition": "broken"}])
                def failure(collection, query, update, phase):
                    if target == "final":
                        return collection == "recipes" and "$unset" in update and phase == "before"
                    return collection == target and phase == "after"
                self.db.failure = failure
                with self.assertRaises(RuntimeError):
                    await self.receive(body)
                self.assertIn("pending_operation", self.db.recipes.rows["r"])
                resumed = await self.receive(body)
                self.assertEqual(self.stock(), (21, 10))
                self.assertEqual(len(self.db.recipe_movements.rows), 2)
                self.assertEqual(len(self.db.movements.rows), 1)
                self.assertEqual(len(self.db.toolholder_movements.rows), 1)
                self.assertEqual(len(self.db.toolholder_scraps.rows), 1)
                self.assertEqual(len(resumed["recipe"]["return_history"]), 1)

    async def test_bind_aggregates_duplicate_stock_and_stable_lines_and_mirrors(self):
        self.reset("draft", duplicates=True)
        result = await self.bind()
        self.assertEqual(self.stock(), (11, 7))
        self.assertEqual(result["recipe"]["status"], "bound")
        self.assertEqual(result["recipe"]["lines"], self.original_lines)
        self.assertEqual([movement["recipe_line_id"] for movement in result["movements"]], ["0", "1", "2"])
        self.assertEqual(len(self.db.products.document("p")["recipe_stock_operations"]), 1)
        self.assertEqual(len(self.db.movements.rows), 2)
        self.assertEqual(len(self.db.toolholder_movements.rows), 1)
        for movement in list(self.db.movements.rows.values()) + list(self.db.toolholder_movements.rows.values()):
            self.assertEqual((movement["type"], movement["source"]), ("out", "recipe_bind"))
        writes = [entry for entry in self.db.writes if entry[0] in {"products", "toolholders"}]
        self.assertTrue(all("$inc" in entry[3] and "$addToSet" in entry[3] and "$set" not in entry[3] for entry in writes))
        initial = self.db.snapshot()
        self.assertTrue((await self.bind())["duplicate"])
        self.assertEqual(self.db.snapshot(), initial)
        await self.assert_http(409, self.bind("different"))
        other_machine = self.production.RecipeBindIn(machine_id="other")
        await self.assert_http(409, self.production.bind_recipe("r", other_machine, user=USER))
        self.assertEqual(self.db.snapshot(), initial)

    async def test_bind_insufficient_aggregate_or_missing_item_never_writes(self):
        self.reset("draft", duplicates=True)
        self.db.products.document("p")["current_stock"] = 8
        initial = self.db.snapshot()
        await self.assert_http(400, self.bind())
        self.assertEqual(self.db.snapshot(), initial)
        self.assertEqual(self.db.writes, [])
        self.db.products.document("p")["current_stock"] = 20
        del self.db.toolholders.rows["h"]
        initial = self.db.snapshot()
        await self.assert_http(404, self.bind())
        self.assertEqual(self.db.snapshot(), initial)
        self.assertEqual(self.db.writes, [])

    async def test_bind_concurrent_duplicates_and_failure_recovery(self):
        self.reset("draft", duplicates=True)
        self.db.failure = lambda collection, query, update, phase: collection == "products" and "$inc" in update and phase == "after"
        with self.assertRaises(RuntimeError):
            await self.bind("bind-request")
        self.assertEqual(self.stock(), (11, 10))
        self.assertEqual(self.db.recipes.rows["r"]["status"], "draft")
        self.assertEqual(self.db.recipes.rows["r"]["pending_operation"]["request_id"], "bind-request")
        await self.assert_http(409, self.bind("other-request"))
        await self.assert_http(409, self.receive(self.body()))
        results = await asyncio.gather(*(self.bind("bind-request") for _ in range(5)))
        self.assertTrue(all(result["ok"] for result in results))
        self.assertEqual(self.stock(), (11, 7))
        self.assertEqual(sum(not result["duplicate"] for result in results), 1)
        self.assertEqual(len(self.db.recipe_movements.rows), 3)
        self.assertNotIn("pending_operation", self.db.recipes.rows["r"])

    async def test_atomic_bind_sufficient_stock_guard_keeps_journal_on_race(self):
        self.reset("draft")
        self.db.failure = lambda collection, query, update, phase: collection == "recipes" and "pending_operation" in update.get("$set", {}) and phase == "after"
        with self.assertRaises(RuntimeError):
            await self.bind()
        self.db.products.document("p")["current_stock"] = 4
        await self.assert_http(409, self.bind())
        self.assertEqual(self.stock(), (4, 10))
        self.assertIn("pending_operation", self.db.recipes.rows["r"])
        self.db.products.document("p")["current_stock"] = 7
        await self.bind()
        self.assertEqual(self.stock(), (2, 7))

    async def test_duplicate_recipe_lines_can_return_independently_without_pair_coupling(self):
        self.reset("draft", duplicates=True)
        await self.bind()
        first = await self.receive(self.body(items=[{"line_id": "2", "quantity": 4, "condition": "healthy"}]))
        self.assertEqual(self.stock(), (15, 7))
        self.assertEqual(first["recipe"]["return_totals"], {"2": {"healthy": 4, "broken": 0, "scrap": 0}})
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual([line["outstanding_quantity"] for line in info["lines"]], [5, 3, 0])

    async def test_bound_returned_editable_but_pending_and_ledger_delete_protected(self):
        for status in ("bound", "returned", "pending-bind", "pending-return"):
            with self.subTest(status=status):
                self.reset("draft" if status == "pending-bind" else "bound")
                if status == "returned":
                    self.db.recipes.rows["r"]["status"] = "returned"
                if status.startswith("pending"):
                    self.db.recipes.rows["r"]["pending_operation"] = {"id": "pending"}
                payload = self.production.RecipeIn(name="Changed", workpiece_name="Changed", lines=[{"kind": "product", "reference_id": "p", "quantity": 1}])
                initial = self.db.snapshot()
                if status.startswith("pending"):
                    await self.assert_http(409, self.production.update_recipe("r", payload, user=USER))
                    await self.assert_http(409, self.production.delete_recipe("r", user=USER))
                    self.assertEqual(self.db.snapshot(), initial)
                    self.assertEqual(self.db.writes, [])
                else:
                    updated = await self.production.update_recipe("r", payload, user=USER)
                    self.assertEqual(updated["execution_snapshot"]["lines"], self.original_lines)
                    self.assertEqual(updated["name"], "Changed")
                    self.assertEqual(updated["execution_snapshot"]["name"], "Recipe")
                    self.assertEqual(self.stock(), (20, 10))
                    self.assertEqual([write[0] for write in self.db.writes], ["recipes"])
                    edited = self.db.snapshot()
                    await self.assert_http(400, self.production.delete_recipe("r", user=USER))
                    self.assertEqual(self.db.snapshot(), edited)

    async def test_draft_edit_delete_cas_cannot_overwrite_concurrent_bind(self):
        for action in ("update", "delete"):
            with self.subTest(action=action):
                self.reset("draft")
                payload = self.production.RecipeIn(name="Changed", workpiece_name="Changed", lines=[{"kind": "product", "reference_id": "p", "quantity": 1}])
                # Simulate another worker claiming a journal after this handler's read.
                original = self.db.recipes.update_one if action == "update" else self.db.recipes.delete_one
                async def race(query, update=None, upsert=False):
                    self.db.recipes.rows["r"]["pending_operation"] = {"id": "other-worker"}
                    self.db.recipes.rows["r"]["recipe_revision"] = 1
                    if action == "update":
                        return await original(query, update, upsert)
                    return await original(query)
                if action == "update":
                    self.db.recipes.update_one = race
                    await self.assert_http(409, self.production.update_recipe("r", payload, user=USER))
                else:
                    self.db.recipes.delete_one = race
                    await self.assert_http(409, self.production.delete_recipe("r", user=USER))
                self.assertEqual(self.db.recipes.rows["r"]["lines"], self.original_lines)
                self.assertEqual(self.db.recipes.rows["r"]["pending_operation"]["id"], "other-worker")
                self.assertEqual(self.stock(), (20, 10))

    async def test_linked_scrap_metadata_only_quantity_identity_delete_protected(self):
        await self.receive(self.body(items=[{"line_id": "0", "quantity": 1, "condition": "scrap"},
                                           {"line_id": "1", "quantity": 1, "condition": "broken"}]))
        for scrap in list(self.db.toolholder_scraps.rows.values()):
            with self.subTest(kind=scrap["stock_type"]):
                scrap_id = scrap["id"]
                body = self.production.ToolHolderScrapIn(quantity=1, scrap_reason="Metadata reason", scrap_date="2026-11-19",
                                                         description="PDF metadata", prepared_by="New preparer", root_cause="Investigation")
                stocks = deepcopy((self.db.products.rows, self.db.toolholders.rows))
                logs = deepcopy((self.db.recipe_movements.rows, self.db.movements.rows, self.db.toolholder_movements.rows))
                result = await self.production.update_toolholder_scrap(scrap_id, body, user=USER)
                self.assertEqual(result["scrap"]["description"], "PDF metadata")
                self.assertEqual(result["scrap"]["prepared_by"], "New preparer")
                self.assertEqual(result["scrap"]["return_id"], scrap["return_id"])
                self.assertEqual((self.db.products.rows, self.db.toolholders.rows), stocks)
                self.assertEqual((self.db.recipe_movements.rows, self.db.movements.rows, self.db.toolholder_movements.rows), logs)
                initial = self.db.snapshot()
                for change in ({"quantity": 2}, {"quantity": 0}, {"quantity": -1}, {"quantity": float("nan")}, {"quantity": float("inf")},
                               {"stock_type": "holder" if scrap["stock_type"] == "product" else "product"},
                               {"product_id": "p2"}, {"tool_holder_id": "different"}):
                    values = {"quantity": 1, "scrap_reason": "Metadata", "scrap_date": "2026-11-19", **change}
                    await self.assert_http(409, self.production.update_toolholder_scrap(scrap_id, self.production.ToolHolderScrapIn(**values), user=USER))
                await self.assert_http(409, self.production.delete_toolholder_scrap(scrap_id, user=USER))
                self.assertEqual(self.db.snapshot(), initial)

    async def test_normal_scrap_edit_delete_behavior_is_preserved(self):
        for kind, reference_id, collection in (("product", "p", self.db.products), ("holder", "h", self.db.toolholders)):
            with self.subTest(kind=kind):
                self.db.toolholder_scraps.rows["normal"] = {"id": "normal", "stock_type": kind, "product_id": reference_id if kind == "product" else "",
                                                          "tool_holder_id": reference_id if kind == "holder" else "", "quantity": 2}
                stock = collection.document(reference_id)["current_stock"]
                body = self.production.ToolHolderScrapIn(quantity=1, scrap_reason="Adjusted", scrap_date="2026-11-18")
                await self.production.update_toolholder_scrap("normal", body, user=USER)
                self.assertEqual(collection.document(reference_id)["current_stock"], stock + 1)
                await self.production.delete_toolholder_scrap("normal", user=USER)
                self.assertEqual(collection.document(reference_id)["current_stock"], stock + 2)
                self.assertIsNone(self.db.toolholder_scraps.document("normal"))

    async def test_three_cycles_partial_edit_remove_add_finish_original_and_rebind(self):
        self.reset("draft")
        card_fields = {key: f"original-{key}" for key in self.production.RecipeIn.model_fields if key not in {"name", "workpiece_name", "lines"}}
        self.db.recipes.rows["r"].update(card_fields)
        first = await self.bind("cycle-one")
        first_id = first["recipe"]["execution_id"]
        snapshot = deepcopy(first["recipe"]["execution_snapshot"])
        self.assertEqual(self.stock(), (15, 7))
        await self.receive(self.body("partial-one", [{"line_id": "0", "quantity": 2, "condition": "healthy"}], execution_id=first_id))
        ledger = deepcopy({key: self.db.recipes.rows["r"][key] for key in ("return_totals", "return_history", "bind_operation", "bound_at")})
        stock_rows = deepcopy((self.db.products.rows, self.db.toolholders.rows))
        edited = await self.edit_template()
        self.assertEqual(edited["status"], "bound")
        self.assertEqual((self.db.products.rows, self.db.toolholders.rows), stock_rows)
        for key, value in ledger.items():
            self.assertEqual(edited[key], value)
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual([line["reference_id"] for line in info["recipe"]["lines"]], ["p2"])
        self.assertEqual([line["reference_id"] for line in info["lines"]], ["p", "h"])
        self.assertEqual([line["outstanding_quantity"] for line in info["lines"]], [3, 3])
        self.assertEqual(info["execution"]["name"], "Recipe")
        self.assertEqual(info["execution"]["workpiece_name"], "Part")
        self.assertEqual(info["execution"]["machine_code"], "M1")
        await self.receive(self.body("finish-one", [{"line_id": "0", "quantity": 3, "condition": "scrap"},
                                                    {"line_id": "1", "quantity": 3, "condition": "healthy"}],
                                     execution_id=first_id, return_date="2026-11-18"))
        self.assertEqual(self.stock(), (17, 10))
        closed_one = deepcopy(self.db.recipes.rows["r"])
        await self.edit_template(quantity=4, name="Cycle two card", revision_no="02")
        second = await self.bind("cycle-two")
        self.assertEqual(self.db.products.document("p2")["current_stock"], 6)
        archive = deepcopy(second["recipe"]["execution_history"][0])
        self.assertEqual(archive["execution_id"], first_id)
        self.assertEqual(archive["execution_snapshot"], snapshot)
        self.assertEqual(archive["lines"], snapshot["lines"])
        for key in ("bound_at", "returned_at", "bind_operation", "return_history", "return_totals"):
            self.assertEqual(archive[key], closed_one[key])
        for key, value in card_fields.items():
            self.assertEqual(archive["execution_snapshot"][key], value)
        self.assertEqual(archive["machine_code"], "M1")
        self.assertEqual(second["recipe"]["machine_code"], "CARD-CNC")
        self.assertIsNone(second["recipe"]["returned_at"])
        before = self.db.snapshot()
        await self.assert_http(409, self.receive(self.body("stale-one", execution_id=first_id)))
        self.assertEqual(self.db.snapshot(), before)
        await self.finish_cycle("finish-two")
        self.assertEqual(self.db.products.document("p2")["current_stock"], 10)
        await self.edit_template(reference_id="p", quantity=1, name="Cycle three card")
        third = await self.bind("cycle-three")
        self.assertEqual(third["recipe"]["execution_no"], 3)
        self.assertEqual(third["recipe"]["execution_history"][0], archive)
        self.assertEqual([cycle["execution_no"] for cycle in third["recipe"]["execution_history"]], [1, 2])
        self.assertEqual(self.stock(), (16, 10))
        await self.finish_cycle("finish-three")
        self.assertEqual(self.stock(), (17, 10))
        self.assertEqual(len({cycle["execution_id"] for cycle in [*third["recipe"]["execution_history"], third["recipe"]]}), 3)
        for collection in (self.db.recipe_movements, self.db.movements, self.db.toolholder_movements, self.db.toolholder_scraps):
            for key, row in collection.rows.items():
                self.assertEqual(key, row["id"])
                self.assertIn(row["execution_no"], (1, 2, 3))
                self.assertTrue(row["execution_id"])

    async def test_legacy_bound_edit_captures_labels_and_virtual_token_atomically(self):
        before = await self.production.get_recipe_returns("r", user=USER)
        original = deepcopy(self.db.recipes.rows["r"])
        self.db.products.document("p").update({"name": "Renamed stock", "code": "RENAMED", "brand": "New brand"})
        edited = await self.edit_template()
        self.assertEqual(edited["execution_id"], before["execution_id"])
        self.assertEqual(edited["execution_snapshot"]["lines"], original["lines"])
        write = self.db.writes[-1]
        self.assertEqual(write[0], "recipes")
        self.assertIn("execution_snapshot", write[3]["$set"])
        self.assertIn("lines", write[3]["$set"])
        info = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual(info["lines"][0]["name"], "Drill")
        await self.receive(self.body(execution_id=before["execution_id"]))
        row = next(iter(self.db.recipe_movements.rows.values()))
        self.assertEqual((row["recipe_name"], row["production_product"], row["product_name"], row["product_code"]), ("Recipe", "Part", "Drill", "D1"))
        self.assertEqual(row["execution_no"], 1)

    async def test_legacy_returned_edit_then_bind_archives_original_not_template(self):
        await self.finish_cycle("legacy-close")
        legacy = deepcopy(self.db.recipes.rows["r"])
        self.assertNotIn("execution_snapshot", legacy)
        await self.edit_template(name="Replacement")
        rebound = await self.bind("legacy-rebind")
        archived = rebound["recipe"]["execution_history"][0]
        self.assertEqual((archived["name"], archived["workpiece_name"], archived["lines"]), ("Recipe", "Part", self.original_lines))
        self.assertEqual(archived["return_history"], legacy["return_history"])
        self.assertEqual(archived["return_totals"], legacy["return_totals"])
        self.assertIsNone(archived["bind_operation"])
        self.assertEqual(rebound["recipe"]["execution_snapshot"]["name"], "Replacement")

    async def test_repeated_bound_parameter_edits_never_replace_execution_snapshot(self):
        self.reset("draft")
        first = await self.bind("snapshot-bind")
        snapshot = deepcopy(first["recipe"]["execution_snapshot"])
        original_machine = self.production._recipe_execution(first["recipe"])["machine_code"]
        for quantity in (1, 3, 2):
            edited = await self.edit_template(quantity=quantity, revision_no=str(quantity), operation_no="55")
            self.assertEqual(edited["execution_snapshot"], snapshot)
            self.assertEqual(self.production._recipe_execution(edited)["machine_code"], original_machine)
            self.assertEqual(self.stock(), (15, 7))
        self.assertEqual([line["outstanding_quantity"] for line in self.production._recipe_return_lines(edited)], [5, 3])

    async def test_archived_bind_and_return_retries_after_second_and_third_are_read_only(self):
        first_bind, old_body, first_return, second = await self.start_second_cycle()
        for cycle in (2, 3):
            before, writes = self.db.snapshot(), len(self.db.writes)
            duplicate_bind = await self.bind("bind-one")
            duplicate_return = await self.receive(old_body)
            self.assertTrue(duplicate_bind["duplicate"])
            self.assertTrue(duplicate_return["duplicate"])
            self.assertEqual(duplicate_bind["movements"], first_bind["movements"])
            self.assertEqual(duplicate_return["return"], first_return["return"])
            self.assertEqual(duplicate_bind["recipe"]["execution_no"], cycle)
            self.assertEqual(self.db.snapshot(), before)
            self.assertEqual(len(self.db.writes), writes)
            if cycle == 2:
                await self.finish_cycle("return-two")
                await self.bind("bind-three")

    async def test_archived_request_id_conflicts_and_cross_type_reuse_rejected(self):
        await self.start_second_cycle()
        before, writes = self.db.snapshot(), len(self.db.writes)
        token = self.db.recipes.rows["r"]["execution_id"]
        await self.assert_http(409, self.receive(self.body("return-one", execution_id=token, note="changed")))
        await self.assert_http(409, self.receive(self.body("bind-one", execution_id=token)))
        await self.assert_http(409, self.bind("return-one"))
        await self.assert_http(409, self.production.bind_recipe("r", self.production.RecipeBindIn(machine_id="other", request_id="bind-one"), user=USER))
        self.assertEqual(self.db.snapshot(), before)
        self.assertEqual(len(self.db.writes), writes)

    async def test_execution_token_required_on_second_cycle_and_stale_never_writes(self):
        first_bind, _, _, second = await self.start_second_cycle()
        for fields in ({}, {"execution_id": None}, {"execution_id": ""}, {"execution_id": first_bind["recipe"]["execution_id"]}):
            before, writes = self.db.snapshot(), len(self.db.writes)
            await self.assert_http(409, self.receive(self.body("new-token-check", **fields)))
            self.assertEqual(self.db.snapshot(), before)
            self.assertEqual(len(self.db.writes), writes)
        result = await self.receive(self.body("second-valid", execution_id=second["recipe"]["execution_id"]))
        self.assertEqual(result["return"]["execution_no"], 2)
        self.assertEqual(self.db.products.document("p2")["current_stock"], 9)

    async def test_second_cycle_return_journal_failures_keep_body_history_and_template(self):
        for target in ("products", "recipe_movements", "movements", "toolholder_scraps", "final"):
            with self.subTest(target=target):
                _, old_body, _, second = await self.start_second_cycle()
                archive = deepcopy(second["recipe"]["execution_history"])
                await self.edit_template(reference_id="p", quantity=7, name="Editable future card")
                token = second["recipe"]["execution_id"]
                body = self.body("journal-cycle-two", execution_id=token,
                                 items=[{"line_id": "0", "quantity": 1, "condition": "healthy", "note": "immutable request"}])
                if target == "toolholder_scraps":
                    body = self.body("journal-cycle-two", execution_id=token,
                                     items=[{"line_id": "0", "quantity": 1, "condition": "scrap"}])
                self.db.failure = lambda collection, query, update, phase: (collection == "recipes" and "$unset" in update and phase == "before") if target == "final" else (collection == target and phase == "after")
                with self.assertRaises(RuntimeError):
                    await self.receive(body)
                plan = deepcopy(self.db.recipes.rows["r"]["pending_operation"])
                before = self.db.snapshot()
                await self.assert_http(409, self.edit_template(name="Not allowed"))
                await self.assert_http(409, self.receive(old_body))
                await self.assert_http(409, self.receive(self.body("journal-cycle-two", execution_id=token, note="changed")))
                await self.assert_http(409, self.production.delete_recipe("r", user=USER))
                self.assertEqual(self.db.snapshot(), before)
                resumed = await self.receive(body)
                self.assertEqual(resumed["return"], plan["event"])
                self.assertEqual(resumed["recipe"]["name"], "Editable future card")
                self.assertEqual(resumed["return"]["recipe_name"], "Next recipe")
                self.assertEqual(resumed["recipe"]["execution_history"], archive)
                self.assertEqual(self.db.products.document("p2")["current_stock"], 8 if target == "toolholder_scraps" else 9)

    async def test_rebind_failure_archives_exactly_once_and_recovers_without_rededucting(self):
        self.reset("draft")
        await self.bind("first-bind")
        await self.finish_cycle("first-close")
        await self.edit_template()
        closed = deepcopy(self.db.recipes.rows["r"])
        self.db.failure = lambda collection, query, update, phase: collection == "products" and "$inc" in update and phase == "after"
        with self.assertRaises(RuntimeError):
            await self.bind("second-bind")
        plan = deepcopy(self.db.recipes.rows["r"]["pending_operation"])
        self.assertEqual(self.db.products.document("p2")["current_stock"], 8)
        self.assertEqual(self.db.recipes.rows["r"]["status"], "returned")
        self.assertEqual(plan["final"]["execution_history"][0]["return_totals"], closed["return_totals"])
        await self.assert_http(409, self.edit_template())
        await self.assert_http(409, self.bind("different-bind"))
        results = await asyncio.gather(*(self.bind("second-bind") for _ in range(6)))
        self.assertEqual(sum(not result["duplicate"] for result in results), 1)
        self.assertEqual(self.db.products.document("p2")["current_stock"], 8)
        self.assertEqual(len(self.db.recipes.rows["r"]["execution_history"]), 1)
        self.assertEqual(self.db.recipes.rows["r"]["return_history"], [])

    async def test_concurrent_second_bind_duplicates_cas_one_archive_and_stock_marker(self):
        self.reset("draft")
        await self.bind("first-bind")
        await self.finish_cycle("first-close")
        await self.edit_template()
        results = await asyncio.gather(*(self.bind("second-bind") for _ in range(8)))
        self.assertEqual(sum(not result["duplicate"] for result in results), 1)
        recipe = self.db.recipes.rows["r"]
        self.assertEqual(recipe["execution_no"], 2)
        self.assertEqual(len(recipe["execution_history"]), 1)
        self.assertEqual(self.db.products.document("p2")["current_stock"], 8)
        self.assertEqual(len(self.db.products.document("p2")["recipe_stock_operations"]), 1)
        self.assertEqual(len(self.db.recipe_movements.rows), 5)

    async def test_concurrent_different_second_binds_only_one_execution_can_claim(self):
        self.reset("draft")
        await self.bind("first-bind")
        await self.finish_cycle("first-close")
        await self.edit_template()
        results = await asyncio.gather(self.bind("second-a"), self.bind("second-b"), return_exceptions=True)
        self.assertEqual(sum(isinstance(result, dict) for result in results), 1)
        self.assertEqual(next(result for result in results if isinstance(result, HTTPException)).status_code, 409)
        self.assertEqual(self.db.products.document("p2")["current_stock"], 8)
        self.assertEqual(len(self.db.recipes.rows["r"]["execution_history"]), 1)

    async def test_rebind_cas_rejects_stale_template_plan_and_legacy_edit_losing_cas(self):
        self.reset("draft")
        await self.bind("first-bind")
        await self.finish_cycle("first-close")
        await self.edit_template()
        original_update = self.db.recipes.update_one
        async def edit_before_claim(query, update, upsert=False):
            if "pending_operation" in update.get("$set", {}):
                self.db.recipes.rows["r"]["lines"][0]["quantity"] = 4
                self.db.recipes.rows["r"]["recipe_revision"] += 1
            return await original_update(query, update, upsert)
        self.db.recipes.update_one = edit_before_claim
        await self.assert_http(409, self.bind("second-bind"))
        self.assertEqual(self.db.products.document("p2")["current_stock"], 10)
        self.assertNotIn("pending_operation", self.db.recipes.rows["r"])
        self.assertEqual(self.db.recipes.rows["r"]["lines"][0]["quantity"], 4)
        self.reset()
        original_update = self.db.recipes.update_one
        async def return_claim_before_edit(query, update, upsert=False):
            self.db.recipes.rows["r"]["pending_operation"] = {"id": "return-worker"}
            self.db.recipes.rows["r"]["recipe_revision"] = 1
            return await original_update(query, update, upsert)
        self.db.recipes.update_one = return_claim_before_edit
        await self.assert_http(409, self.edit_template())
        self.assertEqual(self.db.recipes.rows["r"]["lines"], self.original_lines)
        self.assertNotIn("execution_snapshot", self.db.recipes.rows["r"])
        self.assertEqual(self.stock(), (20, 10))

    async def test_late_old_bind_and_return_plan_fallback_resolves_archived_receipt(self):
        self.reset("draft")
        self.db.failure = lambda collection, query, update, phase: collection == "recipes" and "pending_operation" in update.get("$set", {}) and phase == "after"
        with self.assertRaises(RuntimeError):
            await self.bind("old-bind")
        old_bind_recipe = deepcopy(self.db.recipes.rows["r"])
        bind_plan = deepcopy(old_bind_recipe["pending_operation"])
        first_bind = await self.bind("old-bind")
        info = await self.production.get_recipe_returns("r", user=USER)
        body = self.body("old-return", [{"line_id": "0", "quantity": 5, "condition": "healthy"},
                                        {"line_id": "1", "quantity": 3, "condition": "healthy"}], execution_id=info["execution_id"])
        self.db.failure = lambda collection, query, update, phase: collection == "recipes" and "pending_operation" in update.get("$set", {}) and phase == "after"
        with self.assertRaises(RuntimeError):
            await self.receive(body)
        old_return_recipe = deepcopy(self.db.recipes.rows["r"])
        return_plan = deepcopy(old_return_recipe["pending_operation"])
        first_return = await self.receive(body)
        await self.edit_template()
        await self.bind("new-bind")
        original_find = self.db.recipes.find_one
        for plan, stale, receipt in ((bind_plan, old_bind_recipe, first_bind["movements"]),
                                     (return_plan, old_return_recipe, first_return["return"])):
            before = self.db.snapshot()
            stale_read = True
            async def lagged_read(query, projection=None):
                nonlocal stale_read
                if stale_read:
                    stale_read = False
                    return deepcopy(stale)
                return await original_find(query, projection)
            self.db.recipes.find_one = lagged_read
            result = await self.production._recipe_run_operation("r", plan)
            self.assertTrue(result["duplicate"])
            self.assertEqual(result["movements" if plan["type"] == "bind" else "return"], receipt)
            self.assertEqual(self.db.snapshot(), before)
            self.db.recipes.find_one = original_find

    async def test_archived_history_blocks_delete_and_archived_scrap_identity_stays_protected(self):
        self.reset("draft")
        await self.bind("scrap-bind")
        await self.finish_cycle("scrap-close", condition="scrap")
        await self.edit_template()
        await self.bind("second-bind")
        archive = deepcopy(self.db.recipes.rows["r"]["execution_history"])
        for scrap in self.db.toolholder_scraps.rows.values():
            await self.assert_http(409, self.production.delete_toolholder_scrap(scrap["id"], user=USER))
            body = self.production.ToolHolderScrapIn(quantity=scrap["quantity"] + 1, scrap_reason="Changed", scrap_date="2026-11-18")
            await self.assert_http(409, self.production.update_toolholder_scrap(scrap["id"], body, user=USER))
            self.assertEqual(scrap["execution_id"], archive[0]["execution_id"])
        self.db.recipes.rows["r"] = {"id": "r", "status": "draft", "lines": [], "execution_history": archive}
        before, writes = self.db.snapshot(), len(self.db.writes)
        await self.assert_http(400, self.production.delete_recipe("r", user=USER))
        self.assertEqual(self.db.snapshot(), before)
        self.assertEqual(len(self.db.writes), writes)

    async def test_no_request_id_bind_per_cycle_fallback_and_insufficient_rebind_no_writes(self):
        self.reset("draft")
        first = await self.bind()
        self.assertEqual(first["recipe"]["bind_operation"]["request_id"], "bind:r")
        await self.finish_cycle("close-one")
        await self.edit_template(quantity=11)
        before, writes = self.db.snapshot(), len(self.db.writes)
        await self.assert_http(400, self.bind())
        self.assertEqual(self.db.snapshot(), before)
        self.assertEqual(len(self.db.writes), writes)
        await self.edit_template(quantity=2)
        second = await self.bind()
        self.assertEqual(second["recipe"]["bind_operation"]["request_id"], "bind:r:2")
        self.assertEqual(second["recipe"]["execution_no"], 2)
        self.assertTrue((await self.bind())["duplicate"])
        await self.finish_cycle("close-two")
        third = await self.bind()
        self.assertEqual(third["recipe"]["bind_operation"]["request_id"], "bind:r:3")
        self.assertEqual(third["recipe"]["execution_no"], 3)
        self.assertEqual(self.db.products.document("p2")["current_stock"], 8)

    def test_routes_and_auth_contract_are_actual_server_decorators(self):
        tree = ast.parse(SERVER_PATH.read_text(encoding="utf-8"))
        for name, method, auth in (("get_recipe_returns", "get", "get_current_user"), ("return_recipe_items", "post", "require_admin")):
            node = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == name)
            decorator = node.decorator_list[0]
            self.assertEqual(decorator.func.attr, method)
            self.assertEqual(decorator.args[0].value, "/recipes/{rid}/returns")
            self.assertEqual(node.args.defaults[-1].args[0].id, auth)


if __name__ == "__main__":
    unittest.main()
