import os
from decimal import Decimal
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, timedelta

from models import UserProfile, FinancialEvent, ExchangeRate, EventStatus, FlexibilityType, MessageRecord, ImageRecord
from evidence_extractor import extract_amount_from_image, parse_payroll_messages

def convert_currency(amount: Decimal, from_curr: str, to_curr: str, date_str: str, rates: List[ExchangeRate]) -> Decimal:
    if from_curr == to_curr or not from_curr:
        return amount

    for r in rates:
        if r.from_currency == from_curr and r.to_currency == to_curr and r.rate_date == date_str:
            return amount * r.rate
        if r.from_currency == to_curr and r.to_currency == from_curr and r.rate_date == date_str and r.rate != Decimal('0'):
            return amount / r.rate

    closest_rate = None
    min_days = 99999
    try:
        d_target = datetime.strptime(date_str, '%Y-%m-%d')
        for r in rates:
            if (r.from_currency == from_curr and r.to_currency == to_curr) or (r.from_currency == to_curr and r.to_currency == from_curr):
                d_r = datetime.strptime(r.rate_date, '%Y-%m-%d')
                diff = abs((d_r - d_target).days)
                if diff < min_days:
                    min_days = diff
                    closest_rate = r
    except Exception:
        pass

    if closest_rate:
        if closest_rate.from_currency == from_curr and closest_rate.to_currency == to_curr:
            return amount * closest_rate.rate
        elif closest_rate.rate != Decimal('0'):
            return amount / closest_rate.rate

    default_rates = {
        ("EUR", "ZAR"): Decimal("20"),
        ("USD", "EUR"): Decimal("0.92"),
        ("USD", "IDR"): Decimal("15833.33"),
        ("USD", "INR"): Decimal("83.0"),
        ("EUR", "IDR"): Decimal("17200.0"),
        ("EUR", "INR"): Decimal("90.0"),
    }
    if (from_curr, to_curr) in default_rates:
        return amount * default_rates[(from_curr, to_curr)]
    if (to_curr, from_curr) in default_rates and default_rates[(to_curr, from_curr)] != Decimal('0'):
        return amount / default_rates[(to_curr, from_curr)]

    return amount

def reconstruct_user_financial_state(
    profile: UserProfile,
    all_events: List[FinancialEvent],
    rates: List[ExchangeRate],
    images: List[ImageRecord],
    messages: List[MessageRecord],
    request_date: str,
    dataset_dir: str
) -> Dict[str, Any]:
    user_id = profile.user_id
    home_curr = profile.home_currency

    user_events = [e for e in all_events if e.user_id == user_id]
    user_images = [img for img in images if img.user_id == user_id]
    img_by_event = {img.related_event_id: img for img in user_images}

    msg_info = parse_payroll_messages(messages, user_id)

    processed_events: List[FinancialEvent] = []
    linked_children = {e.linked_event_id: e for e in user_events if e.linked_event_id}

    for e in user_events:
        if e.event_id in linked_children:
            child = linked_children[e.event_id]
            if child.status in [EventStatus.CANCELLED, EventStatus.FAILED]:
                continue
            if child.status == EventStatus.SETTLED and e.status != EventStatus.SETTLED:
                continue

        if e.status in [EventStatus.FAILED, EventStatus.CANCELLED, EventStatus.UNREALIZED]:
            continue

        if e.status == EventStatus.PENDING and e.direction == 'credit':
            continue

        amount = e.amount
        if amount is None or amount == Decimal('0'):
            if e.event_id in img_by_event:
                img_rec = img_by_event[e.event_id]
                img_path = os.path.join(dataset_dir, 'media', 'images', f"{img_rec.image_id}.png")
                extracted_amt, img_curr = extract_amount_from_image(img_rec.image_id, img_path)
                amount = extracted_amt
                if e.currency != img_curr and img_curr != '':
                    e.currency = img_curr
            else:
                amount = Decimal('0')

        event_date_for_rate = e.settlement_date or e.event_date
        converted_amount = convert_currency(amount, e.currency, home_curr, event_date_for_rate, rates)

        min_allowed = e.minimum_allowed_amount
        if min_allowed is not None and e.currency != home_curr:
            min_allowed = convert_currency(min_allowed, e.currency, home_curr, event_date_for_rate, rates)

        e_copy = FinancialEvent(
            event_id=e.event_id,
            user_id=e.user_id,
            event_type=e.event_type,
            description=e.description,
            category=e.category,
            direction=e.direction,
            amount=converted_amount,
            currency=home_curr,
            event_date=e.event_date,
            settlement_date=e.settlement_date,
            status=e.status,
            linked_event_id=e.linked_event_id,
            flexibility=e.flexibility,
            minimum_allowed_amount=min_allowed
        )
        processed_events.append(e_copy)

    # Starting available balance
    starting_bal = profile.current_available_balance

    # Reserve pending debits on or before request_date
    pending_debits_reserved = Decimal('0')
    for e in processed_events:
        if e.status == EventStatus.PENDING and e.direction == 'debit':
            settle_d = e.settlement_date or e.event_date
            if settle_d <= request_date:
                pending_debits_reserved += e.amount

    starting_bal -= pending_debits_reserved

    # Future pending debits strictly after request_date
    future_pending_debits = [
        e for e in processed_events
        if e.status == EventStatus.PENDING and e.direction == 'debit' and (e.settlement_date or e.event_date) > request_date
    ]

    # Future scheduled income / salary credits
    future_income_events = [
        e for e in processed_events
        if e.direction == 'credit' and (e.settlement_date or e.event_date) > request_date and e.status in [EventStatus.SETTLED, EventStatus.SCHEDULED]
    ]

    # Historical salary pattern
    salary_events = [
        e for e in processed_events
        if e.direction == 'credit' and e.event_type in ['salary', 'income'] and e.status == EventStatus.SETTLED
    ]

    latest_salary_amt = Decimal('0')
    salary_day_of_month = 15

    if salary_events:
        salary_events.sort(key=lambda x: x.settlement_date or x.event_date, reverse=True)
        latest_sal = salary_events[0]
        latest_salary_amt = latest_sal.amount
        d_sal = datetime.strptime(latest_sal.settlement_date or latest_sal.event_date, '%Y-%m-%d')
        salary_day_of_month = d_sal.day

    if msg_info["updated_salary"] is not None:
        latest_salary_amt = msg_info["updated_salary"]

    if msg_info["salary_effective_date"] is not None:
        try:
            d_eff = datetime.strptime(msg_info["salary_effective_date"], '%Y-%m-%d')
            salary_day_of_month = d_eff.day
        except Exception:
            pass

    if msg_info["contract_ended"]:
        latest_salary_amt = Decimal('0')

    # True recurring commitment categories
    recurring_categories = {
        'rent', 'housing', 'utilities', 'education', 'debt_repayment', 'family_support',
        'cloud_storage', 'streaming', 'music_subscription', 'delivery_membership', 'insurance'
    }

    recurring_expenses: List[Dict[str, Any]] = []
    category_desc_groups: Dict[Tuple[str, str], List[FinancialEvent]] = {}
    for e in processed_events:
        if e.direction == 'debit' and e.status in [EventStatus.SETTLED, EventStatus.SCHEDULED]:
            key = (e.category, e.description)
            if key not in category_desc_groups:
                category_desc_groups[key] = []
            category_desc_groups[key].append(e)

    for (cat, desc), evts in category_desc_groups.items():
        if not evts:
            continue
        evts.sort(key=lambda x: x.settlement_date or x.event_date, reverse=True)
        most_recent = evts[0]

        is_stoppable_or_reducible = most_recent.flexibility in [FlexibilityType.STOPPABLE, FlexibilityType.REDUCIBLE, FlexibilityType.REDUCIBLE_OR_STOPPABLE]

        is_recurring = (
            cat in recurring_categories or
            most_recent.event_type in ['subscription', 'debt_payment'] or
            is_stoppable_or_reducible or
            len(evts) >= 3
        )

        if is_recurring:
            try:
                d_m = datetime.strptime(most_recent.settlement_date or most_recent.event_date, '%Y-%m-%d')
                day_of_m = d_m.day
            except Exception:
                day_of_m = 1

            recurring_expenses.append({
                "event_id": most_recent.event_id,
                "category": cat,
                "description": desc,
                "amount": most_recent.amount,
                "day_of_month": day_of_m,
                "flexibility": most_recent.flexibility,
                "minimum_allowed_amount": most_recent.minimum_allowed_amount
            })

    return {
        "profile": profile,
        "starting_balance": starting_bal,
        "processed_events": processed_events,
        "future_pending_debits": future_pending_debits,
        "future_income_events": future_income_events,
        "salary_amount": latest_salary_amt,
        "salary_day_of_month": salary_day_of_month,
        "recurring_expenses": recurring_expenses,
        "msg_info": msg_info
    }
