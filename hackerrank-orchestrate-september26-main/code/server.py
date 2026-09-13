import os
import sys
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure code path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_loader import DataLoader
from models import (
    RequestRecord, UserProfile, PredictionOutput,
    DecisionAnalysis, DailyForecastPoint, EvidenceBreakdown
)
from main import process_request
from forecaster import run_90day_simulation, calculate_baseline_metrics
from payment_planner import generate_candidate_plans
from validator import rank_candidate_plans, build_decision_analysis

app = FastAPI(title="Buy or Wait? AI Financial Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))
loader = DataLoader(dataset_dir)
loader.load_all()

class PurchaseCheckInput(BaseModel):
    user_id: str = "user_01"
    request_text: str
    requested_amount: float
    request_date: str = "2026-09-13"
    desired_completion_date: str = "2026-10-15"
    allows_partial_payment: bool = True
    payment_methods_override: Optional[List[str]] = None
    minimum_balance_override: Optional[float] = None
    supporting_message: Optional[str] = None

@app.get("/api/profiles")
def get_profiles():
    return [prof.dict() for prof in loader.profiles.values()]

@app.get("/api/requests")
def get_requests():
    reqs = loader.load_requests("sample_requests.csv")
    result = []
    for req in reqs:
        analysis = process_request(req, loader, dataset_dir)
        result.append(analysis.dict())
    return result

@app.post("/api/check-affordability")
def check_affordability(payload: PurchaseCheckInput):
    user_id = payload.user_id if payload.user_id in loader.profiles else "user_01"
    profile = loader.profiles[user_id].model_copy()

    if payload.payment_methods_override is not None:
        profile.payment_methods_user_will_consider = payload.payment_methods_override

    if payload.minimum_balance_override is not None:
        profile.minimum_balance_to_keep = Decimal(str(payload.minimum_balance_override))

    req = RequestRecord(
        request_id="custom_req_01",
        user_id=user_id,
        request_date=payload.request_date,
        request_type="purchase",
        requested_amount=Decimal(str(payload.requested_amount)),
        desired_completion_date=payload.desired_completion_date,
        allows_partial_payment=payload.allows_partial_payment,
        request_text=payload.request_text
    )

    options = loader.payment_options.get("request_01", [])

    # Process
    recon = process_request_custom(req, profile, options, loader, dataset_dir)
    return recon.dict()

def process_request_custom(req: RequestRecord, profile: UserProfile, options: List[Any], loader: DataLoader, dataset_dir: str) -> DecisionAnalysis:
    from financial_reconstruction import reconstruct_user_financial_state
    recon = reconstruct_user_financial_state(
        profile=profile,
        all_events=loader.events,
        rates=loader.exchange_rates,
        images=loader.images,
        messages=loader.messages,
        request_date=req.request_date,
        dataset_dir=dataset_dir
    )

    safe_today, earliest_full_date, base_traj = calculate_baseline_metrics(
        recon=recon,
        request_date_str=req.request_date,
        requested_amount=req.requested_amount
    )

    candidates = generate_candidate_plans(
        request=req,
        profile=profile,
        recon=recon,
        safe_today=safe_today,
        earliest_full_date=earliest_full_date,
        options=options
    )

    winning_plan = rank_candidate_plans(candidates, req.desired_completion_date)

    _, plan_traj, _ = run_90day_simulation(
        recon=recon,
        request_date_str=req.request_date,
        payments=winning_plan.payments,
        spending_changes=winning_plan.spending_changes
    )

    final_traj = []
    for i in range(len(base_traj)):
        final_traj.append({
            "date": base_traj[i].date,
            "baseline_balance": base_traj[i].baseline_balance,
            "plan_balance": plan_traj[i].plan_balance if i < len(plan_traj) else base_traj[i].baseline_balance,
            "minimum_balance": base_traj[i].minimum_balance,
            "events": plan_traj[i].events if i < len(plan_traj) else base_traj[i].events
        })

    return build_decision_analysis(
        request=req,
        safe_today=safe_today,
        earliest_full_date=earliest_full_date,
        winning_plan=winning_plan,
        forecast=final_traj,
        recon=recon
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
