from decimal import Decimal
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class AffordabilityStatus(str, Enum):
    AFFORDABLE_NOW = "affordable_now"
    AFFORDABLE_WITH_PLAN = "affordable_with_plan"
    AFFORDABLE_LATER = "affordable_later"
    NOT_AFFORDABLE = "not_affordable"

class PaymentMethod(str, Enum):
    FULL_PAYMENT = "full_payment"
    PARTIAL_PAYMENT = "partial_payment"
    INSTALLMENTS = "installments"
    WAIT = "wait"
    NOT_RECOMMENDED = "not_recommended"

class FlexibilityType(str, Enum):
    FIXED = "fixed"
    REDUCIBLE = "reducible"
    STOPPABLE = "stoppable"
    REDUCIBLE_OR_STOPPABLE = "reducible_or_stoppable"

class EventStatus(str, Enum):
    SETTLED = "settled"
    PENDING = "pending"
    SCHEDULED = "scheduled"
    UNREALIZED = "unrealized"
    FAILED = "failed"
    CANCELLED = "cancelled"

class UserProfile(BaseModel):
    user_id: str
    home_currency: str
    current_available_balance: Decimal
    minimum_balance_to_keep: Decimal
    financial_priorities: List[str] = Field(default_factory=list)
    expense_categories_to_protect: List[str] = Field(default_factory=list)
    expense_categories_user_is_willing_to_reduce: List[str] = Field(default_factory=list)
    expense_categories_user_is_willing_to_stop: List[str] = Field(default_factory=list)
    payment_methods_user_will_consider: List[str] = Field(default_factory=list)
    max_installment_months: Optional[int] = None

class FinancialEvent(BaseModel):
    event_id: str
    user_id: str
    event_type: str
    description: str
    category: str
    direction: str  # debit / credit
    amount: Optional[Decimal] = None
    currency: str
    event_date: str
    settlement_date: Optional[str] = None
    status: EventStatus
    linked_event_id: Optional[str] = None
    flexibility: FlexibilityType = FlexibilityType.FIXED
    minimum_allowed_amount: Optional[Decimal] = None

class ExchangeRate(BaseModel):
    rate_date: str
    from_currency: str
    to_currency: str
    rate: Decimal

class RequestPaymentOption(BaseModel):
    payment_option_id: str
    request_id: str
    payment_method: str
    payment_amount: Decimal
    number_of_payments: int
    first_payment_date: str
    payment_frequency_days: Optional[int] = None
    financing_fee: Decimal = Decimal('0')
    total_payable_amount: Decimal

class MessageRecord(BaseModel):
    message_id: str
    user_id: str
    request_id: Optional[str] = None
    related_event_id: Optional[str] = None
    sent_at: str
    source_type: str
    message_text: str

class ImageRecord(BaseModel):
    image_id: str
    user_id: str
    request_id: Optional[str] = None
    related_event_id: str

class RequestRecord(BaseModel):
    request_id: str
    user_id: str
    request_date: str
    request_type: str
    requested_amount: Decimal
    desired_completion_date: str
    allows_partial_payment: bool
    request_text: str

class PaymentItem(BaseModel):
    date: str
    amount: Decimal

class CandidatePlan(BaseModel):
    status: AffordabilityStatus
    method: PaymentMethod
    payments: List[PaymentItem] = Field(default_factory=list)
    payment_plan_str: str  # e.g. "2024-03-03:25256" or "none"
    earliest_date_for_full_payment: str  # YYYY-MM-DD or ""
    spending_changes: List[str] = Field(default_factory=list)  # e.g. ["stop:event_14"]
    spending_changes_str: str  # e.g. "stop:event_14|reduce_to:event_21:100" or "none"
    total_cost: Decimal
    first_payment_date: str
    number_of_payments: int
    payment_option_id: Optional[str] = None
    explanation: str

class PredictionOutput(BaseModel):
    request_id: str
    amount_safe_to_pay: Decimal
    affordability_status: AffordabilityStatus
    recommended_payment_method: PaymentMethod
    payment_plan: str
    earliest_date_for_full_payment: str
    spending_changes_needed: str
    decision_explanation: str

class DailyForecastPoint(BaseModel):
    date: str
    baseline_balance: float
    plan_balance: float
    minimum_balance: float
    events: List[str] = Field(default_factory=list)

class EvidenceBreakdown(BaseModel):
    bills: List[Dict[str, Any]] = Field(default_factory=list)
    pending_debits: List[Dict[str, Any]] = Field(default_factory=list)
    confirmed_income: List[Dict[str, Any]] = Field(default_factory=list)
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    images: List[Dict[str, Any]] = Field(default_factory=list)
    unresolved: List[str] = Field(default_factory=list)

class DecisionAnalysis(BaseModel):
    output: PredictionOutput
    requested_amount: Decimal
    desired_completion_date: str
    user_id: str
    home_currency: str
    current_available_balance: Decimal
    minimum_balance_to_keep: Decimal
    forecast: List[DailyForecastPoint] = Field(default_factory=list)
    evidence: EvidenceBreakdown = Field(default_factory=EvidenceBreakdown)
