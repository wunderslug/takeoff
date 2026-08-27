from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import HTMLResponse

from app import DATA, STATIC, app, load_project
from plan_model import load_or_build_plan_model


def _remove_existing_root() -> None:
    kept = []
    for route in app.router.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", set()) or set()
        if path == "/" and "GET" in methods:
            continue
        kept.append(route)
    app.router.routes = kept


def _model_for_project(project_id: str, force: bool = False):
    project = load_project(project_id)
    pdir = DATA / project_id
    pdf_path = pdir / "source.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, "Source PDF not found for this project")
    return load_or_build_plan_model(pdf_path, project, pdir / "plan-model.json", force=force)


def _latest_project_id() -> str:
    files = list(DATA.glob("*/project.json"))
    if not files:
        raise HTTPException(404, "No saved projects")
    latest = max(files, key=lambda x: x.stat().st_mtime)
    return latest.parent.name


_remove_existing_root()


@app.get("/")
def index_with_plan_model():
    html_path = STATIC / "index.html"
    html = html_path.read_text(encoding="utf-8")
    addon = '<script src="/static/plan-model-addon.js?v=1"></script>'
    if addon not in html:
        html = html.replace("</body>", f"  {addon}\n</body>")
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@app.get("/api/projects/{project_id}/plan-model")
def get_plan_model(project_id: str):
    return _model_for_project(project_id)


@app.post("/api/projects/{project_id}/plan-model/rebuild")
def rebuild_plan_model(project_id: str):
    return _model_for_project(project_id, force=True)


@app.get("/api/projects/latest/plan-model")
def latest_plan_model():
    return _model_for_project(_latest_project_id())
