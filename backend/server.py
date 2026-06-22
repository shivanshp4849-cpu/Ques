from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# ============================================================================
# /api/simulate-city  (Urban Architect counterfactual)
# ----------------------------------------------------------------------------
# Pod-local stub. Generates a synthetic incident pool at startup so the
# Simulate tab has something to score against here. In your real backend,
# replace `_synthetic_incidents` with a read of features.parquet — the math
# below is the production formula, untouched.
# ============================================================================
import math
import random
from typing import Optional

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

CAUSE_POOL = ["accident", "vehicle_breakdown", "water_logging", "pot_holes", "tree_fall", "others"]


def _synthetic_incidents(n: int = 8057, seed: int = 42):
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        out.append({
            "lat": 12.9716 + (rng.random() - 0.5) * 0.18,
            "lng": 77.5946 + (rng.random() - 0.5) * 0.22,
            "event_cause": rng.choices(
                CAUSE_POOL,
                weights=[35, 25, 12, 8, 4, 16],
                k=1,
            )[0],
            "duration_minutes": max(5.0, rng.gauss(48, 32)),
            "impact_level": rng.choices([0, 1, 2], weights=[60, 30, 10])[0],
        })
    return out


_INCIDENT_CACHE = _synthetic_incidents()


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


@api_router.post("/simulate-city")
async def simulate_city(req: SimRequest):
    incidents = _INCIDENT_CACHE
    historical_burden = 0.0
    simulated_burden = 0.0
    duration_savings_min = 0.0
    breakdown = {"response_hub": 0, "drainage_grid": 0, "maintenance_depot": 0}
    affected_ids = set()

    for idx, inc in enumerate(incidents):
        s_weight = inc["impact_level"] + 1  # 0->1, 1->2, 2->3
        d_hist = inc["duration_minutes"]
        s_hist = s_weight

        historical_burden += d_hist * s_hist

        d_sim = d_hist
        s_sim = s_hist
        affected_by: Optional[str] = None

        for a in req.assets:
            meta = ASSET_CATALOG.get(a.type)
            if not meta:
                continue
            if inc["event_cause"] not in meta["causes"]:
                continue
            if _haversine_km(a.lat, a.lng, inc["lat"], inc["lng"]) > a.radius_km:
                continue
            if meta["effect"] == "elimination":
                d_sim = 0.0
                s_sim = 0.0
            else:
                new_d = d_hist * (1 - a.reduction_rate)
                if new_d < d_sim:
                    d_sim = new_d
            affected_by = a.type

        simulated_burden += d_sim * s_sim
        duration_savings_min += max(0.0, d_hist - d_sim)
        if affected_by:
            breakdown[affected_by] = breakdown.get(affected_by, 0) + 1
            affected_ids.add(idx)

    gr_score = 0.0
    if historical_burden > 0:
        gr_score = 100.0 * (1 - simulated_burden / historical_burden)

    incidents_affected = len(affected_ids)
    avg_dur_red = (duration_savings_min / incidents_affected) if incidents_affected else 0.0
    economic_value_inr = duration_savings_min / 60.0 * 150.0

    return {
        "gr_score": round(gr_score, 2),
        "historical_burden": round(historical_burden, 2),
        "simulated_burden": round(simulated_burden, 2),
        "incidents_affected": incidents_affected,
        "breakdown": breakdown,
        "avg_duration_reduction_min": round(avg_dur_red, 2),
        "economic_value_inr": round(economic_value_inr, 2),
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()