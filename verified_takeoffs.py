from __future__ import annotations

from typing import Any

LAKE_STREET_SHA256 = "77809eb3e79b81d6b2c151638d82813ba597d54761bd7477c71941ca84467d41"


def lake_street_takeoff() -> dict[str, Any]:
    """First verified regression case.

    Quantities below are derived only from explicit written dimensions / framing callouts
    on the Lake Street construction set. Anything not explicit enough to order remains
    unresolved instead of being guessed.
    """
    return {
        "case_id": "lake-street-2026-07-21",
        "mode": "verified_regression_case",
        "status": "partial_review_required",
        "policy": {
            "never_invent": True,
            "ewp_precedence": True,
            "ewp_precedence_text": (
                "When conventional framing notes conflict with EWP specifications, "
                "use the EWP specification for takeoff and retain the conflict as a review note. "
                "If the EWP information itself is unclear or conflicting, stop and ask the user."
            ),
            "standard_dimensional_max_ft": 16,
        },
        "review_notes": [
            {
                "severity": "review",
                "title": "EWP specification overrides conventional floor-joist note",
                "text": (
                    "A3 building section calls out conventional 2x10 floor joists, while A4 "
                    "first-floor framing plan specifies 9-1/2 in. NI40x I-joists @ 16 in. O.C. "
                    "Per project policy, the A4 EWP specification controls. Keep this conflict "
                    "visible for review; do not substitute 2x10 floor joists."
                ),
                "sources": ["A3", "A4"],
            },
            {
                "severity": "info",
                "title": "Do not scale drawings",
                "text": "The plan set directs the estimator to use written dimensions only.",
                "sources": ["A1", "A2", "A3", "A4", "A5"],
            },
            {
                "severity": "info",
                "title": "Roof trusses require supplier engineering",
                "text": (
                    "A4 truss notes require the truss manufacturer to provide shop drawings "
                    "and structural engineering. The app may package/count truss requirements "
                    "but must not engineer or resize trusses."
                ),
                "sources": ["A4", "A5"],
            },
        ],
        "blocking_questions": [
            {
                "id": "ls-ewp-stair-header-lengths",
                "title": "Stair LVL header order lengths are not explicit",
                "question": (
                    "A4 shows two 1-3/4 in. x 9-1/2 in. LVL stair headers, but the exact "
                    "purchase lengths are not explicitly dimensioned. Confirm the required "
                    "order length for each header before the LVL package is finalized."
                ),
                "source": "A4",
            }
        ],
        "packages": [
            {
                "id": "P02",
                "name": "First Floor Box",
                "status": "review_required",
                "materials": [
                    {
                        "item": "EWP-IJ-01",
                        "qty": 79,
                        "unit": "EA",
                        "material": "9-1/2\" NI40x I-joist",
                        "purchase": "Supplier cut-to-length",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4",
                        "basis": "Written bay widths + 16 in. O.C. spacing; rim boards are not counted as I-joists.",
                        "breakdown": [
                            {"qty": 13, "length": "12'-6\"", "location": "Upper-right 18'-0\" bay"},
                            {"qty": 29, "length": "13'-6\"", "location": "Main upper 40'-0\" bay"},
                            {"qty": 15, "length": "14'-0\"", "location": "Lower-left 20'-8\" bay"},
                            {"qty": 11, "length": "13'-6\"", "location": "Lower-right 15'-10\" bay"},
                            {"qty": 11, "length": "6'-6\"", "location": "Bottom-right 16'-0\" bay"},
                        ],
                    },
                    {
                        "item": "EWP-LVL-01",
                        "qty": 3,
                        "unit": "EA",
                        "material": "1-3/4\" x 9-1/2\" LVL 2.0E",
                        "length": "40'-0\"",
                        "assembly": "5-1/4\" x 9-1/2\" built-up center LVL beam (3-ply)",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4",
                    },
                    {
                        "item": "EWP-LVL-02",
                        "qty": 2,
                        "unit": "EA",
                        "material": "1-3/4\" x 9-1/2\" LVL 2.0E",
                        "length": "18'-0\"",
                        "assembly": "3-1/2\" x 9-1/2\" built-up north/right LVL beam (2-ply)",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4",
                    },
                    {
                        "item": "EWP-LVL-03",
                        "qty": 2,
                        "unit": "EA",
                        "material": "1-3/4\" x 9-1/2\" LVL 2.0E",
                        "length": "16'-0\"",
                        "assembly": "3-1/2\" x 9-1/2\" built-up south/right LVL beam (2-ply)",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4",
                    },
                    {
                        "item": "EWP-LVL-04",
                        "qty": 2,
                        "unit": "EA",
                        "material": "1-3/4\" x 9-1/2\" LVL 2.0E stair header",
                        "length": "CLARIFICATION REQUIRED",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4",
                        "status": "BLOCKED",
                    },
                    {
                        "item": "SUBFLOOR-01",
                        "qty": "PENDING",
                        "unit": "SHEETS",
                        "material": "3/4\" Advantech subfloor",
                        "stock_status": "STOCK",
                        "source": "A3",
                        "status": "MEASUREMENT REQUIRED",
                        "note": "Do not order until stair/opening deductions are verified.",
                    },
                    {
                        "item": "RIM-01",
                        "qty": "PENDING",
                        "unit": "LF",
                        "material": "2x10 rim board",
                        "stock_status": "STOCK / LENGTH DEPENDENT",
                        "source": "A4",
                        "status": "MEASUREMENT REQUIRED",
                    },
                ],
            },
            {
                "id": "P06",
                "name": "Roof / Trusses",
                "status": "supplier_engineering_required",
                "materials": [
                    {
                        "item": "TRUSS-01",
                        "qty": "SUPPLIER LAYOUT",
                        "unit": "PACKAGE",
                        "material": "Roof truss package — types A through G",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4 / A5",
                        "status": "SUPPLIER ENGINEERING REQUIRED",
                    },
                    {
                        "item": "HW-H25A",
                        "qty": "TIED TO FINAL TRUSS COUNT",
                        "unit": "EA",
                        "material": "Simpson H2.5A hurricane clips",
                        "stock_status": "STOCK",
                        "source": "A4",
                        "status": "PENDING TRUSS LAYOUT",
                    },
                    {
                        "item": "HW-HTU26",
                        "qty": "REVIEW",
                        "unit": "EA",
                        "material": "Simpson HTU26 face-mount truss hangers",
                        "stock_status": "STOCK / VERIFY",
                        "source": "A4",
                        "status": "QUANTITY REVIEW",
                    },
                ],
            },
            {
                "id": "P07",
                "name": "Deck / Exterior Framing",
                "status": "partial",
                "materials": [
                    {
                        "item": "DECK-J-01",
                        "qty": 7,
                        "unit": "CUTS",
                        "material": "2x8 PT deck joists",
                        "cut_length": "9'-0\"",
                        "purchase": "7 — 2x8x10 PT",
                        "stock_status": "STOCK",
                        "source": "A4",
                    },
                    {
                        "item": "DECK-B-01",
                        "qty": 3,
                        "unit": "EA",
                        "material": "2x8 PT built-up beam plies",
                        "length": "10'-0\"",
                        "purchase": "3 — 2x8x10 PT",
                        "stock_status": "STOCK",
                        "source": "A4",
                    },
                    {
                        "item": "DECK-J-02",
                        "qty": 16,
                        "unit": "CUTS",
                        "material": "2x8 PT deck joists",
                        "cut_length": "5'-0\"",
                        "purchase": "5 — 2x8x16 PT + 1 — 2x8x8 PT",
                        "stock_status": "STOCK",
                        "source": "A4",
                    },
                    {
                        "item": "DECK-B-02",
                        "qty": 3,
                        "unit": "EA",
                        "material": "2x10 PT built-up beam plies",
                        "length": "22'-0\"",
                        "purchase": "3 — 2x10x22 PT",
                        "stock_status": "SPECIAL ORDER",
                        "source": "A4",
                        "note": "Over the 16 ft standard dimensional-lumber limit.",
                    },
                    {
                        "item": "DECK-RL-01",
                        "qty": "PENDING",
                        "unit": "LF",
                        "material": "2x8 PT rim / ledger",
                        "stock_status": "STOCK / LENGTH DEPENDENT",
                        "source": "A4",
                        "status": "MEASUREMENT REQUIRED",
                    },
                ],
            },
        ],
        "cut_plan": [
            {
                "package": "P07",
                "board_ids": "P07-JU-001…007",
                "qty_boards": 7,
                "stock": "2x8x10 PT",
                "cuts_each": ["9'-0\""],
                "destination": "Upper deck joists",
                "drop_each": "11-7/8\"",
                "kerf": "1/8\"",
            },
            {
                "package": "P07",
                "board_ids": "P07-JL-001…005",
                "qty_boards": 5,
                "stock": "2x8x16 PT",
                "cuts_each": ["5'-0\"", "5'-0\"", "5'-0\""],
                "destination": "Lower deck joists",
                "drop_each": "11-5/8\"",
                "kerf": "1/8\" per cut",
            },
            {
                "package": "P07",
                "board_ids": "P07-JL-006",
                "qty_boards": 1,
                "stock": "2x8x8 PT",
                "cuts_each": ["5'-0\""],
                "destination": "Lower deck joist",
                "drop_each": "2'-11-7/8\"",
                "kerf": "1/8\"",
            },
        ],
        "ewp_cut_schedule": [
            {"qty": 13, "member": "9-1/2\" NI40x", "length": "12'-6\"", "location": "Upper-right bay"},
            {"qty": 29, "member": "9-1/2\" NI40x", "length": "13'-6\"", "location": "Main upper bay"},
            {"qty": 15, "member": "9-1/2\" NI40x", "length": "14'-0\"", "location": "Lower-left bay"},
            {"qty": 11, "member": "9-1/2\" NI40x", "length": "13'-6\"", "location": "Lower-right bay"},
            {"qty": 11, "member": "9-1/2\" NI40x", "length": "6'-6\"", "location": "Bottom-right bay"},
            {"qty": 3, "member": "1-3/4\" x 9-1/2\" LVL 2.0E", "length": "40'-0\"", "location": "Center beam plies"},
            {"qty": 2, "member": "1-3/4\" x 9-1/2\" LVL 2.0E", "length": "18'-0\"", "location": "North/right beam plies"},
            {"qty": 2, "member": "1-3/4\" x 9-1/2\" LVL 2.0E", "length": "16'-0\"", "location": "South/right beam plies"},
            {"qty": 2, "member": "1-3/4\" x 9-1/2\" LVL 2.0E", "length": "UNRESOLVED", "location": "Stair headers — clarification required"},
        ],
        "scope_gaps": [
            "2x10 rim-board quantity is not finalized yet.",
            "3/4 in. Advantech sheet quantity is not finalized yet.",
            "PT rim/ledger footage is not finalized yet.",
            "Wall framing/header takeoff is not yet included in this first verified package pass.",
            "Final truss counts remain supplier-layout dependent.",
        ],
    }


def verified_takeoff_for_sha256(sha256: str) -> dict[str, Any] | None:
    if sha256.lower() == LAKE_STREET_SHA256:
        return lake_street_takeoff()
    return None
