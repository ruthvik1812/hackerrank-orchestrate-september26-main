import React, { useState } from 'react';
import { Sliders, ShieldCheck, Tag, CreditCard, Save, CheckCircle2 } from 'lucide-react';
import type { UserProfile } from '../types';

interface PreferencesViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

const PAYMENT_METHODS = [
  { id: 'full_payment', label: 'Full Payment', desc: 'Pay total amount at once' },
  { id: 'partial_payment', label: 'Partial Payment', desc: 'Pay a portion now, rest later' },
  { id: 'installments', label: 'Installments', desc: 'Split into monthly payments' },
];

const CATEGORY_OPTIONS = [
  'rent', 'groceries', 'utilities', 'transport', 'healthcare',
  'insurance', 'education', 'childcare', 'dining', 'entertainment',
  'subscriptions', 'clothing', 'travel', 'fitness', 'personal_care',
];

function TagSelector({
  label,
  tags,
  selected,
  color,
  onToggle,
}: {
  label: string;
  tags: string[];
  selected: string[];
  color: string;
  onToggle: (tag: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-[#18241F] mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 capitalize ${
                active ? `${color} border-transparent` : 'bg-white text-[#5C6B64] border-[#E2E6D8] hover:border-[#173F35]/40'
              }`}
            >
              {tag.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const PreferencesView: React.FC<PreferencesViewProps> = ({ profile, onUpdateProfile }) => {
  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const toggle = (field: keyof UserProfile, value: string) => {
    const current = form[field] as string[];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setForm(prev => ({ ...prev, [field]: next }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[#18241F]">Preferences & Profile</h2>
        <p className="text-xs text-[#5C6B64] mt-1">
          Configure your financial guardrails. These drive all 90-day simulations and payment recommendations.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Balance Settings */}
        <div className="panel-card p-6 space-y-5">
          <h3 className="text-sm font-bold text-[#18241F] flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#173F35]" />
            Balance Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
                Current Available Balance ({form.home_currency})
              </label>
              <input
                type="number"
                step="any"
                value={form.current_available_balance}
                onChange={e => setForm(prev => ({ ...prev, current_available_balance: parseFloat(e.target.value) || 0 }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E6D8] bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm font-semibold text-[#18241F]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
                Minimum Reserve Balance ({form.home_currency})
              </label>
              <input
                type="number"
                step="any"
                value={form.minimum_balance_to_keep}
                onChange={e => setForm(prev => ({ ...prev, minimum_balance_to_keep: parseFloat(e.target.value) || 0 }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E6D8] bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm font-semibold text-[#18241F]"
              />
              <span className="text-[10px] text-[#5C6B64] mt-1 block">Balance will never drop below this amount</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
                Home Currency
              </label>
              <input
                type="text"
                maxLength={4}
                value={form.home_currency}
                onChange={e => setForm(prev => ({ ...prev, home_currency: e.target.value.toUpperCase() }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E6D8] bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm font-semibold text-[#18241F] uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
                Max Installment Months
              </label>
              <input
                type="number"
                min={1}
                max={36}
                value={form.max_installment_months ?? 6}
                onChange={e => setForm(prev => ({ ...prev, max_installment_months: parseInt(e.target.value) || 6 }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E6D8] bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm font-semibold text-[#18241F]"
              />
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="panel-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-[#18241F] flex items-center gap-2 uppercase tracking-wider">
            <CreditCard className="w-4 h-4 text-[#173F35]" />
            Accepted Payment Methods
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            {PAYMENT_METHODS.map(m => {
              const active = form.payment_methods_user_will_consider.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle('payment_methods_user_will_consider', m.id)}
                  className={`flex-1 p-4 rounded-xl border text-left transition-all duration-200 ${
                    active
                      ? 'bg-[#173F35] text-white border-[#173F35] shadow-sm'
                      : 'bg-white text-[#18241F] border-[#E2E6D8] hover:border-[#173F35]/50'
                  }`}
                >
                  <span className={`text-sm font-bold block ${active ? 'text-white' : 'text-[#18241F]'}`}>{m.label}</span>
                  <span className={`text-xs mt-0.5 block ${active ? 'text-emerald-200' : 'text-[#5C6B64]'}`}>{m.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expense Categories */}
        <div className="panel-card p-6 space-y-5">
          <h3 className="text-sm font-bold text-[#18241F] flex items-center gap-2 uppercase tracking-wider">
            <Tag className="w-4 h-4 text-[#173F35]" />
            Expense Category Rules
          </h3>

          <TagSelector
            label="🔒 Always Protect (never reduced or stopped)"
            tags={CATEGORY_OPTIONS}
            selected={form.expense_categories_to_protect}
            color="bg-[#173F35] text-white"
            onToggle={v => toggle('expense_categories_to_protect', v)}
          />

          <TagSelector
            label="⬇️ May Reduce temporarily"
            tags={CATEGORY_OPTIONS}
            selected={form.expense_categories_user_is_willing_to_reduce}
            color="bg-amber-100 text-amber-900 border border-amber-200"
            onToggle={v => toggle('expense_categories_user_is_willing_to_reduce', v)}
          />

          <TagSelector
            label="⛔ May Stop entirely"
            tags={CATEGORY_OPTIONS}
            selected={form.expense_categories_user_is_willing_to_stop}
            color="bg-rose-100 text-rose-900 border border-rose-200"
            onToggle={v => toggle('expense_categories_user_is_willing_to_stop', v)}
          />
        </div>

        {/* Financial Priorities */}
        <div className="panel-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-[#18241F] flex items-center gap-2 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-[#173F35]" />
            Financial Priorities
          </h3>
          <TagSelector
            label="Goals (ordered by click sequence)"
            tags={['essential_expenses', 'savings', 'investments', 'debt_repayment', 'discretionary', 'emergency_fund']}
            selected={form.financial_priorities}
            color="bg-[#DDF3A0] text-[#18241F] border border-[#DDF3A0]"
            onToggle={v => toggle('financial_priorities', v)}
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            id="save-preferences-btn"
            className="btn-primary px-8 py-3 flex items-center gap-2 text-sm shadow-sm"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#DDF3A0]" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#DDF3A0]" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
          {saved && (
            <p className="text-xs text-[#173F35] font-medium animate-pulse">
              ✓ Preferences applied — next analysis will use these settings
            </p>
          )}
        </div>
      </form>
    </div>
  );
};
