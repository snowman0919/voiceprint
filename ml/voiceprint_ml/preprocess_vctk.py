"""
VCTK audio preprocessing: FLAC 48kHz → WAV 16kHz mono + manifest CSV.
Uses vtad_scores.json for brightness, softness, impression labels.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

VCTK_DIR = Path(os.environ.get('VCTK_DIR', 'ml/data/VCTK'))
VTAD_SCORES = Path(os.environ.get('VTAD_DIR', 'ml/data/vtad')) / 'vtad_scores.json'
OUTPUT_DIR = Path(os.environ.get('OUTPUT_DIR', 'ml/data/vctk-processed'))
SAMPLE_RATE = 16000


def convert_flac_to_wav(flac_path: Path, wav_path: Path) -> bool:
    """Convert FLAC to 16kHz mono WAV using ffmpeg."""
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        'ffmpeg', '-y', '-loglevel', 'error',
        '-i', str(flac_path),
        '-ar', str(SAMPLE_RATE),
        '-ac', '1',
        '-sample_fmt', 's16',
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def main():
    if not VTAD_SCORES.exists():
        sys.exit(f'vtad_scores.json not found at {VTAD_SCORES}. Run vtad_elo.py first.')
    
    scores = json.loads(VTAD_SCORES.read_text())
    
    # Read speaker-info.txt for gender mapping
    speaker_info = VCTK_DIR / 'speaker-info.txt'
    gender_map: dict[str, str] = {}
    if speaker_info.exists():
        for line in speaker_info.read_text().splitlines():
            if line.startswith('p'):
                parts = line.split()
                if parts:
                    sid = parts[0]
                    # GENDER is 3rd column, but spaces in comments mess things up
                    # speaker-info: ID  AGE  GENDER  ACCENTS  REGION COMMENTS
                    # Actually: ID AGE GENDER ACCENTS REGION COMMENTS
                    # Format: p225  23  F    English    Southern  England
                    gender_map[sid] = parts[2] if len(parts) >= 3 else '?'
    
    # Collect all speakers present in any of the 3 labels
    all_speakers: set[str] = set()
    for key in ['brightness', 'softness', 'impression']:
        all_speakers.update(scores.get(key, {}).keys())
    
    print(f'Speakers with labels: {len(all_speakers)}')
    
    # Build manifest rows
    rows: list[dict] = []
    flac_dir = VCTK_DIR / 'wav48_silence_trimmed'
    output_wav_dir = OUTPUT_DIR / 'wavs'
    converted = 0
    skipped = 0
    
    for speaker_id in sorted(all_speakers):
        spk_dir = flac_dir / speaker_id
        if not spk_dir.is_dir():
            print(f'  No audio for {speaker_id}', file=sys.stderr)
            skipped += 1
            continue
        
        # Only use mic1 files
        flac_files = sorted(spk_dir.glob('*_mic1.flac'))
        if not flac_files:
            print(f'  No mic1 files for {speaker_id}', file=sys.stderr)
            skipped += 1
            continue
        
        bright = scores['brightness'].get(speaker_id, 0.5)
        soft = scores['softness'].get(speaker_id, 0.5)
        imps = scores['impression'].get(speaker_id, 0.5)
        stability = 0.5  # placeholder, acoustic rule later
        
        for flac_path in flac_files:
            rel_name = f'{speaker_id}/{flac_path.stem}.wav'
            wav_path = output_wav_dir / rel_name
            
            if not wav_path.exists():
                if not convert_flac_to_wav(flac_path, wav_path):
                    print(f'  Failed: {flac_path.name}', file=sys.stderr)
                    continue
                converted += 1
            
            rows.append({
                'path': str(Path('data/vctk-processed/wavs') / rel_name),
                'speaker_id': speaker_id,
                'split': 'train',  # will be overridden by split.py
                'impression': round(imps, 6),
                'brightness': round(bright, 6),
                'softness': round(soft, 6),
                'stability': round(stability, 6),
            })
    
    print(f'Converted: {converted} files')
    print(f'Skipped speakers: {skipped}')
    print(f'Total manifest rows: {len(rows)}')
    
    # Write manifest CSV
    manifest_path = OUTPUT_DIR / 'manifest.csv'
    import csv
    fieldnames = ['path', 'speaker_id', 'split', 'impression', 'brightness', 'softness', 'stability']
    with open(manifest_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f'Manifest: {manifest_path}')
    
    # Stats
    n_speakers = len(set(r['speaker_id'] for r in rows))
    print(f'Speakers in manifest: {n_speakers}')


if __name__ == '__main__':
    main()
