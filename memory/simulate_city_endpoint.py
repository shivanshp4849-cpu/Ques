# ============================================================================
# /api/simulate-city  —  Urban Architect counterfactual scoring
# Paste this block into your app/api/endpoints.py (production backend).
# Reads data/processed/features.parquet (~8,057 rows). Pure-pandas, no extra deps.
# ============================================================================
import math
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()  # if your router is already defined, drop these decorators on it

FEATURES_PATH = Path("data/processed/features.parquet")

ASSET_CATALOG = {
    "response_hub": {
        "cost": 8_000_000,
        "radius_km": 3.0,
        "causes": {"accident", "vehicle_breakdown"},
        "effect": "duration_reduction",
    },
    "drainage_grid": {
        "cost": 12_000_000,
        "radius_km": 2.0,
        "causes": {"water_logging"},
        "effect": "elimination",
    },
    "maintenance_depot": {
        "cost": 5_000_000,
        "radius_km": 2.5,
        "causes": {"pot_holes"},
        "effect": "duration_reduction",
    },
}

# load once at process start
_DF = pd.read_parquet(FEATURES_PATH)
# Expected columns: lat, lng, event_cause, duration_minutes, impact_level (0/1/2)


def _haversine_km(a_lat, a_lng, b_lat, b_lng):
    R = 6371.0
    dlat = math.radians(b_lat - a_lat)
    dlng = math.radians(b_lng - a_lng)
    aa = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * math.sin(dlng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(aa))


class SimAsset(BaseModel):
    type: str
    lat: float
    lng: float
    radius_km: float
    reduction_rate: float


class SimRequest(BaseModel):
    assets: List[SimAsset]


@router.post("/api/simulate-city")
def simulate_city(req: SimRequest):
    df = _DF
    lats = df["lat"].to_numpy()
    lngs = df["lng"].to_numpy()
    causes = df["event_cause"].to_numpy()
    durations = df["duration_minutes"].to_numpy().astype(float)
    impacts = df["impact_level"].to_numpy().astype(int)
    s_weight = impacts + 1  # 0->1, 1->2, 2->3
    historical_burden = float((durations * s_weight).sum())

    d_sim = durations.copy()
    s_sim = s_weight.copy().astype(float)
    affected_mask = [False] * len(df)
    breakdown = {"response_hub": 0, "drainage_grid": 0, "maintenance_depot": 0}

    # naive O(n_assets * n_incidents) — fast enough for 8k rows / few assets
    for a in req.assets:
        meta = ASSET_CATALOG.get(a.type)
        if not meta:
            continue
        for i in range(len(df)):
            if causes[i] not in meta["causes"]:
                continue
            if _haversine_km(a.lat, a.lng, lats[i], lngs[i]) > a.radius_km:
                continue
            if meta["effect"] == "elimination":
                d_sim[i] = 0.0
                s_sim[i] = 0.0
            else:
                new_d = durations[i] * (1.0 - a.reduction_rate)
                if new_d < d_sim[i]:
                    d_sim[i] = new_d
            if not affected_mask[i]:
                affected_mask[i] = True
                breakdown[a.type] = breakdown.get(a.type, 0) + 1

    simulated_burden = float((d_sim * s_sim).sum())
    gr = 100.0 * (1 - simulated_burden / historical_burden) if historical_burden > 0 else 0.0

    incidents_affected = int(sum(affected_mask))
    duration_savings = float((durations - d_sim).clip(min=0).sum())
    avg_red = (duration_savings / incidents_affected) if incidents_affected else 0.0
    economic_value_inr = duration_savings / 60.0 * 150.0  # ₹150/hr

    return {
        "gr_score": round(gr, 2),
        "historical_burden": round(historical_burden, 2),
        "simulated_burden": round(simulated_burden, 2),
        "incidents_affected": incidents_affected,
        "breakdown": breakdown,
        "avg_duration_reduction_min": round(avg_red, 2),
        "economic_value_inr": round(economic_value_inr, 2),
    }
