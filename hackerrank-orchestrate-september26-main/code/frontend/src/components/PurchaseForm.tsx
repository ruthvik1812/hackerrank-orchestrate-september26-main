import React, { useState } from 'react';
import { ShoppingBag, Calendar, DollarSign, ChevronDown, ChevronUp, Image as ImageIcon, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import type { UserProfile } from '../types';

interface PurchaseFormProps {
  profile: UserProfile;
  onSubmit: (formData: any) => void;
  isLoading: boolean;
  progressStep: string;
}

export const PurchaseForm: React.FC<PurchaseFormProps> = ({
  profile,
  onSubmit,
  isLoading,
  progressStep
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [completionDate, setCompletionDate] = useState('2026-10-15');
  const [allowsPartial, setAllowsPartial] = useState(true);
  const [supportingMessage, setSupportingMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Preference overrides
  const [selectedMethods, setSelectedMethods] = useState<string[]>(
    profile.payment_methods_user_will_consider.length > 0
      ? profile.payment_methods_user_will_consider
      : ['full_payment', 'partial_payment', 'installments']
  );
  const [minBalanceOverride, setMinBalanceOverride] = useState<number>(profile.minimum_balance_to_keep);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleMethodToggle = (method: string) => {
    if (selectedMethods.includes(method)) {
      if (selectedMethods.length > 1) {
        setSelectedMethods(selectedMethods.filter(m => m !== method));
      }
    } else {
      setSelectedMethods([...selectedMethods, method]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    onSubmit({
      user_id: profile.user_id,
      request_text: description,
      requested_amount: parseFloat(amount),
      request_date: new Date().toISOString().split('T')[0],
      desired_completion_date: completionDate,
      allows_partial_payment: allowsPartial,
      payment_methods_override: selectedMethods,
      minimum_balance_override: minBalanceOverride,
      supporting_message: supportingMessage
    });
  };

  return (
    <div className="panel-card p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#173F35] flex items-center justify-center">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#18241F]">What are you planning to buy?</h2>
          <p className="text-xs text-muted">Test your purchase against 90-day essential spending and income commitments.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
            Purchase Description
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Work Laptop, Rental Deposit, Course Enrollment..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-subtle bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm text-[#18241F]"
          />
        </div>

        {/* Amount & Date Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
              Amount ({profile.home_currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-subtle bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm font-semibold text-[#18241F]"
              />
              <DollarSign className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider">
              Desired Completion Date
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-subtle bg-[#F7F8F2]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#173F35] text-sm text-[#18241F]"
              />
              <Calendar className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
            </div>
          </div>
        </div>

        {/* Partial Payment Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#F7F8F2] border border-subtle">
          <div>
            <span className="text-sm font-medium text-[#18241F] block">Allow Partial Payment</span>
            <span className="text-xs text-muted">Permit paying part today and the remainder later</span>
          </div>
          <button
            type="button"
            onClick={() => setAllowsPartial(!allowsPartial)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
              allowsPartial ? 'bg-[#173F35]' : 'bg-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              allowsPartial ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Expandable Preferences */}
        <div className="border border-subtle rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-3 flex items-center justify-between bg-white text-xs font-semibold text-[#18241F] uppercase tracking-wider"
          >
            <span>Payment Preferences & Minimum Balance</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="p-4 bg-[#F7F8F2]/50 border-t border-subtle space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#18241F] mb-2 uppercase tracking-wider">
                  Considered Payment Methods
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'full_payment', label: 'Full Payment' },
                    { id: 'partial_payment', label: 'Partial Payment' },
                    { id: 'installments', label: 'Installments' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleMethodToggle(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedMethods.includes(m.id)
                          ? 'bg-[#173F35] text-white border-[#173F35]'
                          : 'bg-white text-[#18241F] border-subtle'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#18241F] mb-1 uppercase tracking-wider">
                  Minimum Protected Balance ({profile.home_currency})
                </label>
                <input
                  type="number"
                  value={minBalanceOverride}
                  onChange={(e) => setMinBalanceOverride(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-subtle bg-white text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Supporting Evidence (Message & Image Upload) */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#173F35]" />
              <span>Supporting Notes / Messages (Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Salary confirmed on 15th, bonus postponed..."
              value={supportingMessage}
              onChange={(e) => setSupportingMessage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-subtle bg-[#F7F8F2]/60 focus:bg-white text-xs text-[#18241F]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18241F] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#173F35]" />
              <span>Upload Bill / Receipt / Evidence (Optional)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-xs text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#173F35] file:text-white hover:file:bg-[#1f5246]"
            />
            {imagePreview && (
              <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-subtle">
                <img src={imagePreview} alt="Evidence Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary py-3.5 px-6 flex items-center justify-center gap-2 text-base shadow-sm mt-4 disabled:opacity-75"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#DDF3A0]" />
              <span>{progressStep || 'Evaluating Affordability...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-[#DDF3A0]" />
              <span>Check Affordability</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
