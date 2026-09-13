import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import type { EvidenceBreakdown } from '../types';

interface EvidencePanelProps {
  evidence: EvidenceBreakdown;
  homeCurrency: string;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ evidence, homeCurrency }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="panel-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between bg-white text-left font-bold text-base text-[#18241F] hover:bg-gray-50/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#173F35] flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span>What We Considered</span>
            <span className="text-xs text-muted block font-normal">Extracted evidence, recurring commitments & unconfirmed items</span>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
      </button>

      {isOpen && (
        <div className="p-6 bg-[#F7F8F2]/40 border-t border-subtle space-y-6 text-xs">
          {/* Unresolved / Excluded Warning Callouts */}
          {evidence.unresolved && evidence.unresolved.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Unresolved Evidence / Excluded Items</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1">
                {evidence.unresolved.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recurring Bills & Commitments */}
            <div className="space-y-3">
              <h4 className="font-bold text-[#18241F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#173F35]" />
                <span>Recurring Bills & Expenses ({evidence.bills.length})</span>
              </h4>
              <div className="space-y-2">
                {evidence.bills.map((bill, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white border border-subtle flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#18241F] block">{bill.description}</span>
                      <span className="text-[11px] text-muted">Category: {bill.category} | Day {bill.day_of_month}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#18241F]">{homeCurrency} {bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="text-[10px] uppercase block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold mt-0.5">
                        {bill.flexibility}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Debits & Income */}
            <div className="space-y-6">
              {/* Confirmed Income */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#18241F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Confirmed Future Income</span>
                </h4>
                {evidence.confirmed_income.length > 0 ? (
                  evidence.confirmed_income.map((inc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-emerald-900 block">{inc.type}</span>
                        <span className="text-[11px] text-emerald-700">Scheduled on day {inc.day_of_month} of month</span>
                      </div>
                      <span className="font-bold text-emerald-800 text-sm">
                        +{homeCurrency} {inc.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted italic">No extra salary confirmed.</p>
                )}
              </div>

              {/* Pending Debits */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#18241F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pending Reserved Debits ({evidence.pending_debits.length})</span>
                </h4>
                {evidence.pending_debits.map((deb, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white border border-subtle flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#18241F] block">{deb.description}</span>
                      <span className="text-[11px] text-muted">Due date: {deb.date}</span>
                    </div>
                    <span className="font-bold text-rose-700">
                      -{homeCurrency} {deb.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
