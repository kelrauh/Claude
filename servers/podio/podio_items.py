"""Condensing Podio's item and app payloads.

Podio returns items as a list of field objects, each wrapping its values in a
type-specific envelope -- a single item easily runs to several kilobytes of
JSON.  Flattening it to ``{external_id: value}`` keeps tool results small
enough to be worth reading, and the raw payload stays one flag away.
"""

from __future__ import annotations

from typing import Any


def simplify_value(field_type: str, value: Any) -> Any:
    """Reduce one entry of a field's ``values`` list to something readable."""
    if not isinstance(value, dict):
        return value

    inner = value.get("value")

    if field_type == "date":
        # Dates carry start/end separately; keep both only when there is an end.
        span = {k: value[k] for k in ("start", "end") if value.get(k)}
        return span if len(span) > 1 else span.get("start")
    if field_type == "money":
        return {"value": inner, "currency": value.get("currency")}
    if field_type == "category" and isinstance(inner, dict):
        return {"id": inner.get("id"), "text": inner.get("text")}
    if field_type == "app" and isinstance(inner, dict):
        return {"item_id": inner.get("item_id"), "title": inner.get("title")}
    if field_type in ("contact", "member") and isinstance(inner, dict):
        return {
            "user_id": inner.get("user_id"),
            "profile_id": inner.get("profile_id"),
            "name": inner.get("name"),
        }
    if field_type in ("image", "file") and isinstance(inner, dict):
        return {
            "file_id": inner.get("file_id"),
            "name": inner.get("name"),
            "link": inner.get("link"),
        }
    if field_type == "embed" and isinstance(inner, dict):
        return {"url": inner.get("original_url"), "title": inner.get("title")}
    if field_type in ("phone", "email"):
        return {"type": value.get("type"), "value": inner}
    if field_type == "location":
        return value.get("value") or value.get("formatted")

    return inner if inner is not None else value


def simplify_item(item: dict[str, Any]) -> dict[str, Any]:
    """Flatten one item to its identity plus ``{external_id: value}`` fields."""
    fields: dict[str, Any] = {}
    for field in item.get("fields") or []:
        key = field.get("external_id") or str(field.get("field_id"))
        field_type = field.get("type", "")
        values = [simplify_value(field_type, entry) for entry in field.get("values") or []]
        if not values:
            continue
        fields[key] = values[0] if len(values) == 1 else values

    simplified = {
        "item_id": item.get("item_id"),
        "app_item_id": item.get("app_item_id"),
        "title": item.get("title"),
        "link": item.get("link"),
        "fields": fields,
    }
    for key in ("created_on", "last_event_on"):
        if item.get(key):
            simplified[key] = item[key]
    return {k: v for k, v in simplified.items() if v is not None}


def simplify_app(app: dict[str, Any]) -> dict[str, Any]:
    """Reduce an app definition to the schema needed to read and write items."""
    fields = []
    for field in app.get("fields") or []:
        if field.get("status") == "deleted":
            continue
        config = field.get("config") or {}
        settings = config.get("settings") or {}
        summary: dict[str, Any] = {
            "external_id": field.get("external_id"),
            "field_id": field.get("field_id"),
            "label": config.get("label"),
            "type": field.get("type"),
            "required": config.get("required", False),
        }
        if config.get("description"):
            summary["description"] = config["description"]
        options = settings.get("options")
        if isinstance(options, list) and options and isinstance(options[0], dict):
            summary["options"] = [
                {"id": option.get("id"), "text": option.get("text")}
                for option in options
                if option.get("status") != "deleted"
            ]
        if settings.get("multiple") is not None:
            summary["multiple"] = settings["multiple"]
        if settings.get("referenced_apps"):
            summary["referenced_app_ids"] = [
                (ref.get("app") or {}).get("app_id") for ref in settings["referenced_apps"]
            ]
        fields.append(summary)

    config = app.get("config") or {}
    return {
        "app_id": app.get("app_id"),
        "name": config.get("name"),
        "item_name": config.get("item_name"),
        "description": config.get("description"),
        "link": app.get("link"),
        "fields": fields,
    }
