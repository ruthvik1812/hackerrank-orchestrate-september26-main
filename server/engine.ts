import {
  UserProfileData,
  FinancialEventData,
  PaymentOptionData,
  DataLoader
} from './dataLoader.js';

export interface DailyForecastPoint {
  date: string;
  baseline_balance: number;
  plan_balance: number;
  minimum_balance: number;
  events: string[];
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

export interface PaymentItem {
  date: string;
  amount: number;
}

export interface CandidatePlan {
  status: 'affordable_now' | 'affordable_with_plan' | 'affordable_later' | 'not_affordable';
  method: 'full_payment' | 'partial_payment' | 'installments' | 'wait' | 'not_recommended';
  payments: PaymentItem[];
  payment_plan_str: string;
  earliest_date_for_full_payment: string;
  spending_changes: string[];
  spending_changes_str: string;
  total_cost: number;
  first_payment_date: string;
  number_of_payments: number;
  payment_option_id?: string;
  explanation: string;
}

export interface ReconstructedState {
  profile: UserProfileData;
  starting_balance: number;
  salary_amount: number;
  salary_day_of_month: number;
  recurring_expenses: Array<{
    event_id: string;
    description: string;
    category: string;
    amount: number;
    day_of_month: number;
    flexibility: string;
    minimum_allowed_amount?: number;
  }>;
  future_pending_debits: Array<{
    event_id: string;
    description: string;
    amount: number;
    date: string;
  }>;
  future_income_events: Array<{
    event_id: string;
    description: string;
    amount: number;
    date: string;
  }>;
}

function parseDate(dStr: string): Date {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d.getTime());
  res.setDate(res.getDate() + days);
  return res;
}

function addMonths(d: Date, months: number): Date {
  const newMonth = d.getMonth() + months;
  const newYear = d.getFullYear() + Math.floor(newMonth / 12);
  const targetMonth = ((newMonth % 12) + 12) % 12;
  const daysInTarget = new Date(newYear, targetMonth + 1, 0).getDate();
  const newDay = Math.min(d.getDate(), daysInTarget);
  return new Date(newYear, targetMonth, newDay);
}

export function reconstructUserState(
  profile: UserProfileData,
  allEvents: FinancialEventData[],
  requestDateStr: string
): ReconstructedState {
  const userId = profile.user_id;
  const userEvents = allEvents.filter(e => e.user_id === userId);

  // 1. Identify salary
  let salaryAmount = 0;
  let salaryDay = 25; // default
  const salaryEvents = userEvents.filter(
    e => e.direction === 'credit' && (e.category === 'salary' || e.description.toLowerCase().includes('salary'))
  );

  if (salaryEvents.length > 0) {
    // Sort by event_date desc
    salaryEvents.sort((a, b) => b.event_date.localeCompare(a.event_date));
    const primary = salaryEvents[0];
    salaryAmount = primary.amount;
    const d = parseDate(primary.event_date);
    salaryDay = d.getDate();
  }

  // 2. Identify recurring expenses (expenses that appear multiple times or marked stoppable/reducible/fixed)
  const recurringMap = new Map<string, {
    event_id: string;
    description: string;
    category: string;
    amount: number;
    day_of_month: number;
    flexibility: string;
    minimum_allowed_amount?: number;
  }>();

  for (const e of userEvents) {
    if (e.direction === 'debit' && e.status === 'settled' && e.amount > 0) {
      const cat = e.category || 'general';
      if (!recurringMap.has(cat)) {
        const d = parseDate(e.event_date);
        recurringMap.set(cat, {
          event_id: e.event_id,
          description: e.description || `${cat} bill`,
          category: cat,
          amount: e.amount,
          day_of_month: d.getDate(),
          flexibility: e.flexibility || 'fixed',
          minimum_allowed_amount: e.minimum_allowed_amount,
        });
      }
    }
  }

  // 3. Pending debits and future income (date >= requestDate)
  const futurePendingDebits: Array<{ event_id: string; description: string; amount: number; date: string }> = [];
  const futureIncomeEvents: Array<{ event_id: string; description: string; amount: number; date: string }> = [];

  for (const e of userEvents) {
    const targetDate = e.settlement_date || e.event_date;
    if (targetDate >= requestDateStr) {
      if (e.direction === 'debit' && (e.status === 'pending' || e.status === 'scheduled')) {
        futurePendingDebits.push({
          event_id: e.event_id,
          description: e.description,
          amount: e.amount,
          date: targetDate,
        });
      } else if (e.direction === 'credit' && e.status === 'scheduled') {
        futureIncomeEvents.push({
          event_id: e.event_id,
          description: e.description,
          amount: e.amount,
          date: targetDate,
        });
      }
    }
  }

  return {
    profile,
    starting_balance: profile.current_available_balance,
    salary_amount: salaryAmount,
    salary_day_of_month: salaryDay,
    recurring_expenses: Array.from(recurringMap.values()),
    future_pending_debits: futurePendingDebits,
    future_income_events: futureIncomeEvents,
  };
}

export function run90DaySimulation(
  recon: ReconstructedState,
  requestDateStr: string,
  payments: PaymentItem[] = [],
  spendingChanges: string[] = []
): { isSafe: boolean; trajectory: DailyForecastPoint[]; minHeadroom: number } {
  const profile = recon.profile;
  const minBal = profile.minimum_balance_to_keep;
  let currBal = recon.starting_balance;
  const salaryAmt = recon.salary_amount;
  const salaryDom = recon.salary_day_of_month;

  const stoppedEventIds = new Set<string>();
  const reducedAmounts = new Map<string, number>();

  for (const sc of spendingChanges) {
    if (sc.startsWith('stop:')) {
      stoppedEventIds.add(sc.replace('stop:', '').trim());
    } else if (sc.startsWith('reduce_to:')) {
      const parts = sc.split(':');
      if (parts.length === 3) {
        reducedAmounts.set(parts[1].trim(), parseFloat(parts[2].trim()) || 0);
      }
    }
  }

  const pmtsByDate = new Map<string, number>();
  for (const p of payments) {
    pmtsByDate.set(p.date, (pmtsByDate.get(p.date) || 0) + p.amount);
  }

  const pendingByDate = new Map<string, number>();
  for (const deb of recon.future_pending_debits) {
    pendingByDate.set(deb.date, (pendingByDate.get(deb.date) || 0) + deb.amount);
  }

  const futureIncByDate = new Map<string, number>();
  for (const inc of recon.future_income_events) {
    futureIncByDate.set(inc.date, (futureIncByDate.get(inc.date) || 0) + inc.amount);
  }

  const dStart = parseDate(requestDateStr);
  const dEnd = addDays(dStart, 90);

  // Pre-calculate recurring expenses occurrences
  const recurringEventsByDate = new Map<string, Array<{ id: string; cat: string; amount: number }>>();

  for (const exp of recon.recurring_expenses) {
    if (stoppedEventIds.has(exp.event_id)) continue;
    let expAmt = exp.amount;
    if (reducedAmounts.has(exp.event_id)) {
      expAmt = reducedAmounts.get(exp.event_id)!;
    }

    const dom = exp.day_of_month;
    let currD = dom > dStart.getDate()
      ? new Date(dStart.getFullYear(), dStart.getMonth(), dom)
      : addMonths(new Date(dStart.getFullYear(), dStart.getMonth(), dom), 1);

    while (currD <= dEnd) {
      if (currD > dStart) {
        const dStr = formatDate(currD);
        if (!recurringEventsByDate.has(dStr)) {
          recurringEventsByDate.set(dStr, []);
        }
        recurringEventsByDate.get(dStr)!.push({ id: exp.event_id, cat: exp.category, amount: expAmt });
      }
      currD = addMonths(currD, 1);
    }
  }

  // Pre-calculate salary dates
  const salaryDates = new Set<string>();
  if (salaryAmt > 0) {
    let currSal = salaryDom > dStart.getDate()
      ? new Date(dStart.getFullYear(), dStart.getMonth(), salaryDom)
      : addMonths(new Date(dStart.getFullYear(), dStart.getMonth(), salaryDom), 1);

    while (currSal <= dEnd) {
      if (currSal > dStart) {
        salaryDates.add(formatDate(currSal));
      }
      currSal = addMonths(currSal, 1);
    }
  }

  let minHeadroom = 999999999;
  let isSafe = true;
  const trajectory: DailyForecastPoint[] = [];

  for (let i = 0; i <= 90; i++) {
    const dCurr = addDays(dStart, i);
    const dStr = formatDate(dCurr);
    const dailyEvents: string[] = [];

    if (futureIncByDate.has(dStr)) {
      const amtInc = futureIncByDate.get(dStr)!;
      currBal += amtInc;
      dailyEvents.push(`Confirmed income (+${amtInc.toLocaleString()})`);
    }

    if (salaryDates.has(dStr) && !futureIncByDate.has(dStr)) {
      currBal += salaryAmt;
      dailyEvents.push(`Salary (+${salaryAmt.toLocaleString()})`);
    }

    if (pendingByDate.has(dStr)) {
      const amtP = pendingByDate.get(dStr)!;
      currBal -= amtP;
      dailyEvents.push(`Pending payment (-${amtP.toLocaleString()})`);
    }

    if (recurringEventsByDate.has(dStr)) {
      for (const ev of recurringEventsByDate.get(dStr)!) {
        currBal -= ev.amount;
        dailyEvents.push(`${ev.cat} bill (-${ev.amount.toLocaleString()})`);
      }
    }

    if (pmtsByDate.has(dStr)) {
      const amtPlan = pmtsByDate.get(dStr)!;
      currBal -= amtPlan;
      dailyEvents.push(`Purchase payment (-${amtPlan.toLocaleString()})`);
    }

    const headroom = currBal - minBal;
    if (headroom < minHeadroom) {
      minHeadroom = headroom;
    }

    if (currBal < minBal) {
      isSafe = false;
    }

    trajectory.push({
      date: dStr,
      baseline_balance: Math.round(currBal * 100) / 100,
      plan_balance: Math.round(currBal * 100) / 100,
      minimum_balance: minBal,
      events: dailyEvents,
    });
  }

  return { isSafe, trajectory, minHeadroom };
}

export function calculateBaselineMetrics(
  recon: ReconstructedState,
  requestDateStr: string,
  requestedAmount: number
): { safeToday: number; earliestFullDate: string; baseTraj: DailyForecastPoint[] } {
  const { trajectory: baseTraj, minHeadroom } = run90DaySimulation(recon, requestDateStr, [], []);

  const dStart = parseDate(requestDateStr);
  const salaryDom = recon.salary_day_of_month;
  const nextPayday = salaryDom > dStart.getDate()
    ? new Date(dStart.getFullYear(), dStart.getMonth(), salaryDom)
    : addMonths(new Date(dStart.getFullYear(), dStart.getMonth(), salaryDom), 1);

  let headroomBeforePayday = 999999999;
  for (const pt of baseTraj) {
    const dPt = parseDate(pt.date);
    if (dPt <= nextPayday) {
      const h = pt.baseline_balance - pt.minimum_balance;
      if (h < headroomBeforePayday) {
        headroomBeforePayday = h;
      }
    }
  }

  if (headroomBeforePayday === 999999999) {
    headroomBeforePayday = minHeadroom;
  }

  const safeToday = Math.max(0, Math.min(requestedAmount, Math.round(headroomBeforePayday * 100) / 100));

  let earliestFullDate = '';
  for (let i = 0; i <= 90; i++) {
    const dTest = addDays(dStart, i);
    const dTestStr = formatDate(dTest);
    const pmt: PaymentItem[] = [{ date: dTestStr, amount: requestedAmount }];
    const { isSafe } = run90DaySimulation(recon, requestDateStr, pmt, []);
    if (isSafe) {
      earliestFullDate = dTestStr;
      break;
    }
  }

  if (earliestFullDate === requestDateStr && safeToday < requestedAmount) {
    earliestFullDate = '';
    for (let i = 1; i <= 90; i++) {
      const dTest = addDays(dStart, i);
      const dTestStr = formatDate(dTest);
      const pmt: PaymentItem[] = [{ date: dTestStr, amount: requestedAmount }];
      const { isSafe } = run90DaySimulation(recon, requestDateStr, pmt, []);
      if (isSafe) {
        earliestFullDate = dTestStr;
        break;
      }
    }
  }

  return { safeToday, earliestFullDate, baseTraj };
}

export function generateCandidatePlans(
  request: {
    requested_amount: number;
    request_date: string;
    desired_completion_date: string;
    allows_partial_payment: boolean;
  },
  profile: UserProfileData,
  recon: ReconstructedState,
  safeToday: number,
  earliestFullDate: string,
  options: PaymentOptionData[] = []
): CandidatePlan[] {
  const candidates: CandidatePlan[] = [];
  const methods = new Set(profile.payment_methods_user_will_consider);
  const homeCurr = profile.home_currency;

  // 1. Full payment today
  if (methods.has('full_payment')) {
    if (safeToday >= request.requested_amount) {
      const pmts = [{ date: request.request_date, amount: request.requested_amount }];
      candidates.push({
        status: 'affordable_now',
        method: 'full_payment',
        payments: pmts,
        payment_plan_str: `${request.request_date}:${request.requested_amount}`,
        earliest_date_for_full_payment: request.request_date,
        spending_changes: [],
        spending_changes_str: 'none',
        total_cost: request.requested_amount,
        first_payment_date: request.request_date,
        number_of_payments: 1,
        explanation: `Pay ${homeCurr} ${request.requested_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} today. This keeps your minimum balance protected throughout the next 90 days.`,
      });
    }
  }

  // 2. Installments from options
  if (methods.has('installments')) {
    const maxMonths = profile.max_installment_months || 36;
    for (const opt of options) {
      if (opt.number_of_payments > maxMonths) continue;

      const schedule: PaymentItem[] = [];
      const dFirst = parseDate(opt.first_payment_date);
      for (let i = 0; i < opt.number_of_payments; i++) {
        const dPmt = addDays(dFirst, i * opt.payment_frequency_days);
        schedule.push({ date: formatDate(dPmt), amount: opt.payment_amount });
      }

      const { isSafe } = run90DaySimulation(recon, request.request_date, schedule, []);
      if (isSafe) {
        const planStr = schedule.map(p => `${p.date}:${p.amount}`).join('|');
        candidates.push({
          status: 'affordable_with_plan',
          method: 'installments',
          payments: schedule,
          payment_plan_str: planStr,
          earliest_date_for_full_payment: schedule[0].date,
          spending_changes: [],
          spending_changes_str: 'none',
          total_cost: opt.total_cost || opt.payment_amount * opt.number_of_payments,
          first_payment_date: schedule[0].date,
          number_of_payments: opt.number_of_payments,
          payment_option_id: opt.payment_option_id,
          explanation: `Use ${opt.number_of_payments} installments of ${homeCurr} ${opt.payment_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}, starting ${schedule[0].date}.`,
        });
      }
    }
  }

  // 3. Partial payment (2 payments: safe amount today, remainder on earliestFullDate)
  if (methods.has('partial_payment') && request.allows_partial_payment && safeToday > 0) {
    const rem = request.requested_amount - safeToday;
    if (rem > 0 && earliestFullDate && earliestFullDate <= request.desired_completion_date) {
      const schedule: PaymentItem[] = [
        { date: request.request_date, amount: safeToday },
        { date: earliestFullDate, amount: rem },
      ];
      const { isSafe } = run90DaySimulation(recon, request.request_date, schedule, []);
      if (isSafe) {
        const planStr = `${request.request_date}:${safeToday}|${earliestFullDate}:${rem}`;
        candidates.push({
          status: 'affordable_with_plan',
          method: 'partial_payment',
          payments: schedule,
          payment_plan_str: planStr,
          earliest_date_for_full_payment: earliestFullDate,
          spending_changes: [],
          spending_changes_str: 'none',
          total_cost: request.requested_amount,
          first_payment_date: request.request_date,
          number_of_payments: 2,
          explanation: `Pay ${homeCurr} ${safeToday.toLocaleString(undefined, { minimumFractionDigits: 2 })} today and the remaining ${homeCurr} ${rem.toLocaleString(undefined, { minimumFractionDigits: 2 })} on ${earliestFullDate}.`,
        });
      }
    }
  }

  // 4. Affordable later (Wait until earliestFullDate)
  if (earliestFullDate && earliestFullDate <= request.desired_completion_date) {
    const pmts = [{ date: earliestFullDate, amount: request.requested_amount }];
    candidates.push({
      status: 'affordable_later',
      method: 'wait',
      payments: pmts,
      payment_plan_str: `${earliestFullDate}:${request.requested_amount}`,
      earliest_date_for_full_payment: earliestFullDate,
      spending_changes: [],
      spending_changes_str: 'none',
      total_cost: request.requested_amount,
      first_payment_date: earliestFullDate,
      number_of_payments: 1,
      explanation: `Pay ${homeCurr} ${request.requested_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} in full on ${earliestFullDate}. Paying earlier would take your balance below the minimum reserve.`,
    });
  }

  // 5. Fallback: Not affordable
  candidates.push({
    status: 'not_affordable',
    method: 'not_recommended',
    payments: [],
    payment_plan_str: 'none',
    earliest_date_for_full_payment: earliestFullDate || '',
    spending_changes: [],
    spending_changes_str: 'none',
    total_cost: 0,
    first_payment_date: '9999-99-99',
    number_of_payments: 0,
    explanation: `Do not make this payment by ${request.desired_completion_date}. None of the available options keeps your minimum balance protected.`,
  });

  return candidates;
}

export function rankCandidatePlans(candidates: CandidatePlan[], desiredCompletionDate: string): CandidatePlan {
  if (candidates.length === 0) {
    throw new Error('No candidate plans');
  }

  const statusRank: Record<string, number> = {
    affordable_now: 0,
    affordable_with_plan: 1,
    affordable_later: 2,
    not_affordable: 3,
  };

  const sorted = [...candidates].sort((a, b) => {
    const lastA = a.payments.length > 0 ? a.payments[a.payments.length - 1].date : '9999-99-99';
    const lastB = b.payments.length > 0 ? b.payments[b.payments.length - 1].date : '9999-99-99';

    const meetsA = (lastA <= desiredCompletionDate || a.method === 'not_recommended' || a.method === 'wait') ? 0 : 1;
    const meetsB = (lastB <= desiredCompletionDate || b.method === 'not_recommended' || b.method === 'wait') ? 0 : 1;
    if (meetsA !== meetsB) return meetsA - meetsB;

    const sA = statusRank[a.status] ?? 4;
    const sB = statusRank[b.status] ?? 4;
    if (sA !== sB) return sA - sB;

    if (a.spending_changes.length !== b.spending_changes.length) {
      return a.spending_changes.length - b.spending_changes.length;
    }

    if (a.total_cost !== b.total_cost) {
      return a.total_cost - b.total_cost;
    }

    if (a.first_payment_date !== b.first_payment_date) {
      return a.first_payment_date.localeCompare(b.first_payment_date);
    }

    return a.number_of_payments - b.number_of_payments;
  });

  return sorted[0];
}

export function buildDecisionAnalysis(
  request: {
    request_id: string;
    requested_amount: number;
    desired_completion_date: string;
    request_date: string;
  },
  safeToday: number,
  earliestFullDate: string,
  winningPlan: CandidatePlan,
  forecast: DailyForecastPoint[],
  recon: ReconstructedState
): DecisionAnalysis {
  const profile = recon.profile;

  const out: PredictionOutput = {
    request_id: request.request_id,
    amount_safe_to_pay: safeToday,
    affordability_status: winningPlan.status,
    recommended_payment_method: winningPlan.method,
    payment_plan: winningPlan.payment_plan_str,
    earliest_date_for_full_payment: winningPlan.earliest_date_for_full_payment,
    spending_changes_needed: winningPlan.spending_changes_str,
    decision_explanation: winningPlan.explanation,
  };

  const bills = recon.recurring_expenses.map(exp => ({
    event_id: exp.event_id,
    description: exp.description,
    category: exp.category,
    amount: exp.amount,
    day_of_month: exp.day_of_month,
    flexibility: exp.flexibility,
  }));

  const pendingList = recon.future_pending_debits.map(deb => ({
    event_id: deb.event_id,
    description: deb.description,
    amount: deb.amount,
    date: deb.date,
  }));

  const confirmedInc = recon.salary_amount > 0 ? [{
    type: 'Confirmed Salary',
    amount: recon.salary_amount,
    day_of_month: recon.salary_day_of_month,
  }] : [];

  const evidence: EvidenceBreakdown = {
    bills,
    pending_debits: pendingList,
    confirmed_income: confirmedInc,
    messages: [],
    images: [],
    unresolved: [],
  };

  return {
    output: out,
    requested_amount: request.requested_amount,
    desired_completion_date: request.desired_completion_date,
    user_id: profile.user_id,
    home_currency: profile.home_currency,
    current_available_balance: profile.current_available_balance,
    minimum_balance_to_keep: profile.minimum_balance_to_keep,
    forecast,
    evidence,
  };
}

export function processCustomRequest(
  req: {
    request_id: string;
    user_id: string;
    request_date: string;
    requested_amount: number;
    desired_completion_date: string;
    allows_partial_payment: boolean;
    request_text: string;
  },
  profile: UserProfileData,
  options: PaymentOptionData[],
  loader: DataLoader
): DecisionAnalysis {
  const recon = reconstructUserState(profile, loader.events, req.request_date);

  const { safeToday, earliestFullDate, baseTraj } = calculateBaselineMetrics(
    recon,
    req.request_date,
    req.requested_amount
  );

  const candidates = generateCandidatePlans(
    req,
    profile,
    recon,
    safeToday,
    earliestFullDate,
    options
  );

  const winningPlan = rankCandidatePlans(candidates, req.desired_completion_date);

  const { trajectory: planTraj } = run90DaySimulation(
    recon,
    req.request_date,
    winningPlan.payments,
    winningPlan.spending_changes
  );

  const finalTraj: DailyForecastPoint[] = [];
  for (let i = 0; i < baseTraj.length; i++) {
    finalTraj.push({
      date: baseTraj[i].date,
      baseline_balance: baseTraj[i].baseline_balance,
      plan_balance: i < planTraj.length ? planTraj[i].plan_balance : baseTraj[i].baseline_balance,
      minimum_balance: baseTraj[i].minimum_balance,
      events: i < planTraj.length && planTraj[i].events.length > 0 ? planTraj[i].events : baseTraj[i].events,
    });
  }

  return buildDecisionAnalysis(
    req,
    safeToday,
    earliestFullDate,
    winningPlan,
    finalTraj,
    recon
  );
}
