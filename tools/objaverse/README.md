# Objaverse ingestion boundary

This CLI implements a quarantine-first asset workflow. It can search and fetch
through the optional official `objaverse` Python package, record metadata and
hashes, create review runs, and promote only after three complete consecutive
passes. Rendering stays explicitly blocked until a Blender/headless renderer
adapter exists; a downloaded GLB is never treated as visual proof.

Examples:

```sh
python3 tools/objaverse/cli.py search goat --limit 10
python3 tools/objaverse/cli.py fetch <objaverse-uid>
python3 tools/objaverse/cli.py render objaverse-<uid>
python3 tools/objaverse/cli.py review objaverse-<uid> --pass-number 1 --decision pending
python3 tools/objaverse/cli.py promote objaverse-<uid>
```
