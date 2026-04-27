"""
Enhanced EDA workflow for DHA RESCUE.

Usage:
    python eda_upgrade.py --samples 3000 --outdir outputs/eda
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from data import generate_synthetic_data
from utils import engineer_features


def _build_overview(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for col in df.columns:
        s = df[col]
        rows.append(
            {
                "column": col,
                "dtype": str(s.dtype),
                "missing_count": int(s.isna().sum()),
                "missing_pct": float(s.isna().mean() * 100.0),
                "n_unique": int(s.nunique(dropna=True)),
            }
        )
    return pd.DataFrame(rows).sort_values(["missing_pct", "n_unique"], ascending=[False, False])


def _numeric_summary(df: pd.DataFrame) -> pd.DataFrame:
    numeric = df.select_dtypes(include=["number"])
    if numeric.empty:
        return pd.DataFrame()
    return numeric.describe(percentiles=[0.05, 0.25, 0.5, 0.75, 0.95]).T


def _failure_slices(df: pd.DataFrame) -> pd.DataFrame:
    slice_cols = [c for c in ["node_type", "product_id", "backup_supply_available"] if c in df.columns]
    pieces = []
    for col in slice_cols:
        part = (
            df.groupby(col)
            .agg(
                samples=("failure", "size"),
                failure_rate=("failure", "mean"),
                avg_time_to_failure=("time_to_failure", "mean"),
                avg_days_of_supply=("days_of_supply", "mean"),
            )
            .reset_index()
        )
        part.insert(0, "slice_by", col)
        pieces.append(part)
    return pd.concat(pieces, ignore_index=True) if pieces else pd.DataFrame()


def _risk_bands(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["risk_band"] = pd.cut(
        out["risk_composite"],
        bins=[-0.01, 25, 50, 75, 100],
        labels=["LOW", "ELEVATED", "HIGH", "CRITICAL"],
    )
    return (
        out.groupby("risk_band", observed=False)
        .agg(
            samples=("failure", "size"),
            failure_rate=("failure", "mean"),
            median_ttf=("time_to_failure", "median"),
            median_dos=("days_of_supply", "median"),
        )
        .reset_index()
    )


def run_eda(samples: int, outdir: Path) -> dict[str, Path]:
    outdir.mkdir(parents=True, exist_ok=True)

    df = generate_synthetic_data(samples)
    df = engineer_features(df)

    outputs = {
        "dataset": outdir / "dataset_enhanced.csv",
        "overview": outdir / "eda_overview.csv",
        "numeric_summary": outdir / "numeric_summary.csv",
        "correlation": outdir / "correlation_matrix.csv",
        "failure_slices": outdir / "failure_slices.csv",
        "risk_bands": outdir / "risk_band_summary.csv",
    }

    df.to_csv(outputs["dataset"], index=False)
    _build_overview(df).to_csv(outputs["overview"], index=False)
    _numeric_summary(df).to_csv(outputs["numeric_summary"])
    df.select_dtypes(include=["number"]).corr(numeric_only=True).to_csv(outputs["correlation"])
    _failure_slices(df).to_csv(outputs["failure_slices"], index=False)
    _risk_bands(df).to_csv(outputs["risk_bands"], index=False)

    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run enhanced EDA for DHA RESCUE.")
    parser.add_argument("--samples", type=int, default=3000, help="Number of synthetic rows to generate.")
    parser.add_argument("--outdir", type=Path, default=Path("outputs/eda"), help="Output directory.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    outputs = run_eda(samples=args.samples, outdir=args.outdir)
    print("\nEnhanced EDA complete. Generated files:")
    for _, p in outputs.items():
        print(f" - {p}")


if __name__ == "__main__":
    main()
