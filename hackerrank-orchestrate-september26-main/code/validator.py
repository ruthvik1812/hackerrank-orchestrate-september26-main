from decimal import Decimal
from typing import List, Dict, Any, Optional
import re

from models import (
    CandidatePlan, PredictionOutput, DecisionAnalysis,
    DailyForecastPoint, EvidenceBreakdown, RequestRecord
)

def rank_candidate_plans(candidates: List[CandidatePlan], desired_completion_date: str) -> CandidatePlan:
    """
    Ranks candidate plans according to challenge rules:
    1. Complete full request by desired_completion_date.
    2. Require no spending changes (fewer changes preferred).
    3. Minimize total amount paid.
    4. Start payment earlier (earlier first_payment_date).
    5. Use fewer payments.
    6. Lowest payment_option_id as final tie-breaker.
    """
    if not candidates:
        raise ValueError("No candidate plans available")

    def sort_key(plan: CandidatePlan):
        # 1. Complete by deadline: 0 if completion date <= deadline, else 1
        last_date = plan.payments[-1].date if plan.payments else "9999-99-99"
        meets_deadline = 0 if (last_date <= desired_completion_date or plan.method.value in ['not_recommended', 'wait']) else 1

        # 2. Fewer spending changes
        num_changes = len(plan.spending_changes)

        # 3. Total cost
        total_cost = float(plan.total_cost)

        # 4. Start earlier
        start_date = plan.first_payment_date if plan.first_payment_date else "9999-99-99"

        # 5. Fewer payments
        num_pmts = plan.number_of_payments

        # 6. Payment option ID
        opt_id = plan.payment_option_id or "zzzzzz"

        # Affordability status order preference (affordable_now > affordable_with_plan > affordable_later > not_affordable)
        status_rank = {
            "affordable_now": 0,
            "affordable_with_plan": 1,
            "affordable_later": 2,
            "not_affordable": 3
        }.get(plan.status.value, 4)

        return (meets_deadline, status_rank, num_changes, total_cost, start_date, num_pmts, opt_id)

    sorted_plans = sorted(candidates, key=sort_key)
    return sorted_plans[0]

def build_decision_analysis(
    request: RequestRecord,
    safe_today: Decimal,
    earliest_full_date: str,
    winning_plan: CandidatePlan,
    forecast: List[DailyForecastPoint],
    recon: Dict[str, Any]
) -> DecisionAnalysis:
    profile = recon["profile"]
    
    # Build clean output prediction
    out = PredictionOutput(
        request_id=request.request_id,
        amount_safe_to_pay=safe_today,
        affordability_status=winning_plan.status,
        recommended_payment_method=winning_plan.method,
        payment_plan=winning_plan.payment_plan_str,
        earliest_date_for_full_payment=winning_plan.earliest_date_for_full_payment,
        spending_changes_needed=winning_plan.spending_changes_str,
        decision_explanation=winning_plan.explanation
    )

    # Build evidence breakdown
    bills = []
    for exp in recon["recurring_expenses"]:
        bills.append({
            "event_id": exp["event_id"],
            "description": exp["description"],
            "category": exp["category"],
            "amount": float(exp["amount"]),
            "day_of_month": exp["day_of_month"],
            "flexibility": exp["flexibility"].value if hasattr(exp["flexibility"], "value") else str(exp["flexibility"])
        })

    pending_list = []
    for deb in recon["future_pending_debits"]:
        pending_list.append({
            "event_id": deb.event_id,
            "description": deb.description,
            "amount": float(deb.amount),
            "date": deb.settlement_date or deb.event_date
        })

    confirmed_inc = []
    if recon["salary_amount"] > Decimal('0'):
        confirmed_inc.append({
            "type": "Salary",
            "amount": float(recon["salary_amount"]),
            "day_of_month": recon["salary_day_of_month"]
        })

    msg_list = []
    for msg in recon.get("processed_events", []):
        pass

    unresolved_list = []
    if recon["msg_info"].get("pending_bonus_unconfirmed"):
        unresolved_list.append("Pending quarterly performance bonus is unconfirmed.")
    if recon["msg_info"].get("pending_commission_unconfirmed"):
        unresolved_list.append("Unconfirmed sales commission is excluded from available cash.")

    evidence = EvidenceBreakdown(
        bills=bills,
        pending_debits=pending_list,
        confirmed_income=confirmed_inc,
        messages=msg_list,
        images=[],
        unresolved=unresolved_list
    )

    return DecisionAnalysis(
        output=out,
        requested_amount=request.requested_amount,
        desired_completion_date=request.desired_completion_date,
        user_id=profile.user_id,
        home_currency=profile.home_currency,
        current_available_balance=profile.current_available_balance,
        minimum_balance_to_keep=profile.minimum_balance_to_keep,
        forecast=forecast,
        evidence=evidence
    )
