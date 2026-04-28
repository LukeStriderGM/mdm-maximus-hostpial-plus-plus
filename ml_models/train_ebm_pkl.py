"""
Train one EBM artifact for UI integration.

Usage:
    python train_ebm_pkl.py --samples 3000 --out artifacts/blood_logistics_ebm.pkl
"""

from __future__ import annotations

import argparse
from pathlib import Path

from data import generate_synthetic_data
from model import BloodLogisticsModel
from utils import engineer_features


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train DHA RESCUE EBM model and save one .pkl artifact.")
    parser.add_argument("--samples", type=int, default=3000, help="Synthetic dataset size.")
    parser.add_argument("--out", type=Path, default=Path("artifacts/blood_logistics_ebm.pkl"), help="Output .pkl path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)

    df = engineer_features(generate_synthetic_data(args.samples))
    model = BloodLogisticsModel(backend="ebm")
    model.train(df, backend="ebm")
    model.save(args.out)

    print(f"\nSaved EBM artifact: {args.out}")


if __name__ == "__main__":
    main()
