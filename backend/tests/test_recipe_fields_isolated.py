"""Offline regression tests for machining recipe drafts.

Run from the repository root:
    python3 -B -m unittest discover -s backend/tests -p test_recipe_fields_isolated.py -v

Only selected actual model/function definitions are AST-extracted from server.py.
The application module, dotenv setup, Mongo client and startup hooks are never
imported or executed. Stock collections are read-only fakes; all other collection
access fails. Socket connection attempts are also explicitly blocked.
"""

import ast
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import List, Optional
import unittest
from unittest.mock import patch
import uuid

from fastapi import Depends, HTTPException
from pydantic import BaseModel


SERVER_PATH = Path(__file__).resolve().parents[1] / "server.py"
DEFINITIONS = {
    "RecipeLineIn", "RecipeIn", "_recipe_fields", "create_recipe",
    "update_recipe", "clean", "new_id", "now_utc",
}
HEADER_DEFAULTS = {
    "document_no": "T2.298",
    "publication_date": "2025-05-09",
    "revision_no": "00",
    "operation_no": "20",
}
HEADER_VALUES = {
    "note": "F-165 machining recipe",
    "document_no": "T2.299",
    "publication_date": "2025-06-10",
    "revision_no": "03",
    "revision_date": "2025-07-11",
    "machine_code": "CNC-165",
    "machine_type": "5-axis machining center",
    "operation_no": "30",
    "prepared_by": "Preparer",
    "approved_by": "Approver",
}
LINE_VALUES = {
    "note": "Legacy line note",
    "pair_id": "pair-1",
    "tool_no": "T07",
    "machining_length": "125 mm",
    "tool_total_length": "185,25",
    "cutting_speed": "180 m/min",
    "spindle_speed": "4500 rpm",
    "feed_rate": "0.12 mm/rev",
    "inner_cooling": "Yes",
    "holder_type": "HSK63",
    "holder_length": "100 mm",
    "drill_helix_length": "80 mm",
    "insert_brand": "Insert manufacturer",
    "used_insert": "CNMG 120408",
    "insert_quality": "P25",
    "tool_life": "500 parts",
    "special": "Special tool note",
}
USER = {"id": "admin-test", "name": "Offline tester", "role": "admin"}


def load_recipe_definitions(db):
    """Compile real definitions only, never server.py's top-level setup."""
    tree = ast.parse(SERVER_PATH.read_text(encoding="utf-8"), filename=str(SERVER_PATH))
    selected = []
    for node in tree.body:
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in DEFINITIONS:
            node.decorator_list = []
            selected.append(node)
    found = {node.name for node in selected}
    if found != DEFINITIONS:
        raise AssertionError(f"Missing required production definitions: {DEFINITIONS - found}")
    namespace = {
        "BaseModel": BaseModel,
        "Optional": Optional,
        "List": List,
        "Depends": Depends,
        "HTTPException": HTTPException,
        "require_admin": lambda: USER,
        "datetime": datetime,
        "timezone": timezone,
        "uuid": uuid,
        "db": db,
    }
    module = ast.Module(body=selected, type_ignores=[])
    exec(compile(module, filename=str(SERVER_PATH), mode="exec"), namespace)
    return SimpleNamespace(**namespace)


class ReadOnlyStockCollection:
    def __init__(self, name, rows):
        self.name = name
        self.rows = {row["id"]: deepcopy(row) for row in rows}
        self.reads = []

    async def find_one(self, query, projection=None):
        self.reads.append(deepcopy(query))
        return deepcopy(self.rows.get(query["id"]))

    def __getattr__(self, method):
        raise AssertionError(f"Forbidden stock operation: {self.name}.{method}")


class FakeRecipesCollection:
    def __init__(self):
        self.rows = {}
        self.reads = []
        self.writes = []

    async def find_one(self, query, projection=None):
        self.reads.append(deepcopy(query))
        row = deepcopy(self.rows.get(query["id"]))
        if row is not None and projection and projection.get("_id") == 0:
            row.pop("_id", None)
        return row

    async def insert_one(self, document):
        self.writes.append(("insert_one", deepcopy(document)))
        document["_id"] = "fake-object-id"
        self.rows[document["id"]] = deepcopy(document)
        return SimpleNamespace(inserted_id=document["_id"])

    async def update_one(self, query, update):
        self.writes.append(("update_one", deepcopy(query), deepcopy(update)))
        if set(update) != {"$set"}:
            raise AssertionError(f"Unexpected recipe update: {update}")
        self.rows[query["id"]].update(deepcopy(update["$set"]))
        return SimpleNamespace(matched_count=1, modified_count=1)

    def __getattr__(self, method):
        raise AssertionError(f"Unexpected recipe operation: {method}")


class FakeDB:
    def __init__(self):
        self.products = ReadOnlyStockCollection("products", [
            {"id": "product-1", "name": "Drill", "code": "D-165", "brand": "Product brand", "current_stock": 0},
            {"id": "product-2", "name": "Insert", "code": "I-165", "current_stock": 2},
        ])
        self.toolholders = ReadOnlyStockCollection("toolholders", [
            {"id": "holder-1", "name": "Holder", "code": "H-165", "brand": "Holder brand", "current_stock": 1},
        ])
        self.recipes = FakeRecipesCollection()

    def __getattr__(self, collection):
        raise AssertionError(f"Forbidden collection access: {collection}")


def legacy_payload():
    return {
        "name": "  F-165  ",
        "workpiece_name": "  Test workpiece  ",
        "lines": [
            {"kind": "product", "reference_id": "product-1", "quantity": 8, "note": "Legacy note", "pair_id": "legacy-pair"},
            {"kind": "toolholder", "reference_id": "holder-1", "quantity": 4},
        ],
    }


def complete_payload():
    payload = legacy_payload()
    payload.update(HEADER_VALUES)
    for index, line in enumerate(payload["lines"]):
        line.update(LINE_VALUES)
        line["tool_no"] = "T07" if index == 0 else "T08"
    return payload


class RecipeDraftTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = FakeDB()
        self.production = load_recipe_definitions(self.db)
        self.initial_stock = self.stock_snapshot()
        for target in ("socket.create_connection", "socket.socket.connect", "socket.socket.connect_ex", "asyncio.open_connection"):
            blocker = patch(target, side_effect=AssertionError("Network access is forbidden in offline recipe tests"))
            blocker.start()
            self.addCleanup(blocker.stop)

    def stock_snapshot(self):
        return deepcopy((self.db.products.rows, self.db.toolholders.rows))

    def assert_stock_unchanged(self):
        self.assertEqual(self.stock_snapshot(), self.initial_stock)

    async def create(self, payload):
        return await self.production.create_recipe(self.production.RecipeIn(**payload), user=USER)

    async def update(self, rid, payload):
        return await self.production.update_recipe(rid, self.production.RecipeIn(**payload), user=USER)

    def assert_complete_fields(self, document, payload):
        self.assertEqual(document["name"], payload["name"].strip())
        self.assertEqual(document["workpiece_name"], payload["workpiece_name"].strip())
        for field, value in HEADER_VALUES.items():
            self.assertEqual(document[field], value, field)
        for stored, source in zip(document["lines"], payload["lines"]):
            self.assertEqual(set(stored), set(source) | {"name", "code", "brand"})
            for field, value in source.items():
                self.assertEqual(stored[field], value, field)
        self.assertEqual(document["lines"][0]["brand"], "Product brand")
        self.assertEqual(document["lines"][1]["brand"], "Holder brand")
        self.assertEqual(document["lines"][0]["name"], "Drill")
        self.assertEqual(document["lines"][1]["code"], "H-165")
        self.assertNotIn("_id", document)

    async def test_create_persists_every_header_and_line_field_without_stock_writes(self):
        payload = complete_payload()
        document = await self.create(payload)
        self.assert_complete_fields(document, payload)
        self.assertEqual(self.db.recipes.rows[document["id"]]["lines"], document["lines"])
        self.assertEqual(document["status"], "draft")
        self.assertEqual(document["created_by"], USER["name"])
        datetime.fromisoformat(document["created_at"])
        self.assertEqual([write[0] for write in self.db.recipes.writes], ["insert_one"])
        self.assert_stock_unchanged()

    async def test_update_persists_every_field_and_retains_creation_metadata(self):
        initial = await self.create(legacy_payload())
        payload = complete_payload()
        document = await self.update(initial["id"], payload)
        self.assert_complete_fields(document, payload)
        self.assertEqual(self.db.recipes.rows[initial["id"]]["lines"], document["lines"])
        for key in ("id", "created_at", "created_by", "status"):
            self.assertEqual(document[key], initial[key])
        self.assertEqual(document["updated_by"], USER["name"])
        datetime.fromisoformat(document["updated_at"])
        self.assertEqual([write[0] for write in self.db.recipes.writes], ["insert_one", "update_one"])
        self.assert_stock_unchanged()

    async def test_legacy_create_and_update_supply_defaults_and_preserve_old_fields(self):
        payload = legacy_payload()
        created = await self.create(payload)
        for document in (created, await self.update(created["id"], payload)):
            for field, default in HEADER_DEFAULTS.items():
                self.assertEqual(document[field], default)
            self.assertEqual(document["lines"][0]["note"], "Legacy note")
            self.assertEqual(document["lines"][0]["pair_id"], "legacy-pair")
            for line in document["lines"]:
                for field in set(LINE_VALUES) - {"note", "pair_id"}:
                    self.assertEqual(line[field], "", field)
            self.assertEqual(document["lines"][0]["quantity"], 8)
        self.assert_stock_unchanged()

    async def test_null_and_empty_fields_use_safe_iso_defaults_on_both_endpoints(self):
        for blank in (None, ""):
            with self.subTest(blank=blank):
                payload = legacy_payload()
                payload.update({field: blank for field in HEADER_VALUES})
                for line in payload["lines"]:
                    line.update({field: blank for field in LINE_VALUES})
                created = await self.create(payload)
                for document in (created, await self.update(created["id"], payload)):
                    for field in HEADER_VALUES:
                        self.assertEqual(document[field], HEADER_DEFAULTS.get(field, ""), field)
                    for line in document["lines"]:
                        for field in LINE_VALUES:
                            self.assertEqual(line[field], "", field)
        self.assert_stock_unchanged()

    async def test_tool_number_is_editable_and_brand_is_resolved_from_stock(self):
        payload = complete_payload()
        created = await self.create(payload)
        payload["lines"][0]["tool_no"] = "T42"
        payload["lines"][0]["brand"] = "Untrusted payload brand"
        self.db.products.rows["product-1"]["brand"] = "Updated stock brand"
        self.initial_stock = self.stock_snapshot()
        updated = await self.update(created["id"], payload)
        self.assertEqual(updated["lines"][0]["tool_no"], "T42")
        self.assertEqual(updated["lines"][0]["brand"], "Updated stock brand")
        self.assertEqual(updated["lines"][0]["insert_brand"], LINE_VALUES["insert_brand"])
        self.assert_stock_unchanged()

    async def test_tool_total_length_edit_can_clear_existing_measurement(self):
        payload = complete_payload()
        created = await self.create(payload)
        self.assertEqual(created["lines"][0]["tool_total_length"], "185,25")
        payload["lines"][0]["tool_total_length"] = ""
        updated = await self.update(created["id"], payload)
        self.assertEqual(updated["lines"][0]["tool_total_length"], "")
        self.assertEqual(self.db.recipes.rows[created["id"]]["lines"][0]["tool_total_length"], "")
        self.assertEqual(updated["lines"][1]["tool_total_length"], "185,25")
        self.assert_stock_unchanged()

    async def test_missing_or_null_brand_becomes_empty_string(self):
        payload = legacy_payload()
        payload["lines"] = [{"kind": "product", "reference_id": "product-2", "quantity": 1}]
        for brand in ("missing", None):
            with self.subTest(brand=brand):
                if brand is None:
                    self.db.products.rows["product-2"]["brand"] = None
                self.initial_stock = self.stock_snapshot()
                created = await self.create(payload)
                self.assertEqual(created["lines"][0]["brand"], "")
                updated = await self.update(created["id"], payload)
                self.assertEqual(updated["lines"][0]["brand"], "")
                self.assert_stock_unchanged()

    async def test_bound_update_guard_runs_before_stock_reads_or_any_writes(self):
        self.db.recipes.rows["bound-recipe"] = {"id": "bound-recipe", "status": "bound", "name": "Locked"}
        initial = deepcopy(self.db.recipes.rows)
        with self.assertRaises(HTTPException) as raised:
            await self.update("bound-recipe", complete_payload())
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("düzenlenemez", raised.exception.detail)
        self.assertEqual(self.db.recipes.rows, initial)
        self.assertEqual(self.db.recipes.writes, [])
        self.assertEqual(self.db.products.reads, [])
        self.assertEqual(self.db.toolholders.reads, [])
        self.assert_stock_unchanged()

    async def test_missing_recipe_update_returns_404_without_stock_access(self):
        with self.assertRaises(HTTPException) as raised:
            await self.update("missing", legacy_payload())
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.db.recipes.writes, [])
        self.assertEqual(self.db.products.reads, [])
        self.assertEqual(self.db.toolholders.reads, [])
        self.assert_stock_unchanged()

    async def test_invalid_payloads_never_write_recipes_or_stock(self):
        invalid_cases = [
            ({"name": "   "}, 400),
            ({"workpiece_name": "   "}, 400),
            ({"lines": []}, 400),
            ({"lines": [{"kind": "invalid", "reference_id": "product-1", "quantity": 1}]}, 400),
            ({"lines": [{"kind": "product", "reference_id": "product-1", "quantity": 0}]}, 400),
            ({"lines": [{"kind": "toolholder", "reference_id": "holder-1", "quantity": -1}]}, 400),
            ({"lines": [{"kind": "product", "reference_id": "missing", "quantity": 1}]}, 404),
            ({"lines": [{"kind": "toolholder", "reference_id": "missing", "quantity": 1}]}, 404),
            # Failure on a later line must not write the validated earlier line.
            ({"lines": legacy_payload()["lines"] + [{"kind": "product", "reference_id": "missing", "quantity": 1}]}, 404),
        ]
        self.db.recipes.rows["draft"] = {"id": "draft", "status": "draft", "name": "Original"}
        original_recipes = deepcopy(self.db.recipes.rows)
        for changes, expected_status in invalid_cases:
            for endpoint in ("create", "update"):
                with self.subTest(changes=changes, endpoint=endpoint):
                    payload = legacy_payload()
                    payload.update(deepcopy(changes))
                    with self.assertRaises(HTTPException) as raised:
                        if endpoint == "create":
                            await self.create(payload)
                        else:
                            await self.update("draft", payload)
                    self.assertEqual(raised.exception.status_code, expected_status)
                    self.assertEqual(self.db.recipes.writes, [])
                    self.assertEqual(self.db.recipes.rows, original_recipes)
                    self.assert_stock_unchanged()

    def test_model_field_contract_and_template_defaults(self):
        self.assertEqual(set(self.production.RecipeLineIn.model_fields), set(LINE_VALUES) | {"kind", "reference_id", "quantity"})
        self.assertEqual(set(self.production.RecipeIn.model_fields), set(HEADER_VALUES) | {"name", "workpiece_name", "lines"})
        body = self.production.RecipeIn(**legacy_payload())
        for field, default in HEADER_DEFAULTS.items():
            self.assertEqual(getattr(body, field), default)
        self.assertEqual(body.lines[0].tool_no, "")
        self.assertEqual(body.lines[0].tool_total_length, "")


if __name__ == "__main__":
    unittest.main()
