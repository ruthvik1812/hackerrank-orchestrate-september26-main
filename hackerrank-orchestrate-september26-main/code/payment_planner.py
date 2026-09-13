from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

from models import (
    UserProfile, RequestRecord, RequestPaymentOption, CandidatePlan,
    AffordabilityStatus, PaymentMethod, PaymentItem
)
from forecaster import run_90day_simulation

def generate_spending_change_combinations(recon: Dict[str, Any], profile: UserProfile) -> List[Tuple[List[str], str]]:
    """
    Generates valid spending change combinations (up to 3 changes) from permitted categories.
    Excludes protected categories.
    """
    protected_cats = set(profile.expense_categories_to_protect)
    stoppable_cats = set(profile.expense_categories_user_is_willing_to_stop)
    reducible_cats = set(profile.expense_categories_user_is_willing_to_reduce)

    recurring = recon["recurring_expenses"]
    valid_changes = []

    # Individual changes
    for exp in recurring:
        cat = exp["category"]
        evt_id = exp["event_id"]
        if cat in protected_cats:
            continue

        if cat in stoppable_cats:
            valid_changes.append(([f"stop:{evt_id}"], f"Stop {exp['description']}"))

        if cat in reducible_cats:
            min_allowed = exp["minimum_allowed_amount"] or (exp["amount"] * Decimal('0.5'))
            if min_allowed < exp["amount"]:
                valid_changes.append(([f"reduce_to:{evt_id}:{min_allowed:.2f}"], f"Reduce {exp['description']} to {min_allowed:.2f}"))

    # Pair combinations
    combos = [([], "none")]
    for ch, desc in valid_changes:
        combos.append((ch, desc))

    # Two changes
    n = len(valid_changes)
    for i in range(n):
        for j in range(i + 1, n):
            ch1, desc1 = valid_changes[i]
            ch2, desc2 = valid_changes[j]
            # Ensure different events
            evt1 = ch1[0].split(":")[1]
            evt2 = ch2[0].split(":")[1]
            if evt1 != evt2:
                combos.append((ch1 + ch2, f"{desc1} and {desc2}"))

    # Three changes
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                ch1, desc1 = valid_changes[i]
                ch2, desc2 = valid_changes[j]
                ch3, desc3 = valid_changes[k]
                evts = {ch1[0].split(":")[1], ch2[0].split(":")[1], ch3[0].split(":")[1]}
                if len(evts) == 3:
                    combos.append((ch1 + ch2 + ch3, f"{desc1}, {desc2}, and {desc3}"))

    return combos

def build_installment_schedule(opt: RequestPaymentOption) -> List[PaymentItem]:
    payments = []
    d_first = datetime.strptime(opt.first_payment_date, '%Y-%m-%d')
    freq_days = opt.payment_frequency_days or 30

    for i in range(opt.number_of_payments):
        d_pmt = d_first + timedelta(days=i * freq_days)
        payments.append(PaymentItem(date=d_pmt.strftime('%Y-%m-%d'), amount=opt.payment_amount))

    return payments

def generate_candidate_plans(
    request: RequestRecord,
    profile: UserProfile,
    recon: Dict[str, Any],
    safe_today: Decimal,
    earliest_full_date: str,
    options: List[RequestPaymentOption]
) -> List[CandidatePlan]:
    candidates: List[CandidatePlan] = []
    home_curr = profile.home_currency
    methods_considered = set(profile.payment_methods_user_will_consider)

    # Strategy 1: full_payment (Immediate / Today)
    if 'full_payment' in methods_considered:
        # Check without spending changes
        if safe_today >= request.requested_amount:
            pmts = [PaymentItem(date=request.request_date, amount=request.requested_amount)]
            candidates.append(CandidatePlan(
                status=AffordabilityStatus.AFFORDABLE_NOW,
                method=PaymentMethod.FULL_PAYMENT,
                payments=pmts,
                payment_plan_str=f"{request.request_date}:{request.requested_amount:.2f}".rstrip('0').rstrip('.'),
                earliest_date_for_full_payment=request.request_date,
                spending_changes=[],
                spending_changes_str="none",
                total_cost=request.requested_amount,
                first_payment_date=request.request_date,
                number_of_payments=1,
                explanation=f"Pay {home_curr} {request.requested_amount:,.2f} today. This keeps the minimum balance protected."
            ))
        else:
            # Try with spending changes
            combos = generate_spending_change_combinations(recon, profile)
            pmts = [PaymentItem(date=request.request_date, amount=request.requested_amount)]
            for sc_list, sc_desc in combos:
                if not sc_list:
                    continue
                is_safe, _, _ = run_90day_simulation(recon, request.request_date, payments=pmts, spending_changes=sc_list)
                if is_safe:
                    sc_str = "|".join(sc_list)
                    candidates.append(CandidatePlan(
                        status=AffordabilityStatus.AFFORDABLE_WITH_PLAN,
                        method=PaymentMethod.FULL_PAYMENT,
                        payments=pmts,
                        payment_plan_str=f"{request.request_date}:{request.requested_amount:.2f}".rstrip('0').rstrip('.'),
                        earliest_date_for_full_payment=earliest_full_date or request.request_date,
                        spending_changes=sc_list,
                        spending_changes_str=sc_str,
                        total_cost=request.requested_amount,
                        first_payment_date=request.request_date,
                        number_of_payments=1,
                        explanation=f"{sc_desc}, then pay {home_curr} {request.requested_amount:,.2f} today."
                    ))
                    break  # Take simplest safe spending change combination

    # Strategy 2: partial_payment (Exact 2-payment rule)
    if 'partial_payment' in methods_considered and request.allows_partial_payment:
        if Decimal('0') < safe_today < request.requested_amount:
            if earliest_full_date != "" and earliest_full_date <= request.desired_completion_date:
                remaining_amt = request.requested_amount - safe_today
                pmts = [
                    PaymentItem(date=request.request_date, amount=safe_today),
                    PaymentItem(date=earliest_full_date, amount=remaining_amt)
                ]
                is_safe, _, _ = run_90day_simulation(recon, request.request_date, payments=pmts, spending_changes=[])
                if is_safe:
                    p1_str = f"{safe_today:.2f}".rstrip('0').rstrip('.')
                    p2_str = f"{remaining_amt:.2f}".rstrip('0').rstrip('.')
                    plan_str = f"{request.request_date}:{p1_str}|{earliest_full_date}:{p2_str}"
                    candidates.append(CandidatePlan(
                        status=AffordabilityStatus.AFFORDABLE_WITH_PLAN,
                        method=PaymentMethod.PARTIAL_PAYMENT,
                        payments=pmts,
                        payment_plan_str=plan_str,
                        earliest_date_for_full_payment=earliest_full_date,
                        spending_changes=[],
                        spending_changes_str="none",
                        total_cost=request.requested_amount,
                        first_payment_date=request.request_date,
                        number_of_payments=2,
                        explanation=f"Pay {home_curr} {safe_today:,.2f} today and the remaining {home_curr} {remaining_amt:,.2f} on {earliest_full_date}."
                    ))

    # Strategy 3: installments (Supplied payment options)
    if 'installments' in methods_considered:
        max_months = profile.max_installment_months
        combos = generate_spending_change_combinations(recon, profile)

        for opt in options:
            if opt.payment_method != 'installments':
                continue

            # Check max_installment_months constraint
            freq = opt.payment_frequency_days or 30
            total_duration_days = (opt.number_of_payments - 1) * freq
            approx_months = total_duration_days / 30.0
            if max_months is not None and approx_months > max_months + 0.5:
                continue

            pmts = build_installment_schedule(opt)
            last_pmt_date = pmts[-1].date

            # Must complete by desired_completion_date
            if last_pmt_date > request.desired_completion_date:
                continue

            # Test without spending changes first
            for sc_list, sc_desc in combos:
                is_safe, _, _ = run_90day_simulation(recon, request.request_date, payments=pmts, spending_changes=sc_list)
                if is_safe:
                    plan_str = "|".join([f"{p.date}:{p.amount:.2f}".rstrip('0').rstrip('.') for p in pmts])
                    sc_str = "|".join(sc_list) if sc_list else "none"
                    status = AffordabilityStatus.AFFORDABLE_WITH_PLAN
                    
                    expl = f"Use {opt.number_of_payments} installments of {home_curr} {opt.payment_amount:,.2f}, starting {opt.first_payment_date}."
                    if sc_list:
                        expl = f"{sc_desc}, then use {opt.number_of_payments} installments of {home_curr} {opt.payment_amount:,.2f}."

                    candidates.append(CandidatePlan(
                        status=status,
                        method=PaymentMethod.INSTALLMENTS,
                        payments=pmts,
                        payment_plan_str=plan_str,
                        earliest_date_for_full_payment=earliest_full_date,
                        spending_changes=sc_list,
                        spending_changes_str=sc_str,
                        total_cost=opt.total_payable_amount,
                        first_payment_date=opt.first_payment_date,
                        number_of_payments=opt.number_of_payments,
                        payment_option_id=opt.payment_option_id,
                        explanation=expl
                    ))
                    break  # Take simplest safe spending change combo for this option

    # Strategy 4: wait (Full payment later)
    if 'full_payment' in methods_considered:
        if earliest_full_date != "" and earliest_full_date <= request.desired_completion_date and earliest_full_date > request.request_date:
            pmts = [PaymentItem(date=earliest_full_date, amount=request.requested_amount)]
            is_safe, _, _ = run_90day_simulation(recon, request.request_date, payments=pmts, spending_changes=[])
            if is_safe:
                candidates.append(CandidatePlan(
                    status=AffordabilityStatus.AFFORDABLE_LATER,
                    method=PaymentMethod.WAIT,
                    payments=pmts,
                    payment_plan_str=f"{earliest_full_date}:{request.requested_amount:.2f}".rstrip('0').rstrip('.'),
                    earliest_date_for_full_payment=earliest_full_date,
                    spending_changes=[],
                    spending_changes_str="none",
                    total_cost=request.requested_amount,
                    first_payment_date=earliest_full_date,
                    number_of_payments=1,
                    explanation=f"Pay {home_curr} {request.requested_amount:,.2f} in full on {earliest_full_date}. Paying earlier would take the balance below the minimum."
                ))

    # Strategy 5: Fallback - not_recommended
    if not candidates:
        expl = f"Do not make this payment by {request.desired_completion_date}. None of the available options keeps the minimum balance protected."
        if earliest_full_date != "" and earliest_full_date > request.desired_completion_date:
            expl = f"Do not proceed with the {home_curr} {request.requested_amount:,.2f} request. Full payment cannot be completed safely by {request.desired_completion_date}."

        candidates.append(CandidatePlan(
            status=AffordabilityStatus.NOT_AFFORDABLE,
            method=PaymentMethod.NOT_RECOMMENDED,
            payments=[],
            payment_plan_str="none",
            earliest_date_for_full_payment=earliest_full_date,
            spending_changes=[],
            spending_changes_str="none",
            total_cost=Decimal('0'),
            first_payment_date="",
            number_of_payments=0,
            explanation=expl
        ))

    return candidates
