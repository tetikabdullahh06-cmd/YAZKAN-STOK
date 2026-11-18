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

    async def assert_http(self, status, awaitable):
        with self.assertRaises(HTTPException) as caught:
            await awaitable
        self.assertEqual(caught.exception.status_code, status)

    async def test_get_legacy_bound_is_read_only_and_uses_original_quantity(self):
        initial = self.db.snapshot()
        result = await self.production.get_recipe_returns("r", user=USER)
        self.assertEqual(set(result), {"recipe", "lines", "history", "pending_operation"})
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
        await self.assert_http(409, self.bind())

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

    async def test_bound_returned_and_pending_recipe_edit_delete_protection(self):
        for status in ("bound", "returned", "pending-bind", "pending-return"):
            with self.subTest(status=status):
                self.reset("draft" if status == "pending-bind" else "bound")
                if status == "returned":
                    self.db.recipes.rows["r"]["status"] = "returned"
                if status.startswith("pending"):
                    self.db.recipes.rows["r"]["pending_operation"] = {"id": "pending"}
                payload = self.production.RecipeIn(name="Changed", workpiece_name="Changed", lines=[{"kind": "product", "reference_id": "p", "quantity": 1}])
                initial = self.db.snapshot()
                expected = 409 if status.startswith("pending") else 400
                await self.assert_http(expected, self.production.update_recipe("r", payload, user=USER))
                await self.assert_http(expected, self.production.delete_recipe("r", user=USER))
                self.assertEqual(self.db.snapshot(), initial)
                self.assertEqual(self.db.writes, [])

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
