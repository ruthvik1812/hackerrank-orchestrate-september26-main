import React from 'react';
import { DollarSign, Shield, ArrowRight, Sparkles } from 'lucide-react';
import type { UserProfile, DecisionAnalysis } from '../types';
import { PurchaseForm } from '../components/PurchaseForm';
import { RecommendationPanel } from '../components/RecommendationPanel';
import { CashFlowChart } from '../components/CashFlowChart';
import { EvidencePanel } from '../components/EvidencePanel';

interface OverviewViewProps {
  profile: UserProfile;
  recentAnalyses: DecisionAnalysis[];
  currentAnalysis: DecisionAnalysis | null;
  onCheckAffordability: (formData: any) => void;
  isLoading: boolean;
  progressStep: string;
  onSelectAnalysis: (analysis: DecisionAnalysis) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  profile,
  recentAnalyses,
  currentAnalysis,
  onCheckAffordability,
  isLoading,
  progressStep,
  onSelectAnalysis
}) => {
  return (
    <div className="space-y-8">
      {/* Overview Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Available Balance */}
        <div className="panel-card p-6 border-emerald-200/80 bg-gradient-to-br from-white to-[#F7F8F2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Available Balance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#173F35] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#18241F]">
            {profile.home_currency} {profile.current_available_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-emerald-700 font-medium mt-2 block">
            Current liquid balance as of today
          </span>
        </div>

        {/* Minimum Balance to Keep */}
        <div className="panel-card p-6 border-amber-200/80 bg-gradient-to-br from-white to-[#F7F8F2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Minimum Reserved Balance</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#18241F]">
            {profile.home_currency} {profile.minimum_balance_to_keep.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-amber-800 font-medium mt-2 block">
            Protected threshold (never breached)
          </span>
        </div>

        {/* Protected Categories */}
        <div className="panel-card p-6 bg-gradient-to-br from-white to-[#F7F8F2]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Protected Categories</span>
            <div className="w-8 h-8 rounded-lg bg-[#DDF3A0] text-[#18241F] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {profile.expense_categories_to_protect.map((cat, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-lg bg-[#173F35] text-white text-xs font-medium">
                {cat}
              </span>
            ))}
          </div>
          <span className="text-xs text-muted mt-3 block">
            Will never be stopped or reduced
          </span>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Purchase Check Form */}
        <div className="lg:col-span-5 space-y-6">
          <PurchaseForm
            profile={profile}
            onSubmit={onCheckAffordability}
            isLoading={isLoading}
            progressStep={progressStep}
          />

          {/* Recent Decisions Card */}
          <div className="panel-card p-6">
            <h3 className="text-sm font-bold text-[#18241F] uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Recent Decision Checks</span>
              <span className="text-xs text-muted font-normal">Click to view complete analysis</span>
            </h3>

            <div className="space-y-3">
              {recentAnalyses.slice(0, 4).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectAnalysis(item)}
                  className="w-full text-left p-3.5 rounded-xl border border-subtle hover:border-[#173F35] bg-[#F7F8F2]/60 hover:bg-white transition-all group flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-sm text-[#18241F] group-hover:text-[#173F35] block">
                      Request #{item.output.request_id}
                    </span>
                    <span className="text-xs text-muted">
                      {profile.home_currency} {item.requested_amount.toLocaleString()} | {item.output.affordability_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-[#173F35] transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recommendation, Forecast & Evidence */}
        <div className="lg:col-span-7 space-y-6">
          {currentAnalysis ? (
            <>
              <RecommendationPanel analysis={currentAnalysis} />
              <CashFlowChart
                forecast={currentAnalysis.forecast}
                minimumBalance={currentAnalysis.minimum_balance_to_keep}
                homeCurrency={currentAnalysis.home_currency}
              />
              <EvidencePanel
                evidence={currentAnalysis.evidence}
                homeCurrency={currentAnalysis.home_currency}
              />
            </>
          ) : (
            <div className="panel-card p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#173F35] flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#18241F]">Ready to Check Affordability</h3>
              <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                Enter your purchase details on the left to generate a personalized 90-day cash-flow simulation, exact payment timeline, and evidence report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
