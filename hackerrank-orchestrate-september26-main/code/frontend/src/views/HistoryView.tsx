import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { DecisionAnalysis } from '../types';
import { RecommendationPanel } from '../components/RecommendationPanel';
import { CashFlowChart } from '../components/CashFlowChart';
import { EvidencePanel } from '../components/EvidencePanel';

interface HistoryViewProps {
  analyses: DecisionAnalysis[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ analyses }) => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<DecisionAnalysis | null>(
    analyses.length > 0 ? analyses[0] : null
  );
  const [filterText, setFilterText] = useState('');

  const filteredAnalyses = analyses.filter(item =>
    item.output.request_id.toLowerCase().includes(filterText.toLowerCase()) ||
    item.output.decision_explanation.toLowerCase().includes(filterText.toLowerCase()) ||
    item.output.affordability_status.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#18241F]">Decision History</h2>
          <p className="text-xs text-muted">Complete historical analysis records across all dataset requests.</p>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search request ID or status..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-subtle bg-white text-xs text-[#18241F]"
          />
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Decision Cards List */}
        <div className="lg:col-span-5 space-y-3 max-h-[800px] overflow-y-auto pr-1">
          {filteredAnalyses.map((item, idx) => {
            const isSelected = selectedAnalysis?.output.request_id === item.output.request_id;
            return (
              <div
                key={idx}
                onClick={() => setSelectedAnalysis(item)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#173F35] text-white border-[#173F35] shadow-sm'
                    : 'bg-white text-[#18241F] border-subtle hover:border-[#173F35]/50 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold font-mono ${isSelected ? 'text-[#DDF3A0]' : 'text-[#173F35]'}`}>
                    #{item.output.request_id}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.output.affordability_status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-lg font-bold mb-1">
                  {item.home_currency} {item.requested_amount.toLocaleString()}
                </div>

                <p className={`text-xs line-clamp-2 ${isSelected ? 'text-emerald-100' : 'text-muted'}`}>
                  {item.output.decision_explanation}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Full Selected Analysis */}
        <div className="lg:col-span-7 space-y-6">
          {selectedAnalysis ? (
            <>
              <RecommendationPanel analysis={selectedAnalysis} />
              <CashFlowChart
                forecast={selectedAnalysis.forecast}
                minimumBalance={selectedAnalysis.minimum_balance_to_keep}
                homeCurrency={selectedAnalysis.home_currency}
              />
              <EvidencePanel
                evidence={selectedAnalysis.evidence}
                homeCurrency={selectedAnalysis.home_currency}
              />
            </>
          ) : (
            <div className="panel-card p-12 text-center text-muted">
              Select a decision from the list to view complete 90-day trajectory and evidence breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
