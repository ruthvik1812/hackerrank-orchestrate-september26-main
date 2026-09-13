import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './views/OverviewView';
import { HistoryView } from './views/HistoryView';
import { PreferencesView } from './views/PreferencesView';
import type { UserProfile, DecisionAnalysis, NavTab } from './types';

const API_BASE = '';

const MOCK_PROFILE: UserProfile = {
  user_id: 'user_01',
  home_currency: 'SGD',
  current_available_balance: 12400,
  minimum_balance_to_keep: 2000,
  financial_priorities: ['essential_expenses', 'savings'],
  expense_categories_to_protect: ['rent', 'groceries', 'utilities', 'transport'],
  expense_categories_user_is_willing_to_reduce: ['dining', 'entertainment'],
  expense_categories_user_is_willing_to_stop: ['subscriptions'],
  payment_methods_user_will_consider: ['full_payment', 'partial_payment', 'installments'],
  max_installment_months: 6,
};

const PROGRESS_STEPS = [
  'Loading your financial profile…',
  'Extracting bills and income signals…',
  'Running 90-day cash-flow simulation…',
  'Generating payment plan candidates…',
  'Ranking plans by safety score…',
  'Preparing your recommendation…',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [analyses, setAnalyses] = useState<DecisionAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<DecisionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load profile from API on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/profiles`)
      .then(r => r.json())
      .then((profiles: UserProfile[]) => {
        if (profiles && profiles.length > 0) {
          setAllProfiles(profiles);
          setProfile(profiles[0]);
        }
      })
      .catch((err) => {
        console.warn('Using default profile:', err);
      });
  }, []);

  // Load historical analyses on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/requests`)
      .then(r => r.json())
      .then((data: DecisionAnalysis[]) => {
        if (Array.isArray(data)) {
          setAnalyses(data);
          if (data.length > 0) setCurrentAnalysis(data[0]);
        }
      })
      .catch((err) => {
        console.warn('Could not load historical requests:', err);
      });
  }, []);

  const handleSelectProfile = useCallback((profileId: string) => {
    const found = allProfiles.find(p => p.user_id === profileId);
    if (found) {
      setProfile(found);
      // Filter or update current analysis if matching
      const userAnalyses = analyses.filter(a => a.user_id === profileId);
      if (userAnalyses.length > 0) {
        setCurrentAnalysis(userAnalyses[0]);
      }
    }
  }, [allProfiles, analyses]);

  const handleCheckAffordability = useCallback(async (formData: Record<string, unknown>) => {
    setIsLoading(true);
    setProgressStep(PROGRESS_STEPS[0]);
    setErrorMessage(null);

    // Simulate progress steps for UX
    let stepIdx = 1;
    const interval = setInterval(() => {
      if (stepIdx < PROGRESS_STEPS.length) {
        setProgressStep(PROGRESS_STEPS[stepIdx]);
        stepIdx++;
      }
    }, 400);

    try {
      const res = await fetch(`${API_BASE}/api/check-affordability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const analysis: DecisionAnalysis = await res.json();

      setCurrentAnalysis(analysis);
      setAnalyses(prev => [analysis, ...prev.slice(0, 49)]);
      setActiveTab('overview');
    } catch (err: any) {
      console.error('Affordability check failed:', err);
      setErrorMessage(err?.message || 'Could not complete the affordability check.');
    } finally {
      clearInterval(interval);
      setIsLoading(false);
      setProgressStep('');
    }
  }, []);

  const handleSelectAnalysis = useCallback((analysis: DecisionAnalysis) => {
    setCurrentAnalysis(analysis);
    setActiveTab('overview');
  }, []);

  const handleUpdateProfile = useCallback((updated: UserProfile) => {
    setProfile(updated);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8F2] flex flex-col md:flex-row" id="app-root">

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-5 py-3 bg-[#173F35] text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#DDF3A0] flex items-center justify-center">
            <svg className="w-4 h-4 text-[#173F35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight">Buy or Wait?</span>
        </div>
        <button
          id="mobile-nav-toggle"
          aria-label="Toggle navigation"
          onClick={() => setIsMobileNavOpen(v => !v)}
          className="p-2 rounded-lg hover:bg-[#1f5246] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            {isMobileNavOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </header>

      {/* Sidebar (desktop always visible; mobile conditionally shown) */}
      <div className={`${isMobileNavOpen ? 'block' : 'hidden'} md:block md:w-64 md:shrink-0`}>
        <div onClick={() => setIsMobileNavOpen(false)}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            homeCurrency={profile.home_currency}
            availableBalance={profile.current_available_balance}
            profiles={allProfiles}
            currentProfileId={profile.user_id}
            onSelectProfile={handleSelectProfile}
          />
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 min-w-0 px-5 py-7 md:px-8 md:py-8 overflow-auto" id="main-content">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-xs font-bold underline ml-4">
              Dismiss
            </button>
          </div>
        )}
        {activeTab === 'overview' && (
          <OverviewView
            profile={profile}
            recentAnalyses={analyses}
            currentAnalysis={currentAnalysis}
            onCheckAffordability={handleCheckAffordability}
            isLoading={isLoading}
            progressStep={progressStep}
            onSelectAnalysis={handleSelectAnalysis}
          />
        )}

        {activeTab === 'check' && (
          <OverviewView
            profile={profile}
            recentAnalyses={[]}
            currentAnalysis={null}
            onCheckAffordability={handleCheckAffordability}
            isLoading={isLoading}
            progressStep={progressStep}
            onSelectAnalysis={handleSelectAnalysis}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView analyses={analyses} />
        )}

        {activeTab === 'preferences' && (
          <PreferencesView profile={profile} onUpdateProfile={handleUpdateProfile} />
        )}
      </main>
    </div>
  );
}
