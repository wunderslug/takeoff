# Blueprint Takeoff v2 - working PDF intake/review slice

This replaces the earlier UI-only mockup. It is a real local web app with a FastAPI + PyMuPDF backend.

## What works now

- Upload a real multi-page blueprint PDF
- Drag/drop or file picker
- Save the original PDF locally in the project data folder
- Render every sheet to a browser-viewable PNG
- Render sheet thumbnails
- Navigate pages and zoom the rendered plan
- Extract the PDF text layer from every page
- Detect likely sheet numbers from explicit PDF text
- Detect common explicit sheet titles
- Detect explicit drawing scale text when present
- Surface framing/structural/scope keywords without pretending to interpret them
- Detect detail/sheet cross-references such as `6/S5.2`
- Flag referenced sheets that are missing from the loaded set
- Create clarification items when critical metadata cannot be confirmed
- Save explicit user answers to clarifications
- Block final review while blocking clarifications remain open
- No fake lumber quantities

## Deliberately NOT implemented yet

- OCR/vision reading of image-only plans
- OpenTakeoff measurement-engine integration
- Geometry-based measurements
- Lumber assembly calculations
- Stock/special-order engine
- Cut optimization/waste engine
- Material packages and exports

Those come after the plan-reading layer is trustworthy.

## Run with Docker

```bash
docker compose up -d --build
```

Open:

`http://localhost:3015`

Project data persists in `./data`.

## Run directly with Python

```bash
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 3015
```

Then open `http://localhost:3015`.

## Design rule

**Never invent or assume.** If a value affects a material order, it must be supported by the plans or supplied/approved explicitly by the user.

## OpenTakeoff

OpenTakeoff remains the intended measurement-engine candidate. It is Apache-2.0 and exposes the same measurement engine to its browser UI and MCP layer. This v2 app intentionally establishes the PDF intake / document-reading / clarification workflow first so we do not bury plan interpretation errors underneath quantity calculations.
