"""
VCTK-RVA pairwise comparisons → Elo scores → 0-1 normalized labels.

Attributes:
- brightness ← Bright_{F,M}
- softness ← 1 - Coarse_{F,M} (coarse = not soft)
- impression ← 1 - Low_{F,M} (low voice = masculine impression)

Uses train.txt + seen.txt for score computation.
Outputs per-speaker Elo dict.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, Set


def elo_rank(pairs: list[tuple[str, str]], k: float = 32, n_iter: int = 100) -> dict[str, float]:
    """Elo ranking from list of (winner, loser) pairs. Higher = more of attribute."""
    # Get unique speakers
    speakers: Set[str] = set()
    for w, l in pairs:
        speakers.add(w)
        speakers.add(l)
    
    ratings = {s: 1500.0 for s in speakers}
    
    for _ in range(n_iter):
        for winner, loser in pairs:
            r_w = ratings[winner]
            r_l = ratings[loser]
            expected = 1.0 / (1.0 + 10.0 ** ((r_l - r_w) / 400.0))
            ratings[winner] += k * (1.0 - expected)
            ratings[loser] += k * (0.0 - expected)
    
    return ratings


def normalize_0_1(scores: dict[str, float]) -> dict[str, float]:
    """Min-max normalize to [0, 1]."""
    vals = list(scores.values())
    if not vals:
        return {}
    lo, hi = min(vals), max(vals)
    if hi == lo:
        return {k: 0.5 for k in scores}
    return {k: (v - lo) / (hi - lo) for k, v in scores.items()}


def parse_comparisons(filepath: str) -> dict[str, list[tuple[str, str]]]:
    """
    Parse a vTAD attribute_pair text file.
    Returns dict: attribute_name -> list of (winner, loser) pairs.
    """
    results: dict[str, list[tuple[str, str]]] = defaultdict(list)
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line or ': ' not in line:
                continue
            attr, pairs_str = line.split(': ', 1)
            pairs: list[tuple[str, str]] = []
            for p in pairs_str.split(', '):
                p = p.strip()
                if '|' not in p:
                    continue
                a, b = p.split('|', 1)
                pairs.append((a.strip(), b.strip()))
            results[attr] = pairs
    return results


def compute_attribute_scores(attr: str, gender: str, all_comparisons: dict) -> dict[str, float]:
    """
    Compute normalized 0-1 Elo scores for a specific attribute+gender.
    attr = 'Bright', 'Coarse', 'Low'
    gender = 'F' or 'M'
    """
    key = f'{attr}_{gender}'
    pairs = all_comparisons.get(key, [])
    if not pairs:
        print(f'  Warning: no comparisons for {key}', file=sys.stderr)
        return {}
    
    elo = elo_rank(pairs)
    return normalize_0_1(elo)


def main():
    base = Path(os.environ.get('VTAD_DIR', 'ml/data/vtad'))
    pair_dir = base / 'Dataset' / 'attribute_pair'
    
    # Collect comparisons from train.txt + seen.txt only.
    # ponytail: unseen.txt excluded — it is VCTK-RVA's held-out eval tier.
    # Including it would derive held-out speakers' labels from eval data (= leakage)
    # and inflate speaker count past honestly-labeled 78. Upgrade path: acquire
    # additional consented multi-rater sources to reach the 100-speaker gate cleanly.
    all_comparisons: dict[str, list[tuple[str, str]]] = defaultdict(list)
    
    for fname in ['train.txt', 'seen.txt']:
        fpath = pair_dir / fname
        if fpath.exists():
            parsed = parse_comparisons(str(fpath))
            for attr, pairs in parsed.items():
                all_comparisons[attr].extend(pairs)
    
    print(f'Total attribute groups: {len(all_comparisons)}', file=sys.stderr)
    
    # Compute scores for our target attributes
    target_attrs = ['Bright', 'Coarse', 'Low']
    all_scores: dict[str, dict[str, float]] = {}  # attr -> speaker -> 0-1
    
    for attr in target_attrs:
        print(f'\n{attr}:', file=sys.stderr)
        for gender in ['F', 'M']:
            scores = compute_attribute_scores(attr, gender, all_comparisons)
            key = f'{attr}_{gender}'
            all_scores[key] = scores
            print(f'  {key}: {len(scores)} speakers, range [{min(scores.values()):.4f}, {max(scores.values()):.4f}]', file=sys.stderr)
    
    # Merge F+M into unified per-speaker dicts
    brightness = {}  # speaker_id -> 0-1
    softness = {}    # speaker_id -> 0-1  (1 - Coarse)
    impression = {}  # speaker_id -> 0-1  (1 - Low = more feminine)
    
    for gender, gkey in [('F', 'Bright_F'), ('M', 'Bright_M')]:
        for spk, score in all_scores.get(gkey, {}).items():
            brightness[spk] = score
    
    for gender, gkey in [('F', 'Coarse_F'), ('M', 'Coarse_M')]:
        for spk, score in all_scores.get(gkey, {}).items():
            softness[spk] = 1.0 - score  # high coarse → low soft
    
    # Impression: inverted Low (low voice → masculine → low impression)
    # Additionally, supplement with gender label: all F speakers get 1.0, M get 0.0
    # But Low_F and Low_M are within-gender comparisons, so Low scores are relative.
    # We'll use Low-inverted as a modifier, with gender-based baseline.
    for gender, gkey in [('F', 'Low_F'), ('M', 'Low_M')]:
        for spk, score in all_scores.get(gkey, {}).items():
            impression[spk] = 1.0 - score
    
    # Map VCTK speaker ID to gender (from folder: p225-p361 = female? or?)
    vctk_base = Path(os.environ.get('VCTK_DIR', 'ml/data/VCTK'))
    speaker_info = vctk_base / 'speaker-info.txt'
    gender_map: dict[str, str] = {}
    if speaker_info.exists():
        with open(speaker_info) as f:
            header = f.readline().strip()
            # Columns: ID,AGE,REGION,ACCENTS,Comments,GENDER
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) >= 3:
                    sid = f'p{parts[0]}'
                    # GENDER is last column (F or M)
                    g = parts[-1].strip()
                    if g in ('F', 'M'):
                        gender_map[sid] = g
    
    # Override impression with gender baseline, mixing in acoustic signal
    for spk in impression:
        g = gender_map.get(spk, '?')
        if g == 'F':
            impression[spk] = 0.5 + 0.5 * impression[spk]  # scale to 0.5-1.0
        elif g == 'M':
            impression[spk] = 0.5 * impression[spk]  # scale to 0.0-0.5
        # Unknown gender: keep as-is (0-1)
    
    # Output JSON
    output = {
        'brightness': brightness,
        'softness': softness,
        'impression': impression,
    }
    
    out_path = base / 'vtad_scores.json'
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f'\nSaved {out_path}', file=sys.stderr)
    print(f'  brightness: {len(brightness)} speakers', file=sys.stderr)
    print(f'  softness:   {len(softness)} speakers', file=sys.stderr)
    print(f'  impression: {len(impression)} speakers (with gender scaling)', file=sys.stderr)
    
    return output


if __name__ == '__main__':
    main()
