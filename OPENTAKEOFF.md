# OpenTakeoff integration

This project uses OpenTakeoff as the measurement-canvas foundation.

- Upstream: https://github.com/Kentucky-ai/opentakeoff
- License: Apache-2.0
- Pinned upstream commit: `52be241e485e819db31085ff9243e46d87127e0d`
- Upstream web app requires Node 24+ and builds to a client-only static `dist/`.

## Why it is here

We are not rebuilding PDF rendering, scale calibration, snapping, geometry measurement, provenance, or marked-plan output from scratch. OpenTakeoff provides those measurement primitives. This repository will add the lumber/framing-specific workflow above them:

1. plan review and structured Plan Model
2. verified measurement/provenance
3. framing interpretation
4. EWP precedence and clarification rules
5. material requirements
6. yard stock/special-order conversion
7. cut optimization and package output

## Current milestone

The OpenTakeoff canvas runs as a separate Docker service on port `3016`, beside the existing plan-review service on port `3015`.

This milestone proves the upstream engine can run in our deployment and gives us a real measurement canvas for Lake Street regression testing. It does **not** yet connect OpenTakeoff measurements to the Plan Model or automatically produce lumber quantities.

The upstream commit is intentionally pinned. We will update it deliberately after regression testing instead of silently consuming upstream changes.
