from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

MODEL_VERSION = 2

EWP_RE = re.compile(
    r"\b(?:I[- ]?JOISTS?|TJI\s*\d*[A-Z0-9-]*|BCI\s*\d*[A-Z0-9-]*|NI\s*\d+[A-Z0-9-]*|LVL|PSL|LSL|GLULAM|RIM\s+BOARD|EWP)\b",
    re.IGNORECASE,
)
CONVENTIONAL_RE = re.compile(
    r"\b2\s*[xX]\s*(?:4|6|8|10|12)\b.*\b(?:STUDS?|JOISTS?|RAFTERS?|PLATES?|HEADERS?|BEAMS?|POSTS?)\b|"
    r"\b(?:STUDS?|JOISTS?|RAFTERS?|PLATES?|HEADERS?|BEAMS?|POSTS?)\b.*\b2\s*[xX]\s*(?:4|6|8|10|12)\b",
    re.IGNORECASE,
)
TRUSS_RE = re.compile(r"\b(?:GIRDER\s+)?TRUSS(?:ES)?\b", re.IGNORECASE)
HARDWARE_RE = re.compile(
    r"\b(?:SIMPSON|HANGER|HURRICANE|HOLD[- ]?DOWN|STRAP|CLIP|ANCHOR|POST\s+BASE|POST\s+CAP)\b",
    re.IGNORECASE,
)
SCOPE_RE = re.compile(
    r"\b(?:BY\s+OTHERS|NOT\s+IN\s+CONTRACT|NIC|FIELD\s+VERIFY|VERIFY\s+IN\s+FIELD|DEFERRED\s+SUBMITTAL)\b",
    re.IGNORECASE,
)
NOTE_RE = re.compile(r"\b(?:GENERAL\s+NOTES?|FRAMING\s+NOTES?|TRUSS\s+NOTES?|NOTE:)\b", re.IGNORECASE)
LEGEND_RE = re.compile(r"\bLEGEND\b", re.IGNORECASE)
REFERENCE_RE = re.compile(r"\b(?:DETAIL\s*)?(\d{1,2})\s*/\s*([A-Z]{1,3}\s?\d{1,3}(?:\.\d{1,3})?)\b", re.IGNORECASE)
SPACING_RE = re.compile(r"@\s*(\d+(?:\s+\d+/\d+|/\d+)?)\s*[\"”]?\s*O\.?\s*C\.?", re.IGNORECASE)
DIM_RE = re.compile(
    r"(?<!\d)(?:(\d+)\s*['’]\s*-?\s*)?(\d+(?:\s+\d+/\d+|/\d+)?)?\s*[\"”](?!\s*=)",
    re.IGNORECASE,
)
FEET_ONLY_RE = re.compile(r"(?<!\d)(\d+)\s*['’](?!\s*-)")
TRUSS_TYPE_RE = re.compile(r"\b(?:GIRDER\s+)?TRUSS\s*['\"]?([A-Z])['\"]?\b", re.IGNORECASE)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(text: str) -> str:
    return " ".join(text.replace("\u00a0", " ").split())


def _fraction(value: str | None) -> float:
    if not value:
        return 0.0
    value = value.strip()
    if " " in value:
        whole, frac = value.split(None, 1)
        return float(whole) + _fraction(frac)
    if value.startswith("/"):
        value = "1" + value
    if "/" in value:
        a, b = value.split("/", 1)
        try:
            return float(a) / float(b)
        except (ValueError, ZeroDivisionError):
            return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def _dimensions(text: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    seen: set[tuple[int, float, str]] = set()
    for m in DIM_RE.finditer(text):
        feet = int(m.group(1) or 0)
        inches = _fraction(m.group(2))
        if feet == 0 and inches == 0:
            continue
        raw = m.group(0).strip()
        key = (feet, round(inches, 5), raw)
        if key in seen:
            continue
        seen.add(key)
        found.append({
            "raw": raw,
            "feet": feet,
            "inches": inches,
            "total_inches": round(feet * 12 + inches, 5),
        })
    for m in FEET_ONLY_RE.finditer(text):
        feet = int(m.group(1))
        raw = m.group(0).strip()
        key = (feet, 0.0, raw)
        if key in seen:
            continue
        seen.add(key)
        found.append({"raw": raw, "feet": feet, "inches": 0.0, "total_inches": feet * 12})
    return found[:12]


def _scope_for(raw: str, sheet_title: str | None) -> str:
    up = raw.upper()
    title = (sheet_title or "").upper()
    if "DECK" in up or "PORCH" in up:
        return "deck_or_porch"
    if "TRUSS" in up or "ROOF" in up or "RAFTER" in up:
        return "roof_system"
    if "WALL" in up or "STUD" in up or "PLATE" in up:
        return "wall_system"
    if "FLOOR" in up or "FLOOR FRAMING" in title:
        return "floor_system"
    if "JOIST" in up and "ROOF" not in title:
        return "floor_system"
    if "FOUNDATION" in up or "FOUNDATION" in title:
        return "foundation"
    return "unspecified"


def _member_role(raw: str, category: str) -> str:
    up = raw.upper()
    if "TRUSS" in up:
        return "truss"
    if "RIM BOARD" in up:
        return "rim"
    if "HEADER" in up:
        return "header"
    if "BEAM" in up or "GLULAM" in up:
        return "beam"
    if "POST" in up:
        return "post"
    if "RAFTER" in up:
        return "rafter"
    if "STUD" in up:
        return "stud"
    if "PLATE" in up:
        return "plate"
    if "JOIST" in up:
        return "joist"
    # Common I-joist product families can be identified as joist products from the explicit token itself.
    if category == "ewp_callout" and re.search(r"\b(?:TJI|BCI|NI\s*\d+)\b", up):
        return "joist"
    if "LVL" in up or "PSL" in up or "LSL" in up:
        return "engineered_member_unspecified"
    return "unspecified"


def _category(raw: str) -> str | None:
    if SCOPE_RE.search(raw):
        return "scope_or_verification_note"
    if EWP_RE.search(raw):
        return "ewp_callout"
    if TRUSS_RE.search(raw):
        return "truss_callout"
    if HARDWARE_RE.search(raw):
        return "hardware_callout"
    if CONVENTIONAL_RE.search(raw):
        return "conventional_framing_callout"
    if NOTE_RE.search(raw):
        return "note_heading_or_text"
    if LEGEND_RE.search(raw):
        return "legend_text"
    if REFERENCE_RE.search(raw):
        return "detail_reference"
    if DIM_RE.search(raw) or FEET_ONLY_RE.search(raw):
        return "dimension_text"
    return None


def _normalized(raw: str, category: str, sheet_title: str | None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "scope": _scope_for(raw, sheet_title),
        "member_role": _member_role(raw, category),
        "dimensions": _dimensions(raw),
    }
    spacing = SPACING_RE.search(raw)
    if spacing:
        result["spacing_inches"] = _fraction(spacing.group(1))
        result["spacing_raw"] = spacing.group(0)
    refs = []
    for m in REFERENCE_RE.finditer(raw):
        refs.append({"detail": m.group(1), "sheet": re.sub(r"\s+", "", m.group(2).upper())})
    if refs:
        result["references"] = refs
    if category == "truss_callout":
        t = TRUSS_TYPE_RE.search(raw)
        if t:
            result["truss_type"] = t.group(1).upper()
    ewp_tokens = []
    for m in EWP_RE.finditer(raw):
        token = _clean(m.group(0)).upper()
        if token not in ewp_tokens:
            ewp_tokens.append(token)
    if ewp_tokens:
        result["ewp_tokens"] = ewp_tokens
    return result


def _line_records(page: fitz.Page) -> list[dict[str, Any]]:
    data = page.get_text("dict")
    records: list[dict[str, Any]] = []
    for block in data.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            raw = _clean("".join(span.get("text", "") for span in spans))
            if not raw:
                continue
            bbox = line.get("bbox") or block.get("bbox")
            records.append({
                "text": raw,
                "bbox_pt": [round(float(x), 2) for x in bbox] if bbox else None,
                "font_sizes": sorted({round(float(s.get("size", 0)), 2) for s in spans if s.get("size")}),
            })
    return records


def _apply_precedence(model: dict[str, Any]) -> None:
    items = model["items"]
    grouped: dict[tuple[str, str], dict[str, list[dict[str, Any]]]] = {}
    comparable_roles = {"joist", "beam", "header", "post", "rafter", "stud", "plate"}
    for item in items:
        normalized = item.get("normalized", {})
        scope = normalized.get("scope", "unspecified")
        role = normalized.get("member_role", "unspecified")
        if scope == "unspecified" or role not in comparable_roles:
            continue
        grouped.setdefault((scope, role), {}).setdefault(item["category"], []).append(item)

    for (scope, role), groups in grouped.items():
        ewps = groups.get("ewp_callout", [])
        conventional = groups.get("conventional_framing_callout", [])
        if not ewps or not conventional:
            continue
        conflict_id = f"conflict-{len(model['conflicts']) + 1:04d}"
        for item in ewps:
            item["governing_status"] = "governing_by_ewp_policy"
            item["review_status"] = "accepted_by_policy_with_review_note"
            item["conflict_ids"].append(conflict_id)
        for item in conventional:
            item["governing_status"] = "superseded_by_ewp_for_takeoff"
            item["review_status"] = "review_note"
            item["conflict_ids"].append(conflict_id)
        model["conflicts"].append({
            "id": conflict_id,
            "type": "ewp_vs_conventional",
            "scope": scope,
            "member_role": role,
            "blocking": False,
            "status": "review_note",
            "policy": "EWP specifications govern when they conflict with a conventional framing note for the same framing role. Preserve both sources for review.",
            "governing_item_ids": [x["id"] for x in ewps],
            "review_item_ids": [x["id"] for x in conventional],
        })


def build_plan_model(pdf_path: Path, project: dict[str, Any]) -> dict[str, Any]:
    doc = fitz.open(pdf_path)
    pages_by_number = {p["page"]: p for p in project.get("pages", [])}
    model: dict[str, Any] = {
        "model_version": MODEL_VERSION,
        "project_id": project["id"],
        "project_name": project.get("name"),
        "source_sha256": project.get("sha256"),
        "generated_at": now_iso(),
        "policy": {
            "never_invent": True,
            "order_affecting_values": "must be explicitly supported by the plan or user-approved",
            "ewp_precedence": "EWP specifications override conflicting conventional framing notes for the same framing role; the conflict remains a review note.",
        },
        "items": [],
        "conflicts": [],
        "summary": {},
    }

    for idx in range(doc.page_count):
        page = doc.load_page(idx)
        meta = pages_by_number.get(idx + 1, {})
        sheet_number = meta.get("sheet_number")
        sheet_title = meta.get("title")
        for line_no, record in enumerate(_line_records(page), start=1):
            raw = record["text"]
            category = _category(raw)
            if not category:
                continue
            item_id = f"pm-{idx + 1:03d}-{line_no:04d}"
            model["items"].append({
                "id": item_id,
                "page": idx + 1,
                "sheet_number": sheet_number,
                "sheet_title": sheet_title,
                "bbox_pt": record["bbox_pt"],
                "source_type": "pdf_text_layer",
                "raw_text": raw,
                "category": category,
                "normalized": _normalized(raw, category, sheet_title),
                "interpretation_status": "text_supported",
                "governing_status": "source_supported",
                "review_status": "not_reviewed",
                "conflict_ids": [],
            })

        for scale in meta.get("scales", []):
            model["items"].append({
                "id": f"pm-{idx + 1:03d}-scale-{len(model['items']) + 1}",
                "page": idx + 1,
                "sheet_number": sheet_number,
                "sheet_title": sheet_title,
                "bbox_pt": None,
                "source_type": "parsed_sheet_metadata",
                "raw_text": scale,
                "category": "sheet_scale",
                "normalized": {"scale": scale, "scope": "sheet", "member_role": "not_applicable"},
                "interpretation_status": "text_supported",
                "governing_status": "source_supported",
                "review_status": "not_reviewed",
                "conflict_ids": [],
            })

    doc.close()
    _apply_precedence(model)

    counts: dict[str, int] = {}
    for item in model["items"]:
        counts[item["category"]] = counts.get(item["category"], 0) + 1
    model["summary"] = {
        "item_count": len(model["items"]),
        "conflict_count": len(model["conflicts"]),
        "review_note_count": sum(1 for c in model["conflicts"] if c.get("status") == "review_note"),
        "by_category": dict(sorted(counts.items())),
    }
    return model


def load_or_build_plan_model(pdf_path: Path, project: dict[str, Any], output_path: Path, force: bool = False) -> dict[str, Any]:
    if output_path.exists() and not force:
        try:
            current = json.loads(output_path.read_text(encoding="utf-8"))
            if current.get("model_version") == MODEL_VERSION and current.get("source_sha256") == project.get("sha256"):
                return current
        except (json.JSONDecodeError, OSError):
            pass
    model = build_plan_model(pdf_path, project)
    output_path.write_text(json.dumps(model, indent=2), encoding="utf-8")
    return model
