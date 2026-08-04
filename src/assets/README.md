# Battle Clash asset boundary

External GLBs are not runtime-ready merely because they downloaded. The
Objaverse workflow keeps assets in `assets/objaverse/quarantine/` until metadata,
license, normalization, multi-perspective renders, gameplay-context renders,
performance, attribution, and three consecutive review passes succeed.

Only entries in `approved-manifest.json` may be loaded by the renderer. Missing
or rejected entries use the existing cube fallback.
