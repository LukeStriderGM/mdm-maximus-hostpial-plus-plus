"""
Explicit EBM model wrapper for DHA RESCUE.

This module exists for teams that want a clear EBM-only Python entrypoint
separate from the multi-backend model module.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from model import BloodLogisticsModel


class EBMBloodLogisticsModel(BloodLogisticsModel):
    """EBM-only model class used for training/loading a single EBM artifact."""

    def __init__(self):
        super().__init__(backend="ebm")

    def train(self, df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42, backend: str | None = None):
        return super().train(df=df, test_size=test_size, random_state=random_state, backend="ebm")


def load_ebm_model(model_path: str | Path = "artifacts/blood_logistics_ebm.pkl") -> EBMBloodLogisticsModel:
    """Load EBM model artifact from disk."""
    model = EBMBloodLogisticsModel()
    model.load(model_path)
    return model
