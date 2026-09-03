from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from podio_items import simplify_app, simplify_item, simplify_value  # noqa: E402


def field(field_type, values, external_id="f"):
    return {"external_id": external_id, "field_id": 1, "type": field_type, "values": values}


def test_text_and_number_fields_flatten_to_scalars():
    item = {
        "item_id": 7,
        "title": "Acme",
        "fields": [
            field("text", [{"value": "hello"}], "note"),
            field("number", [{"value": "42.0000"}], "count"),
        ],
    }
    assert simplify_item(item)["fields"] == {"note": "hello", "count": "42.0000"}


def test_category_keeps_id_and_text_so_updates_can_reuse_the_id():
    assert simplify_value("category", {"value": {"id": 2, "text": "Open", "color": "DCEBD8"}}) == {
        "id": 2,
        "text": "Open",
    }


def test_date_without_end_flattens_to_the_start():
    assert simplify_value("date", {"start": "2026-01-02 10:00:00", "end": None}) == "2026-01-02 10:00:00"


def test_date_range_keeps_both_ends():
    assert simplify_value(
        "date", {"start": "2026-01-02 10:00:00", "end": "2026-01-03 10:00:00"}
    ) == {"start": "2026-01-02 10:00:00", "end": "2026-01-03 10:00:00"}


def test_money_keeps_currency():
    assert simplify_value("money", {"value": "10.50", "currency": "USD"}) == {
        "value": "10.50",
        "currency": "USD",
    }


def test_relationship_field_reduces_to_id_and_title():
    assert simplify_value("app", {"value": {"item_id": 99, "title": "Linked", "app": {"app_id": 1}}}) == {
        "item_id": 99,
        "title": "Linked",
    }


def test_multi_value_field_becomes_a_list():
    item = {"item_id": 1, "fields": [field("category", [{"value": {"id": 1, "text": "A"}}, {"value": {"id": 2, "text": "B"}}], "tags")]}
    assert simplify_item(item)["fields"]["tags"] == [{"id": 1, "text": "A"}, {"id": 2, "text": "B"}]


def test_empty_fields_are_dropped():
    item = {"item_id": 1, "fields": [field("text", [], "note")]}
    assert simplify_item(item)["fields"] == {}


def test_field_without_external_id_falls_back_to_field_id():
    item = {"item_id": 1, "fields": [{"field_id": 55, "type": "text", "values": [{"value": "x"}]}]}
    assert simplify_item(item)["fields"] == {"55": "x"}


def test_unknown_field_type_still_yields_its_value():
    assert simplify_value("some-new-type", {"value": "x"}) == "x"


def test_simplify_app_lists_options_and_skips_deleted_fields():
    app = {
        "app_id": 123,
        "link": "https://podio.com/app/123",
        "config": {"name": "Deals", "item_name": "Deal"},
        "fields": [
            {
                "field_id": 1,
                "external_id": "status",
                "type": "category",
                "status": "active",
                "config": {
                    "label": "Status",
                    "required": True,
                    "settings": {
                        "multiple": False,
                        "options": [
                            {"id": 1, "text": "Open", "status": "active"},
                            {"id": 2, "text": "Gone", "status": "deleted"},
                        ],
                    },
                },
            },
            {
                "field_id": 2,
                "external_id": "old",
                "type": "text",
                "status": "deleted",
                "config": {"label": "Old"},
            },
        ],
    }
    schema = simplify_app(app)
    assert schema["name"] == "Deals"
    assert [f["external_id"] for f in schema["fields"]] == ["status"]
    assert schema["fields"][0]["options"] == [{"id": 1, "text": "Open"}]
    assert schema["fields"][0]["required"] is True
