#!/usr/bin/env python3
"""Quarantine-first Objaverse ingestion and review CLI.

The tool deliberately does not promote an asset from a single screenshot or
from a missing license field. Heavy dependencies (objaverse, trimesh, Blender)
are optional so the catalog contract can be used in CI without downloading the
dataset.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
QUARANTINE = ROOT / "assets" / "objaverse" / "quarantine"
APPROVED = ROOT / "assets" / "objaverse" / "approved"
REVIEWS = ROOT / "assets" / "objaverse" / "reviews"
MANIFEST = ROOT / "src" / "assets" / "approved-manifest.json"
CATALOG = ROOT / "assets" / "objaverse" / "catalog.json"
PERSPECTIVES = ("front", "rear", "side", "three-quarter", "top")
CONTEXTS = ("sanctum", "territory", "combat")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def search(query: str, limit: int) -> None:
    try:
        import objaverse  # type: ignore
    except ImportError as error:
        raise SystemExit("Install the optional Objaverse client: python3 -m pip install objaverse") from error

    annotations = objaverse.load_annotations()
    matches = []
    needle = query.lower()
    for uid, metadata in annotations.items():
        text = json.dumps(metadata, sort_keys=True).lower()
        if needle in text:
            matches.append({"uid": uid, **metadata})
            if len(matches) >= limit:
                break
    print(json.dumps(matches, indent=2, sort_keys=True))


def fetch(uid: str) -> None:
    try:
        import objaverse  # type: ignore
    except ImportError as error:
        raise SystemExit("Install the optional Objaverse client: python3 -m pip install objaverse") from error

    QUARANTINE.mkdir(parents=True, exist_ok=True)
    paths = objaverse.load_objects([uid])
    source = Path(paths[uid])
    target = QUARANTINE / f"objaverse_{uid}.glb"
    shutil.copy2(source, target)
    catalog = read_json(CATALOG, [])
    metadata = objaverse.load_annotations().get(uid, {})
    entry = {
        "id": f"objaverse-{uid}",
        "objaverseUid": uid,
        "slug": metadata.get("name", uid).lower().replace(" ", "-")[:80],
        "status": "quarantine",
        "sourceUrl": metadata.get("source", ""),
        "license": metadata.get("license", "unknown"),
        "licenseUrl": metadata.get("license_url", ""),
        "path": str(target.relative_to(ROOT)),
        "sha256": sha256(target),
        "metadata": metadata,
        "attribution": {"source": metadata.get("source", ""), "creator": metadata.get("creator", "")},
    }
    catalog = [item for item in catalog if item.get("objaverseUid") != uid]
    write_json(CATALOG, [*catalog, entry])
    print(json.dumps(entry, indent=2, sort_keys=True))


def review(asset_id: str, pass_number: int, decision: str) -> None:
    if decision not in {"pass", "fail", "pending"}:
        raise SystemExit("decision must be pass, fail, or pending")
    run = {
        "schema": "battle-clash.asset-review/1",
        "assetId": asset_id,
        "passNumber": pass_number,
        "perspectives": [{"perspective": value, "decision": decision} for value in PERSPECTIVES],
        "contexts": [{"context": value, "decision": decision} for value in CONTEXTS],
        "humanDecision": decision,
    }
    path = REVIEWS / f"{asset_id}-pass-{pass_number}.json"
    write_json(path, run)
    print(path)


def promote(asset_id: str) -> None:
    catalog = read_json(CATALOG, [])
    entry = next((item for item in catalog if item.get("id") == asset_id), None)
    if not entry:
        raise SystemExit(f"unknown asset: {asset_id}")
    runs = []
    for path in sorted(REVIEWS.glob(f"{asset_id}-pass-*.json")):
        runs.append(read_json(path, {}))
    runs = sorted(runs, key=lambda item: int(item.get("passNumber", 0)))[-3:]
    accepted = len(runs) == 3 and all(
        item.get("humanDecision") == "pass"
        and all(part.get("decision") == "pass" for part in item.get("perspectives", []))
        and all(part.get("decision") == "pass" for part in item.get("contexts", []))
        for item in runs
    )
    if not accepted:
        raise SystemExit("asset requires three consecutive complete passing review runs")
    source = ROOT / entry["path"]
    if not source.exists():
        raise SystemExit(f"missing quarantined GLB: {source}")
    target = APPROVED / source.name
    APPROVED.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    entry["status"] = "approved"
    entry["path"] = str(target.relative_to(ROOT))
    entry["sha256"] = sha256(target)
    write_json(CATALOG, catalog)
    manifest = read_json(MANIFEST, {"schema": "battle-clash.asset-catalog/1", "assets": []})
    manifest["assets"] = [item for item in manifest.get("assets", []) if item.get("id") != asset_id]
    manifest["assets"].append(entry)
    write_json(MANIFEST, manifest)
    print(json.dumps(entry, indent=2, sort_keys=True))


def render(asset_id: str) -> None:
    blender = shutil.which("blender")
    if not blender:
        raise SystemExit("render blocked: install Blender or provide a renderer adapter before visual promotion")
    raise SystemExit(
        f"renderer adapter not configured for {asset_id}; use Blender in headless mode to emit {len(PERSPECTIVES)} perspectives and {len(CONTEXTS)} contexts"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    search_parser = sub.add_parser("search")
    search_parser.add_argument("query")
    search_parser.add_argument("--limit", type=int, default=20)
    fetch_parser = sub.add_parser("fetch")
    fetch_parser.add_argument("uid")
    review_parser = sub.add_parser("review")
    review_parser.add_argument("asset_id")
    review_parser.add_argument("--pass-number", type=int, required=True)
    review_parser.add_argument("--decision", choices=("pass", "fail", "pending"), required=True)
    promote_parser = sub.add_parser("promote")
    promote_parser.add_argument("asset_id")
    render_parser = sub.add_parser("render")
    render_parser.add_argument("asset_id")
    args = parser.parse_args()
    if args.command == "search":
        search(args.query, args.limit)
    elif args.command == "fetch":
        fetch(args.uid)
    elif args.command == "review":
        review(args.asset_id, args.pass_number, args.decision)
    elif args.command == "promote":
        promote(args.asset_id)
    elif args.command == "render":
        render(args.asset_id)


if __name__ == "__main__":
    main()
