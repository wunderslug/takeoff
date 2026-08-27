from __future__ import annotations

from fastapi import HTTPException
from fastapi.responses import HTMLResponse

from app import DATA, STATIC, app, load_project
from plan_model import load_or_build_plan_model


def _remove_routes() -> None:
    blocked_paths = {
        "/",
        "/api/projects/{project_id}/takeoff",
        "/api/projects/{project_id}/takeoff/questions/{question_id}/resolve",
    }
    kept = []
    for route in app.router.routes:
        path = getattr(route, "path", None)
        if path in blocked_paths:
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


_remove_routes()


@app.get("/")
def index_with_plan_model():
    html_path = STATIC / "index.html"
    html = html_path.read_text(encoding="utf-8")

    # Add the readability pass without modifying the base template. Versioned URLs
    # keep browser caches from serving stale UI during development.
    if "readability.css" not in html:
        html = html.replace("</head>", '  <link rel="stylesheet" href="/static/readability.css?v=1" />\n</head>')

    addons = (
        '  <script src="/static/layout-controls.js?v=1"></script>\n'
        '  <script src="/static/plan-model-v2.js?v=1"></script>\n'
        '  <script src="/static/opentakeoff-launcher.js?v=1"></script>\n'
    )
    if "opentakeoff-launcher.js" not in html:
        html = html.replace("</body>", f"{addons}</body>")

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


@app.get("/api/projects/{project_id}/takeoff")
def takeoff_not_enabled(project_id: str):
    # Intentionally disabled. Lake Street remains a regression plan, never a production hard-coded takeoff.
    load_project(project_id)
    raise HTTPException(
        409,
        "Material takeoff is intentionally disabled in this milestone. The general measurement/framing engine has not been verified yet; no project-specific shortcut will be used."
    )


@app.post("/api/projects/{project_id}/takeoff/questions/{question_id}/resolve")
def takeoff_question_not_enabled(project_id: str, question_id: str):
    load_project(project_id)
    raise HTTPException(409, "Material takeoff questions are disabled until the general takeoff engine is implemented.")
