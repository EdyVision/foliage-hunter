#!/usr/bin/env python3
"""Build a Colorado-priority plant photo corpus from iNaturalist research-grade obs.

Usage:
  python scripts/build_inat_corpus.py --species configs/colorado_priority_species.json \\
    --out data/foliage --per-species 80
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.inaturalist.org/v1/observations"
UA = "FoliageHunterCorpus/0.1 (research; contact: local)"


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp, dest.open("wb") as out:
        out.write(resp.read())


def photo_ok(photo: dict, allowed: set[str]) -> bool:
    lic = (photo.get("license_code") or photo.get("license") or "").lower().replace("_", "-")
    if not lic:
        return False
    return any(lic == a or lic.startswith(a) for a in allowed)


def fetch_species(
    taxon_id: int,
    *,
    per_species: int,
    place_id: int | None,
    allowed: set[str],
) -> list[dict]:
    results: list[dict] = []
    page = 1
    while len(results) < per_species and page <= 25:
        params: dict[str, str | int] = {
            "taxon_id": taxon_id,
            "quality_grade": "research",
            "photos": "true",
            "per_page": 50,
            "page": page,
            "order_by": "votes",
        }
        if place_id is not None:
            params["place_id"] = place_id
        url = f"{API}?{urllib.parse.urlencode(params)}"
        payload = get_json(url)
        batch = payload.get("results") or []
        if not batch:
            break
        for obs in batch:
            for photo in obs.get("photos") or []:
                if not photo_ok(photo, allowed):
                    continue
                medium = photo.get("url") or ""
                if "square." in medium:
                    medium = medium.replace("square.", "medium.")
                if not medium:
                    continue
                coords = (obs.get("geojson") or {}).get("coordinates") or [None, None]
                results.append(
                    {
                        "observation_id": obs.get("id"),
                        "photo_id": photo.get("id"),
                        "url": medium,
                        "license": photo.get("license_code") or photo.get("license"),
                        "lat": coords[1] if len(coords) > 1 else None,
                        "lng": coords[0] if coords else None,
                    }
                )
                if len(results) >= per_species:
                    break
            if len(results) >= per_species:
                break
        page += 1
        time.sleep(1.0)
    return results[:per_species]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--species", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("data/foliage"))
    parser.add_argument("--per-species", type=int, default=0)
    args = parser.parse_args()

    cfg = json.loads(args.species.read_text())
    per = args.per_species or int(cfg.get("target_images_per_species", 80))
    allowed = {str(x).lower() for x in cfg.get("licenses", [])}
    colorado_place = cfg.get("place_id_colorado")
    prefer = set(cfg.get("prefer_colorado_place_for_tiers") or [])

    out = args.out
    images = out / "images"
    images.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    for spec in cfg["priority"]:
        tier = spec["tier"]
        place = colorado_place if tier in prefer else None
        print(f"fetch {spec['common']} ({spec['scientific']}) tier={tier} place={place}")
        photos = fetch_species(
            int(spec["inat_taxon_id"]),
            per_species=per,
            place_id=place,
            allowed=allowed,
        )
        if place and len(photos) < max(15, per // 5):
            print(f"  sparse in Colorado ({len(photos)}); widening worldwide")
            photos = fetch_species(
                int(spec["inat_taxon_id"]),
                per_species=per,
                place_id=None,
                allowed=allowed,
            )
        kept = 0
        for photo in photos:
            rel = f"{spec['scientific'].replace(' ', '_')}/{photo['photo_id']}.jpg"
            dest = images / rel
            if not dest.exists():
                try:
                    download(photo["url"], dest)
                    time.sleep(0.2)
                except Exception as exc:  # noqa: BLE001
                    print(f"  skip {photo['url']}: {exc}")
                    continue
            rows.append(
                {
                    "image": str(Path("images") / rel),
                    "species": spec["common"],
                    "scientific": spec["scientific"],
                    "tier": tier,
                    "inat_taxon_id": spec["inat_taxon_id"],
                    "license": photo.get("license"),
                    "observation_id": photo.get("observation_id"),
                    "notes": (
                        f"Identify this outdoor plant from a photo. "
                        f"Species: {spec['common']} ({spec['scientific']})."
                    ),
                }
            )
            kept += 1
        print(f"  kept {kept}")

    # Stratify by species: ~20% eval per species
    from collections import defaultdict

    by_sp: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_sp[r["species"]].append(r)
    train: list[dict] = []
    eval_rows: list[dict] = []
    for sp, items in by_sp.items():
        for i, r in enumerate(items):
            (eval_rows if i % 5 == 0 else train).append(r)
    (out / "train.jsonl").write_text("\n".join(json.dumps(r) for r in train) + ("\n" if train else ""))
    (out / "eval.jsonl").write_text(
        "\n".join(json.dumps(r) for r in eval_rows) + ("\n" if eval_rows else "")
    )
    (out / "manifest.json").write_text(
        json.dumps(
            {
                "n_total": len(rows),
                "n_train": len(train),
                "n_eval": len(eval_rows),
                "species_config": str(args.species),
                "source": "iNaturalist API research-grade photos",
                "redistribution": "private training only; do not publish NC images",
            },
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {len(train)} train / {len(eval_rows)} eval → {out}")


if __name__ == "__main__":
    main()
