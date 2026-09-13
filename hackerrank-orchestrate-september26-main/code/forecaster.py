from decimal import Decimal
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

from models import DailyForecastPoint, PaymentItem

def add_months(d: datetime, months: int) -> datetime:
    new_month = d.month + months
    new_year = d.year + (new_month - 1) // 12
    new_month = (new_month - 1) % 12 + 1
    max_days = 31
    if new_month in [4, 6, 9, 11]:
        max_days = 30
    elif new_month == 2:
        max_days = 29 if (new_year % 4 == 0 and (new_year % 100 != 0 or new_year % 400 == 0)) else 28
    new_day = min(d.day, max_days)
    return datetime(new_year, new_month, new_day)

def run_90day_simulation(
    recon: Dict[str, Any],
    request_date_str: str,
    payments: List[PaymentItem] = None,
    spending_changes: List[str] = None
) -> Tuple[bool, List[DailyForecastPoint], Decimal]:
    if payments is None:
        payments = []
    if spending_changes is None:
        spending_changes = []

    profile = recon["profile"]
    min_bal = profile.minimum_balance_to_keep
    start_bal = recon["starting_balance"]
    salary_amt = recon["salary_amount"]
    salary_dom = recon["salary_day_of_month"]
    pending_debits = recon["future_pending_debits"]
    future_income = recon.get("future_income_events", [])
    recurring_exp = recon["recurring_expenses"]

    stopped_event_ids = set()
    reduced_amounts: Dict[str, Decimal] = {}
    for sc in spending_changes:
        if sc.startswith("stop:"):
            evt_id = sc.replace("stop:", "").strip()
            stopped_event_ids.add(evt_id)
        elif sc.startswith("reduce_to:"):
            parts = sc.split(":")
            if len(parts) == 3:
                evt_id = parts[1].strip()
                try:
                    new_amt = Decimal(parts[2].strip())
                    reduced_amounts[evt_id] = new_amt
                except Exception:
                    pass

    pmts_by_date: Dict[str, Decimal] = {}
    for pmt in payments:
        pmts_by_date[pmt.date] = pmts_by_date.get(pmt.date, Decimal('0')) + pmt.amount

    pending_by_date: Dict[str, Decimal] = {}
    for deb in pending_debits:
        d_str = deb.settlement_date or deb.event_date
        pending_by_date[d_str] = pending_by_date.get(d_str, Decimal('0')) + deb.amount

    future_income_by_date: Dict[str, Decimal] = {}
    for inc in future_income:
        d_str = inc.settlement_date or inc.event_date
        future_income_by_date[d_str] = future_income_by_date.get(d_str, Decimal('0')) + inc.amount

    d_start = datetime.strptime(request_date_str, '%Y-%m-%d')
    d_end = d_start + timedelta(days=90)

    # Recurring expense occurrence dates strictly after request_date
    recurring_events_by_date: Dict[str, List[Tuple[str, str, Decimal]]] = {}

    for exp in recurring_exp:
        evt_id = exp["event_id"]
        if evt_id in stopped_event_ids:
            continue

        exp_amt = exp["amount"]
        if evt_id in reduced_amounts:
            exp_amt = reduced_amounts[evt_id]

        dom = exp["day_of_month"]
        if dom > d_start.day:
            try:
                first_d = datetime(d_start.year, d_start.month, min(dom, 28 if d_start.month == 2 else 30))
            except Exception:
                first_d = datetime(d_start.year, d_start.month, 28)
        else:
            next_m = add_months(d_start, 1)
            try:
                first_d = datetime(next_m.year, next_m.month, min(dom, 28 if next_m.month == 2 else 30))
            except Exception:
                first_d = datetime(next_m.year, next_m.month, 28)

        curr_d = first_d
        while curr_d <= d_end:
            if curr_d > d_start:
                d_str = curr_d.strftime('%Y-%m-%d')
                if d_str not in recurring_events_by_date:
                    recurring_events_by_date[d_str] = []
                recurring_events_by_date[d_str].append((evt_id, exp["category"], exp_amt))
            curr_d = add_months(curr_d, 1)

    # Salary income dates strictly after request_date
    salary_dates = set()
    if salary_amt > Decimal('0'):
        if salary_dom > d_start.day:
            try:
                first_sal = datetime(d_start.year, d_start.month, min(salary_dom, 28 if d_start.month == 2 else 30))
            except Exception:
                first_sal = datetime(d_start.year, d_start.month, 28)
        else:
            next_m = add_months(d_start, 1)
            try:
                first_sal = datetime(next_m.year, next_m.month, min(salary_dom, 28 if next_m.month == 2 else 30))
            except Exception:
                first_sal = datetime(next_m.year, next_m.month, 28)

        curr_sal = first_sal
        while curr_sal <= d_end:
            if curr_sal > d_start:
                salary_dates.add(curr_sal.strftime('%Y-%m-%d'))
            curr_sal = add_months(curr_sal, 1)

    curr_bal = start_bal
    min_headroom = Decimal('999999999')
    trajectory: List[DailyForecastPoint] = []
    is_safe = True

    for i in range(91):
        d_curr = d_start + timedelta(days=i)
        d_str = d_curr.strftime('%Y-%m-%d')
        daily_events = []

        if d_str in future_income_by_date:
            amt_inc = future_income_by_date[d_str]
            curr_bal += amt_inc
            daily_events.append(f"Confirmed income (+{amt_inc:,.2f})")

        if d_str in salary_dates and d_str not in future_income_by_date:
            curr_bal += salary_amt
            daily_events.append(f"Salary (+{salary_amt:,.2f})")

        if d_str in pending_by_date:
            amt_p = pending_by_date[d_str]
            curr_bal -= amt_p
            daily_events.append(f"Pending payment (-{amt_p:,.2f})")

        if d_str in recurring_events_by_date:
            for evt_id, cat, exp_amt in recurring_events_by_date[d_str]:
                curr_bal -= exp_amt
                daily_events.append(f"{cat.title()} expense (-{exp_amt:,.2f})")

        if d_str in pmts_by_date:
            amt_plan = pmts_by_date[d_str]
            curr_bal -= amt_plan
            daily_events.append(f"Plan payment (-{amt_plan:,.2f})")

        headroom = curr_bal - min_bal
        if headroom < min_headroom:
            min_headroom = headroom

        if curr_bal < min_bal:
            is_safe = False

        trajectory.append(DailyForecastPoint(
            date=d_str,
            baseline_balance=float(curr_bal),
            plan_balance=float(curr_bal),
            minimum_balance=float(min_bal),
            events=daily_events
        ))

    return is_safe, trajectory, min_headroom

def calculate_baseline_metrics(recon: Dict[str, Any], request_date_str: str, requested_amount: Decimal) -> Tuple[Decimal, str, List[DailyForecastPoint]]:
    _, base_traj, min_headroom = run_90day_simulation(recon, request_date_str, payments=[], spending_changes=[])

    d_start = datetime.strptime(request_date_str, '%Y-%m-%d')
    salary_dom = recon["salary_day_of_month"]
    
    if salary_dom > d_start.day:
        try:
            next_payday = datetime(d_start.year, d_start.month, min(salary_dom, 28))
        except Exception:
            next_payday = datetime(d_start.year, d_start.month, 28)
    else:
        next_m = add_months(d_start, 1)
        try:
            next_payday = datetime(next_m.year, next_m.month, min(salary_dom, 28))
        except Exception:
            next_payday = datetime(next_m.year, next_m.month, 28)

    # Minimum headroom strictly before next payday (or overall min_headroom if payday is today)
    headroom_before_payday = Decimal('999999999')
    for pt in base_traj:
        d_pt = datetime.strptime(pt.date, '%Y-%m-%d')
        if d_pt <= next_payday:
            h = Decimal(str(pt.baseline_balance)) - Decimal(str(pt.minimum_balance))
            if h < headroom_before_payday:
                headroom_before_payday = h

    if headroom_before_payday == Decimal('999999999'):
        headroom_before_payday = min_headroom

    safe_today = max(Decimal('0'), min(requested_amount, headroom_before_payday))

    # Calculate earliest_date_for_full_payment (independently of preferences)
    earliest_full_date = ""
    for i in range(91):
        d_test = d_start + timedelta(days=i)
        d_test_str = d_test.strftime('%Y-%m-%d')
        pmt = [PaymentItem(date=d_test_str, amount=requested_amount)]
        is_safe, _, _ = run_90day_simulation(recon, request_date_str, payments=pmt, spending_changes=[])
        if is_safe:
            earliest_full_date = d_test_str
            break

    if earliest_full_date == request_date_str and safe_today < requested_amount:
        # If single full payment isn't safe today, search from day 1 onwards
        earliest_full_date = ""
        for i in range(1, 91):
            d_test = d_start + timedelta(days=i)
            d_test_str = d_test.strftime('%Y-%m-%d')
            pmt = [PaymentItem(date=d_test_str, amount=requested_amount)]
            is_safe, _, _ = run_90day_simulation(recon, request_date_str, payments=pmt, spending_changes=[])
            if is_safe:
                earliest_full_date = d_test_str
                break

    return safe_today, earliest_full_date, base_traj
