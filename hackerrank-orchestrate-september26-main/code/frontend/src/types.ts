export interface UserProfile {
  user_id: string;
  home_currency: string;
  current_available_balance: number;
  minimum_balance_to_keep: number;
  financial_priorities: string[];
  expense_categories_to_protect: string[];
  expense_categories_user_is_willing_to_reduce: string[];
  expense_categories_user_is_willing_to_stop: string[];
  payment_methods_user_will_consider: string[];
  max_installment_months?: number;
}

export interface PredictionOutput {
  request_id: string;
  amount_safe_to_pay: number;
  affordability_status: 'affordable_now' | 'affordable_with_plan' | 'affordable_later' | 'not_affordable';
  recommended_payment_method: 'full_payment' | 'partial_payment' | 'installments' | 'wait' | 'not_recommended';
  payment_plan: string;
  earliest_date_for_full_payment: string;
  spending_changes_needed: string;
  decision_explanation: string;
}

export interface DailyForecastPoint {
  date: string;
  baseline_balance: number;
  plan_balance: number;
  minimum_balance: number;
  events: string[];
}

export interface EvidenceBreakdown {
  bills: Array<{
    event_id: string;
    description: string;
    category: string;
    amount: number;
    day_of_month: number;
    flexibility: string;
  }>;
  pending_debits: Array<{
    event_id: string;
    description: string;
    amount: number;
    date: string;
  }>;
  confirmed_income: Array<{
    type: string;
    amount: number;
    day_of_month: number;
  }>;
  messages: any[];
  images: any[];
  unresolved: string[];
}

export interface DecisionAnalysis {
  output: PredictionOutput;
  requested_amount: number;
  desired_completion_date: string;
  user_id: string;
  home_currency: string;
  current_available_balance: number;
  minimum_balance_to_keep: number;
  forecast: DailyForecastPoint[];
  evidence: EvidenceBreakdown;
}

export type NavTab = 'overview' | 'check' | 'history' | 'preferences';
