from __future__ import annotations

import json
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"
DATA = BASE / "data" / "projects"
DATA.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Blueprint Takeoff")
app.mount("/static", StaticFiles(directory=STATIC), name="static")
app.mount("/project-files", StaticFiles(directory=DATA), name="project-files")

SHEET_RE = re.compile(r"\b([A-Z]{1,3}\s?\d{1,3}(?:\.\d{1,3})?)\b")
SCALE_RE = re.compile(
    r"(?:(?:SCALE|SCALE:)\s*)?((?:\d+\s+)?\d+/\d+|\d+)\s*[\"”]?\s*=\s*(\d+)\s*['’]\s*-?\s*(\d+)?\s*[\"”]?",
    re.IGNORECASE,
)
SCALE_AS_NOTED_RE = re.compile(r"\bSCALE\s*:?\s*AS\s+NOTED\b", re.IGNORECASE)
TITLE_KEYWORDS = [
    "FOUNDATION PLAN", "FIRST FLOOR PLAN", "SECOND FLOOR PLAN", "FLOOR PLAN",
    "ROOF FRAMING PLAN", "FLOOR FRAMING PLAN", "FRAMING PLAN", "ROOF PLAN",
    "ELEVATIONS", "ELEVATION", "BUILDING SECTION", "WALL SECTION", "SECTIONS",
    "DETAILS", "DETAIL", "GENERAL NOTES", "STRUCTURAL NOTES", "LEGEND",
    "SCHEDULES", "SCHEDULE", "COVER SHEET", "COVER", "SITE PLAN",
]
REVIEW_TERMS = [
    "GENERAL NOTES", "STRUCTURAL NOTES", "LEGEND", "SCHEDULE", "HEADER", "BEAM",
    "LVL", "LSL", "PSL", "GLULAM", "I-JOIST", "I JOIST", "TRUSS", "RIM BOARD",
    "HANGER", "SIMPSON", "HOLDOWN", "HOLD-DOWN", "ANCHOR", "SHEAR", "BLOCKING",
    "BY OTHERS", "NOT IN CONTRACT", "NIC", "FIELD VERIFY", "VERIFY IN FIELD",
    "DEFERRED SUBMITTAL", "TRUSS MANUFACTURER", "ENGINEER", "PT ", "PRESSURE TREATED",
]
BLOCKING_SCOPE_TERMS = [
    "FIELD VERIFY", "VERIFY IN FIELD", "BY OTHERS", "NOT IN CONTRACT", "NIC",
    "DEFERRED SUBMITTAL", "TRUSS MANUFACTURER", "ENGINEER TO", "ENGINEERED BY",
]
REFERENCE_RE = re.compile(r"\b(?:DETAIL\s*)?(\d{1,2})\s*/\s*([A-Z]{1,3}\s?\d{1,3}(?:\.\d{1,3})?)\b", re.IGNORECASE)


class ResolveBody(BaseModel):
    answer: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def project_dir(project_id: str) -> Path:
    p = DATA / project_id
    if not p.exists():
        raise HTTPException(404, "Project not found")
    return p


def load_project(project_id: str) -> dict[str, Any]:
    p = project_dir(project_id) / "project.json"
    if not p.exists():
        raise HTTPException(404, "Project metadata not found")
    return json.loads(p.read_text(encoding="utf-8"))


def save_project(project: dict[str, Any]) -> None:
    p = DATA / project["id"] / "project.json"
    p.write_text(json.dumps(project, indent=2), encoding="utf-8")


def normalize_sheet_number(value: str) -> str:
    return re.sub(r"\s+", "", value.upper())


def detect_sheet_number(lines: list[str]) -> tuple[str | None, list[str]]:
    candidates: list[str] = []
    # Title blocks tend to be near the end of extracted text. Prefer that region.
    regions = [lines[-80:], lines]
    for region in regions:
        for line in region:
            text = line.strip().upper()
            if not text or len(text) > 80:
                continue
            for m in SHEET_RE.finditer(text):
                cand = normalize_sheet_number(m.group(1))
                # Avoid obvious dimension-like false positives and revision dates.
                if re.fullmatch(r"[A-Z]{1,3}\d{1,3}(?:\.\d{1,3})?", cand):
                    if cand not in candidates:
                        candidates.append(cand)
        if candidates:
            break
    return (candidates[0] if candidates else None, candidates[:8])


def detect_title(lines: list[str]) -> tuple[str | None, list[str]]:
    ranked: list[tuple[int, int, str]] = []
    seen: set[str] = set()
    for line_idx, line in enumerate(lines):
        clean = " ".join(line.strip().split())
        up = clean.upper()
        if not clean or len(clean) > 100:
            continue
        for priority, kw in enumerate(TITLE_KEYWORDS):
            if kw in up:
                if clean not in seen:
                    seen.add(clean)
                    ranked.append((priority, line_idx, clean))
                break
    ranked.sort(key=lambda x: (x[0], x[1], len(x[2])))
    matches = [x[2] for x in ranked]
    return (matches[0] if matches else None, matches[:8])


def detect_scales(text: str) -> list[str]:
    found: list[str] = []
    if SCALE_AS_NOTED_RE.search(text):
        found.append("AS NOTED")
    for m in SCALE_RE.finditer(text):
        left = m.group(1).replace(" ", "")
        feet = m.group(2)
        inches = m.group(3) or "0"
        value = f'{left}\" = {feet}\'-{inches}\"'
        if value not in found:
            found.append(value)
    return found[:20]


def compact_lines(text: str) -> list[str]:
    return [" ".join(x.split()) for x in text.splitlines() if " ".join(x.split())]


def collect_review_hits(lines: list[str]) -> list[dict[str, str]]:
    hits: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for line in lines:
        up = line.upper()
        for term in REVIEW_TERMS:
            if term in up:
                key = (term, line)
                if key in seen:
                    continue
                seen.add(key)
                hits.append({"term": term.strip(), "text": line[:400]})
                break
        if len(hits) >= 80:
            break
    return hits


def add_clarification(project: dict[str, Any], *, page: int | None, kind: str, title: str, question: str, evidence: str, blocking: bool = True) -> None:
    clar_id = f"c-{len(project['clarifications'])+1:04d}"
    project["clarifications"].append({
        "id": clar_id,
        "page": page,
        "kind": kind,
        "title": title,
        "question": question,
        "evidence": evidence,
        "blocking": blocking,
        "status": "open",
        "answer": None,
        "resolved_at": None,
    })


def parse_pdf(pdf_path: Path, project_id: str, original_name: str) -> dict[str, Any]:
    doc = fitz.open(pdf_path)
    project: dict[str, Any] = {
        "id": project_id,
        "name": Path(original_name).stem,
        "filename": original_name,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "page_count": doc.page_count,
        "pages": [],
        "clarifications": [],
        "cross_references": [],
        "missing_references": [],
        "analysis": {
            "status": "parsed",
            "text_pages": 0,
            "image_only_pages": 0,
            "review_hit_count": 0,
            "known_sheet_numbers": [],
            "rule": "Never invent or assume. Any value affecting an order must be supported by the plans or explicitly approved by the user.",
        },
    }

    pdir = DATA / project_id
    previews = pdir / "previews"
    thumbs = pdir / "thumbs"
    previews.mkdir(exist_ok=True)
    thumbs.mkdir(exist_ok=True)

    for idx in range(doc.page_count):
        page = doc.load_page(idx)
        text = page.get_text("text") or ""
        lines = compact_lines(text)
        sheet_no, sheet_candidates = detect_sheet_number(lines)
        title, title_candidates = detect_title(lines)
        scales = detect_scales(text)
        review_hits = collect_review_hits(lines)

        # Render readable preview and compact thumbnail.
        preview_pix = page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False)
        preview_pix.save(previews / f"page-{idx+1}.png")
        thumb_pix = page.get_pixmap(matrix=fitz.Matrix(0.28, 0.28), alpha=False)
        thumb_pix.save(thumbs / f"page-{idx+1}.png")

        width_pt, height_pt = page.rect.width, page.rect.height
        page_obj = {
            "page": idx + 1,
            "sheet_number": sheet_no,
            "sheet_number_candidates": sheet_candidates,
            "title": title,
            "title_candidates": title_candidates,
            "scales": scales,
            "width_pt": round(width_pt, 2),
            "height_pt": round(height_pt, 2),
            "text_characters": len(text),
            "has_extractable_text": bool(text.strip()),
            "review_hits": review_hits,
            "preview_url": f"/project-files/{project_id}/previews/page-{idx+1}.png",
            "thumb_url": f"/project-files/{project_id}/thumbs/page-{idx+1}.png",
            "text_url": f"/api/projects/{project_id}/pages/{idx+1}/text",
        }
        project["pages"].append(page_obj)
        (pdir / f"page-{idx+1}.txt").write_text(text, encoding="utf-8")

        if text.strip():
            project["analysis"]["text_pages"] += 1
        else:
            project["analysis"]["image_only_pages"] += 1
            add_clarification(
                project, page=idx+1, kind="no_text", title=f"Page {idx+1}: no extractable text",
                question="This sheet appears scanned or image-only. Confirm that this sheet must be visually/OCR reviewed before any material decisions are made.",
                evidence="PyMuPDF found no extractable text on this page. The app will not infer notes, dimensions, schedules, or callouts from an empty text layer.",
            )

        if not sheet_no:
            add_clarification(
                project, page=idx+1, kind="sheet_number", title=f"Page {idx+1}: sheet number not confirmed",
                question="What is the authoritative sheet number for this page?",
                evidence="No unambiguous sheet number was detected in the extracted PDF text.",
            )

        if not title:
            add_clarification(
                project, page=idx+1, kind="sheet_title", title=f"Page {idx+1}: sheet title not confirmed",
                question="What is the authoritative sheet title for this page?",
                evidence="No unambiguous plan-title keyword was detected in the extracted PDF text.",
                blocking=False,
            )

        # A scale is required before geometry-based measurement. We do not guess it.
        if not scales and (title and any(k in title.upper() for k in ["PLAN", "ELEVATION", "SECTION", "DETAIL"])):
            add_clarification(
                project, page=idx+1, kind="scale", title=f"{sheet_no or f'Page {idx+1}'}: scale not detected",
                question="What scale should be used for geometry-based measurements on this sheet, or should it be treated as 'As Noted'?",
                evidence="No explicit scale was detected in the extracted text. Geometry-based takeoff is blocked until scale is supplied or verified.",
            )

        project["analysis"]["review_hit_count"] += len(review_hits)

    known_sheets = sorted({p["sheet_number"] for p in project["pages"] if p["sheet_number"]})
    project["analysis"]["known_sheet_numbers"] = known_sheets

    # Cross-reference scan after the sheet list is known.
    known_set = set(known_sheets)
    missing: dict[str, set[int]] = {}
    for p in project["pages"]:
        text = (pdir / f"page-{p['page']}.txt").read_text(encoding="utf-8")
        for m in REFERENCE_RE.finditer(text):
            detail_no = m.group(1)
            ref_sheet = normalize_sheet_number(m.group(2))
            project["cross_references"].append({
                "from_page": p["page"],
                "from_sheet": p["sheet_number"],
                "detail": detail_no,
                "to_sheet": ref_sheet,
            })
            if ref_sheet not in known_set:
                missing.setdefault(ref_sheet, set()).add(p["page"])

    for ref_sheet, pages in sorted(missing.items()):
        project["missing_references"].append({"sheet": ref_sheet, "referenced_from_pages": sorted(pages)})
        add_clarification(
            project, page=min(pages), kind="missing_reference", title=f"Referenced sheet {ref_sheet} is not in the plan set",
            question=f"Provide sheet {ref_sheet}, or confirm that the reference is intentionally unavailable and should remain excluded from the takeoff.",
            evidence=f"The plan set contains references to {ref_sheet} from page(s) {', '.join(map(str, sorted(pages)))} but no loaded sheet was confidently identified as {ref_sheet}.",
        )

    # Surface explicit scope/verification notes without interpreting them.
    for p in project["pages"]:
        for hit in p["review_hits"]:
            if hit["term"] in [x.strip() for x in BLOCKING_SCOPE_TERMS]:
                # Review note only; not every FIELD VERIFY note changes the order, so do not fabricate a question.
                pass

    doc.close()
    return project


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/health")
def health():
    return {"ok": True, "service": "Blueprint Takeoff", "time": now_iso()}


@app.post("/api/projects/upload")
async def upload_project(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Upload a PDF plan set")

    project_id = uuid.uuid4().hex[:12]
    pdir = DATA / project_id
    pdir.mkdir(parents=True, exist_ok=False)
    pdf_path = pdir / "source.pdf"

    try:
        with pdf_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)
        if pdf_path.stat().st_size == 0:
            raise HTTPException(400, "The uploaded PDF is empty")
        project = parse_pdf(pdf_path, project_id, file.filename)
        save_project(project)
        return project
    except HTTPException:
        shutil.rmtree(pdir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(pdir, ignore_errors=True)
        raise HTTPException(422, f"Could not read this PDF: {exc}") from exc


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    return load_project(project_id)


@app.get("/api/projects/{project_id}/pages/{page_num}/text")
def get_page_text(project_id: str, page_num: int):
    pdir = project_dir(project_id)
    path = pdir / f"page-{page_num}.txt"
    if not path.exists():
        raise HTTPException(404, "Page text not found")
    return {"page": page_num, "text": path.read_text(encoding="utf-8")}


@app.post("/api/projects/{project_id}/clarifications/{clarification_id}/resolve")
def resolve_clarification(project_id: str, clarification_id: str, body: ResolveBody):
    answer = body.answer.strip()
    if not answer:
        raise HTTPException(400, "A user-approved answer is required")
    project = load_project(project_id)
    item = next((c for c in project["clarifications"] if c["id"] == clarification_id), None)
    if not item:
        raise HTTPException(404, "Clarification not found")
    item["status"] = "resolved"
    item["answer"] = answer
    item["resolved_at"] = now_iso()

    # Apply only explicit metadata clarifications. No inference.
    if item.get("page"):
        page = next((p for p in project["pages"] if p["page"] == item["page"]), None)
        if page:
            if item["kind"] == "sheet_number":
                page["sheet_number"] = normalize_sheet_number(answer)
            elif item["kind"] == "sheet_title":
                page["title"] = answer
            elif item["kind"] == "scale":
                page["scales"] = [answer]

    project["updated_at"] = now_iso()
    save_project(project)
    return project


@app.post("/api/projects/{project_id}/clarifications/{clarification_id}/reopen")
def reopen_clarification(project_id: str, clarification_id: str):
    project = load_project(project_id)
    item = next((c for c in project["clarifications"] if c["id"] == clarification_id), None)
    if not item:
        raise HTTPException(404, "Clarification not found")
    item["status"] = "open"
    item["answer"] = None
    item["resolved_at"] = None
    project["updated_at"] = now_iso()
    save_project(project)
    return project


@app.get("/api/projects/{project_id}/finalize-check")
def finalize_check(project_id: str):
    project = load_project(project_id)
    blocking_open = [c for c in project["clarifications"] if c["blocking"] and c["status"] == "open"]
    return {
        "can_finalize": len(blocking_open) == 0,
        "blocking_open": blocking_open,
        "message": "Ready for the next takeoff stage" if not blocking_open else "Resolve every blocking clarification before takeoff calculations can be finalized.",
    }
