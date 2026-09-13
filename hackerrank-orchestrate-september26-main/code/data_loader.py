import pandas as pd
from decimal import Decimal
from typing import List, Dict, Optional
import os

from models import (
    UserProfile, FinancialEvent, ExchangeRate, RequestPaymentOption,
    MessageRecord, ImageRecord, RequestRecord, EventStatus, FlexibilityType
)

def parse_decimal(val) -> Optional[Decimal]:
    if pd.isna(val) or val is None or str(val).strip() == '':
        return None
    try:
        return Decimal(str(val).strip())
    except Exception:
        return None

def parse_list(val) -> List[str]:
    if pd.isna(val) or val is None or str(val).strip() == '':
        return []
    return [item.strip() for item in str(val).split('|') if item.strip()]

def parse_int(val) -> Optional[int]:
    if pd.isna(val) or val is None or str(val).strip() == '':
        return None
    try:
        return int(float(str(val).strip()))
    except Exception:
        return None

def parse_bool(val) -> bool:
    if pd.isna(val) or val is None:
        return False
    val_str = str(val).strip().lower()
    return val_str in ['true', '1', 't', 'yes']

class DataLoader:
    def __init__(self, dataset_dir: str):
        self.dataset_dir = dataset_dir
        self.profiles: Dict[str, UserProfile] = {}
        self.events: List[FinancialEvent] = []
        self.exchange_rates: List[ExchangeRate] = []
        self.payment_options: Dict[str, List[RequestPaymentOption]] = {}
        self.messages: List[MessageRecord] = []
        self.images: List[ImageRecord] = []

    def load_all(self):
        self.load_profiles()
        self.load_events()
        self.load_exchange_rates()
        self.load_payment_options()
        self.load_messages()
        self.load_images()

    def load_profiles(self):
        path = os.path.join(self.dataset_dir, 'financial_profiles.csv')
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            prof = UserProfile(
                user_id=str(row['user_id']).strip(),
                home_currency=str(row['home_currency']).strip(),
                current_available_balance=parse_decimal(row['current_available_balance']) or Decimal('0'),
                minimum_balance_to_keep=parse_decimal(row['minimum_balance_to_keep']) or Decimal('0'),
                financial_priorities=parse_list(row.get('financial_priorities')),
                expense_categories_to_protect=parse_list(row.get('expense_categories_to_protect')),
                expense_categories_user_is_willing_to_reduce=parse_list(row.get('expense_categories_user_is_willing_to_reduce')),
                expense_categories_user_is_willing_to_stop=parse_list(row.get('expense_categories_user_is_willing_to_stop')),
                payment_methods_user_will_consider=parse_list(row.get('payment_methods_user_will_consider')),
                max_installment_months=parse_int(row.get('max_installment_months'))
            )
            self.profiles[prof.user_id] = prof

    def load_events(self):
        path = os.path.join(self.dataset_dir, 'financial_events.csv')
        df = pd.read_csv(path, dtype=str)
        for _, row in df.iterrows():
            evt = FinancialEvent(
                event_id=str(row['event_id']).strip(),
                user_id=str(row['user_id']).strip(),
                event_type=str(row['event_type']).strip(),
                description=str(row['description']).strip() if pd.notna(row['description']) else '',
                category=str(row['category']).strip() if pd.notna(row['category']) else 'other',
                direction=str(row['direction']).strip(),
                amount=parse_decimal(row['amount']),
                currency=str(row['currency']).strip(),
                event_date=str(row['event_date']).strip(),
                settlement_date=str(row['settlement_date']).strip() if pd.notna(row['settlement_date']) and str(row['settlement_date']).strip() != '' else None,
                status=EventStatus(str(row['status']).strip()),
                linked_event_id=str(row['linked_event_id']).strip() if pd.notna(row['linked_event_id']) and str(row['linked_event_id']).strip() != '' else None,
                flexibility=FlexibilityType(str(row['flexibility']).strip()) if pd.notna(row['flexibility']) and str(row['flexibility']).strip() != '' else FlexibilityType.FIXED,
                minimum_allowed_amount=parse_decimal(row['minimum_allowed_amount'])
            )
            self.events.append(evt)

    def load_exchange_rates(self):
        path = os.path.join(self.dataset_dir, 'exchange_rates.csv')
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            rate = ExchangeRate(
                rate_date=str(row['rate_date']).strip(),
                from_currency=str(row['from_currency']).strip(),
                to_currency=str(row['to_currency']).strip(),
                rate=parse_decimal(row['rate']) or Decimal('1.0')
            )
            self.exchange_rates.append(rate)

    def load_payment_options(self):
        path = os.path.join(self.dataset_dir, 'request_payment_options.csv')
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            opt = RequestPaymentOption(
                payment_option_id=str(row['payment_option_id']).strip(),
                request_id=str(row['request_id']).strip(),
                payment_method=str(row['payment_method']).strip(),
                payment_amount=parse_decimal(row['payment_amount']) or Decimal('0'),
                number_of_payments=parse_int(row['number_of_payments']) or 1,
                first_payment_date=str(row['first_payment_date']).strip(),
                payment_frequency_days=parse_int(row.get('payment_frequency_days')),
                financing_fee=parse_decimal(row.get('financing_fee')) or Decimal('0'),
                total_payable_amount=parse_decimal(row['total_payable_amount']) or Decimal('0')
            )
            if opt.request_id not in self.payment_options:
                self.payment_options[opt.request_id] = []
            self.payment_options[opt.request_id].append(opt)

    def load_messages(self):
        path = os.path.join(self.dataset_dir, 'messages.csv')
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            msg = MessageRecord(
                message_id=str(row['message_id']).strip(),
                user_id=str(row['user_id']).strip(),
                request_id=str(row['request_id']).strip() if pd.notna(row['request_id']) and str(row['request_id']).strip() != '' else None,
                related_event_id=str(row['related_event_id']).strip() if pd.notna(row['related_event_id']) and str(row['related_event_id']).strip() != '' else None,
                sent_at=str(row['sent_at']).strip(),
                source_type=str(row['source_type']).strip(),
                message_text=str(row['message_text']).strip()
            )
            self.messages.append(msg)

    def load_images(self):
        path = os.path.join(self.dataset_dir, 'images.csv')
        df = pd.read_csv(path)
        for _, row in df.iterrows():
            img = ImageRecord(
                image_id=str(row['image_id']).strip(),
                user_id=str(row['user_id']).strip(),
                request_id=str(row['request_id']).strip() if pd.notna(row['request_id']) and str(row['request_id']).strip() != '' else None,
                related_event_id=str(row['related_event_id']).strip()
            )
            self.images.append(img)

    def load_requests(self, filename: str = 'requests.csv') -> List[RequestRecord]:
        path = os.path.join(self.dataset_dir, filename)
        df = pd.read_csv(path)
        reqs = []
        for _, row in df.iterrows():
            req = RequestRecord(
                request_id=str(row['request_id']).strip(),
                user_id=str(row['user_id']).strip(),
                request_date=str(row['request_date']).strip(),
                request_type=str(row['request_type']).strip(),
                requested_amount=parse_decimal(row['requested_amount']) or Decimal('0'),
                desired_completion_date=str(row['desired_completion_date']).strip(),
                allows_partial_payment=parse_bool(row['allows_partial_payment']),
                request_text=str(row['request_text']).strip()
            )
            reqs.append(req)
        return reqs
