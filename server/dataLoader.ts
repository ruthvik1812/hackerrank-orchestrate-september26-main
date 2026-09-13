import fs from 'fs';
import path from 'path';
import { parseCSV } from './csvParser.js';

export interface UserProfileData {
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

export interface FinancialEventData {
  event_id: string;
  user_id: string;
  event_type: string;
  description: string;
  category: string;
  direction: 'debit' | 'credit';
  amount: number;
  currency: string;
  event_date: string;
  settlement_date: string;
  status: string;
  linked_event_id: string;
  flexibility: string;
  minimum_allowed_amount?: number;
}

export interface PaymentOptionData {
  request_id: string;
  payment_option_id: string;
  payment_method: string;
  first_payment_date: string;
  number_of_payments: number;
  payment_frequency_days: number;
  payment_amount: number;
  total_cost: number;
}

export interface RequestRecordData {
  request_id: string;
  user_id: string;
  request_date: string;
  request_type: string;
  requested_amount: number;
  desired_completion_date: string;
  allows_partial_payment: boolean;
  request_text: string;
  amount_safe_to_pay?: number;
  affordability_status?: string;
  recommended_payment_method?: string;
  payment_plan?: string;
  earliest_date_for_full_payment?: string;
  spending_changes_needed?: string;
  decision_explanation?: string;
}

export interface MessageData {
  message_id: string;
  user_id: string;
  message_date: string;
  sender: string;
  content: string;
}

export class DataLoader {
  datasetDir: string;
  profiles: Map<string, UserProfileData> = new Map();
  events: FinancialEventData[] = [];
  paymentOptions: Map<string, PaymentOptionData[]> = new Map();
  sampleRequests: RequestRecordData[] = [];
  requests: RequestRecordData[] = [];
  outputMap: Map<string, Record<string, string>> = new Map();
  messages: MessageData[] = [];

  constructor(datasetDir?: string) {
    this.datasetDir = datasetDir || path.resolve(process.cwd(), 'dataset');
  }

  loadAll() {
    this.loadProfiles();
    this.loadEvents();
    this.loadPaymentOptions();
    this.loadOutputs();
    this.loadSampleRequests();
    this.loadRequests();
    this.loadMessages();
  }

  private loadProfiles() {
    const filePath = path.join(this.datasetDir, 'financial_profiles.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (!r.user_id) continue;
      this.profiles.set(r.user_id, {
        user_id: r.user_id,
        home_currency: r.home_currency || 'USD',
        current_available_balance: parseFloat(r.current_available_balance) || 0,
        minimum_balance_to_keep: parseFloat(r.minimum_balance_to_keep) || 0,
        financial_priorities: r.financial_priorities ? r.financial_priorities.split('|').map(s => s.trim()) : [],
        expense_categories_to_protect: r.expense_categories_to_protect ? r.expense_categories_to_protect.split('|').map(s => s.trim()) : [],
        expense_categories_user_is_willing_to_reduce: r.expense_categories_user_is_willing_to_reduce ? r.expense_categories_user_is_willing_to_reduce.split('|').map(s => s.trim()) : [],
        expense_categories_user_is_willing_to_stop: r.expense_categories_user_is_willing_to_stop ? r.expense_categories_user_is_willing_to_stop.split('|').map(s => s.trim()) : [],
        payment_methods_user_will_consider: r.payment_methods_user_will_consider ? r.payment_methods_user_will_consider.split('|').map(s => s.trim()) : ['full_payment', 'partial_payment', 'installments'],
        max_installment_months: r.max_installment_months ? parseInt(r.max_installment_months, 10) : undefined,
      });
    }
  }

  private loadEvents() {
    const filePath = path.join(this.datasetDir, 'financial_events.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (!r.event_id) continue;
      this.events.push({
        event_id: r.event_id,
        user_id: r.user_id,
        event_type: r.event_type || 'expense',
        description: r.description || '',
        category: r.category || 'general',
        direction: (r.direction === 'credit' ? 'credit' : 'debit'),
        amount: parseFloat(r.amount) || 0,
        currency: r.currency || 'USD',
        event_date: r.event_date || '',
        settlement_date: r.settlement_date || r.event_date || '',
        status: r.status || 'settled',
        linked_event_id: r.linked_event_id || '',
        flexibility: r.flexibility || 'fixed',
        minimum_allowed_amount: r.minimum_allowed_amount ? parseFloat(r.minimum_allowed_amount) : undefined,
      });
    }
  }

  private loadPaymentOptions() {
    const filePath = path.join(this.datasetDir, 'request_payment_options.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (!r.request_id) continue;
      const opt: PaymentOptionData = {
        request_id: r.request_id,
        payment_option_id: r.payment_option_id || '',
        payment_method: r.payment_method || 'installments',
        first_payment_date: r.first_payment_date || '',
        number_of_payments: parseInt(r.number_of_payments, 10) || 1,
        payment_frequency_days: parseInt(r.payment_frequency_days, 10) || 30,
        payment_amount: parseFloat(r.payment_amount) || 0,
        total_cost: parseFloat(r.total_cost) || 0,
      };

      if (!this.paymentOptions.has(r.request_id)) {
        this.paymentOptions.set(r.request_id, []);
      }
      this.paymentOptions.get(r.request_id)!.push(opt);
    }
  }

  private loadOutputs() {
    const filePath = path.join(this.datasetDir, 'output.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (r.request_id) {
        this.outputMap.set(r.request_id, r);
      }
    }
  }

  private loadSampleRequests() {
    const filePath = path.join(this.datasetDir, 'sample_requests.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (!r.request_id) continue;
      this.sampleRequests.push({
        request_id: r.request_id,
        user_id: r.user_id,
        request_date: r.request_date,
        request_type: r.request_type,
        requested_amount: parseFloat(r.requested_amount) || 0,
        desired_completion_date: r.desired_completion_date,
        allows_partial_payment: r.allows_partial_payment === 'true' || r.allows_partial_payment === '1',
        request_text: r.request_text || '',
        amount_safe_to_pay: r.amount_safe_to_pay ? parseFloat(r.amount_safe_to_pay) : 0,
        affordability_status: r.affordability_status,
        recommended_payment_method: r.recommended_payment_method,
        payment_plan: r.payment_plan,
        earliest_date_for_full_payment: r.earliest_date_for_full_payment,
        spending_changes_needed: r.spending_changes_needed,
        decision_explanation: r.decision_explanation,
      });
    }
  }

  private loadRequests() {
    const filePath = path.join(this.datasetDir, 'requests.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (!r.request_id) continue;
      const out = this.outputMap.get(r.request_id);
      this.requests.push({
        request_id: r.request_id,
        user_id: r.user_id,
        request_date: r.request_date,
        request_type: r.request_type,
        requested_amount: parseFloat(r.requested_amount) || 0,
        desired_completion_date: r.desired_completion_date,
        allows_partial_payment: r.allows_partial_payment === 'true' || r.allows_partial_payment === '1',
        request_text: r.request_text || '',
        amount_safe_to_pay: out?.amount_safe_to_pay ? parseFloat(out.amount_safe_to_pay) : 0,
        affordability_status: out?.affordability_status,
        recommended_payment_method: out?.recommended_payment_method,
        payment_plan: out?.payment_plan,
        earliest_date_for_full_payment: out?.earliest_date_for_full_payment,
        spending_changes_needed: out?.spending_changes_needed,
        decision_explanation: out?.decision_explanation,
      });
    }
  }

  private loadMessages() {
    const filePath = path.join(this.datasetDir, 'messages.csv');
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(text);

    for (const r of rows) {
      if (!r.message_id) continue;
      this.messages.push({
        message_id: r.message_id,
        user_id: r.user_id,
        message_date: r.message_date || '',
        sender: r.sender || '',
        content: r.content || '',
      });
    }
  }
}
