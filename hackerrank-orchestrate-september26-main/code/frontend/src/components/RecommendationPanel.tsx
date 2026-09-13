import React from 'react';
import { CheckCircle2, Clock, XCircle, Calendar, ShieldCheck, DollarSign, Scissors } from 'lucide-react';
import type { DecisionAnalysis } from '../types';

interface RecommendationPanelProps {
  analysis: DecisionAnalysis;
}

export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({ analysis }) => {
  const { output, home_currency, requested_amount } = analysis;

  const getStatusBadge = () => {
    switch (output.affordability_status) {
      case 'affordable_now':
        return {
          title: 'You can buy now',
          color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600',
          accentBg: 'bg-emerald-600'
        };
      case 'affordable_with_plan':
        return {
          title: 'Use a payment plan',
          color: 'bg-amber-50 text-amber-900 border-amber-200',
          icon: Clock,
          iconColor: 'text-amber-600',
          accentBg: 'bg-amber-600'
        };
      case 'affordable_later':
        return {
          title: `Wait until ${output.earliest_date_for_full_payment || output.payment_plan.split(':')[0]}`,
          color: 'bg-blue-50 text-blue-900 border-blue-200',
          icon: Calendar,
          iconColor: 'text-blue-600',
          accentBg: 'bg-blue-600'
        };
      case 'not_affordable':
      default:
        return {
          title: "This purchase doesn't fit safely",
          color: 'bg-rose-50 text-rose-900 border-rose-200',
          icon: XCircle,
          iconColor: 'text-rose-600',
          accentBg: 'bg-rose-600'
        };
    }
  };

  const badge = getStatusBadge();
  const Icon = badge.icon;

  // Parse payment plan dates & amounts
  const parsePlanItems = () => {
    if (!output.payment_plan || output.payment_plan === 'none') return [];
    return output.payment_plan.split('|').map(item => {
      const parts = item.split(':');
      return {
        date: parts[0],
        amount: parseFloat(parts[1]) || 0
      };
    });
  };

  const planItems = parsePlanItems();
  const totalPlanAmount = planItems.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      {/* Prominent Recommendation Banner */}
      <div className={`p-6 rounded-2xl border ${badge.color} shadow-sm transition-all duration-300`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-xs`}>
            <Icon className={`w-7 h-7 ${badge.iconColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/80 border border-current">
                {output.affordability_status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-semibold text-muted">
                Request #{output.request_id}
              </span>
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight mb-2">
              {badge.title}
            </h3>
            <p className="text-sm font-medium leading-relaxed opacity-90">
              {output.decision_explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Safe Amount Today */}
        <div className="panel-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <DollarSign className="w-4 h-4 text-[#173F35]" />
            <span>Safe Amount Today</span>
          </div>
          <div className="text-2xl font-bold text-[#18241F]">
            {home_currency} {output.amount_safe_to_pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-muted mt-1 block">
            Of {home_currency} {requested_amount.toLocaleString()} requested
          </span>
        </div>

        {/* Recommended Payment Method */}
        <div className="panel-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4 text-[#173F35]" />
            <span>Recommended Method</span>
          </div>
          <div className="text-xl font-bold text-[#18241F] capitalize">
            {output.recommended_payment_method.replace(/_/g, ' ')}
          </div>
          <span className="text-xs text-muted mt-1 block">
            Safest path for 90-day protection
          </span>
        </div>

        {/* Earliest Safe Full Date */}
        <div className="panel-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <Calendar className="w-4 h-4 text-[#173F35]" />
            <span>Earliest Safe Full Payment</span>
          </div>
          <div className="text-xl font-bold text-[#18241F]">
            {output.earliest_date_for_full_payment || 'N/A'}
          </div>
          <span className="text-xs text-muted mt-1 block">
            Independent of payment preferences
          </span>
        </div>
      </div>

      {/* Payment Timeline */}
      {planItems.length > 0 && (
        <div className="panel-card p-6">
          <h4 className="text-sm font-bold text-[#18241F] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#173F35]" />
            <span>Payment Schedule Timeline</span>
          </h4>

          <div className="space-y-3">
            {planItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8F2] border border-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#173F35] text-white flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Payment #{idx + 1}</span>
                    <span className="text-sm font-semibold text-[#18241F]">{item.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-[#173F35]">
                    {home_currency} {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-subtle flex items-center justify-between text-xs font-semibold text-muted">
            <span>Total Schedule Cost:</span>
            <span className="text-sm font-bold text-[#18241F]">
              {home_currency} {totalPlanAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Spending Changes Needed */}
      {output.spending_changes_needed && output.spending_changes_needed !== 'none' && (
        <div className="panel-card p-5 border-amber-200 bg-amber-50/30">
          <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-600" />
            <span>Required Spending Adjustments</span>
          </h4>
          <div className="flex flex-wrap gap-2 mt-2">
            {output.spending_changes_needed.split('|').map((change, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200">
                {change}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
