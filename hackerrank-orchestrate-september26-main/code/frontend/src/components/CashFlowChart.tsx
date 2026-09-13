import React, { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid, Legend
} from 'recharts';
import { LineChart as ChartIcon, Table as TableIcon } from 'lucide-react';
import type { DailyForecastPoint } from '../types';

interface CashFlowChartProps {
  forecast: DailyForecastPoint[];
  minimumBalance: number;
  homeCurrency: string;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({
  forecast,
  minimumBalance,
  homeCurrency
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  // Format data for Recharts (subsample every 3rd day if 90 points for cleaner axis)
  const chartData = forecast.map((pt) => ({
    date: pt.date.slice(5), // MM-DD
    fullDate: pt.date,
    Baseline: pt.baseline_balance,
    Plan: pt.plan_balance,
    Minimum: pt.minimum_balance,
    events: pt.events
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#18241F] text-white p-3 rounded-xl shadow-lg border border-emerald-800 text-xs space-y-1.5 max-w-xs">
          <p className="font-bold text-[#DDF3A0]">{data.fullDate}</p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-300">Baseline Balance:</span>
            <span className="font-semibold">{homeCurrency} {data.Baseline.toLocaleString()}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span className="text-gray-300">Plan Balance:</span>
            <span className="font-semibold text-[#DDF3A0]">{homeCurrency} {data.Plan.toLocaleString()}</span>
          </p>
          <p className="flex justify-between gap-4 border-t border-gray-700 pt-1">
            <span className="text-[#DDF3A0]">Min Balance to Keep:</span>
            <span>{homeCurrency} {data.Minimum.toLocaleString()}</span>
          </p>
          {data.events && data.events.length > 0 && (
            <div className="mt-1.5 pt-1 border-t border-gray-700">
              <span className="text-[10px] uppercase font-bold text-emerald-300">Cash Flow Events:</span>
              <ul className="list-disc list-inside text-[11px] text-gray-200 mt-0.5 space-y-0.5">
                {data.events.map((ev: string, idx: number) => (
                  <li key={idx}>{ev}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#18241F]">90-Day Cash-Flow Forecast</h3>
          <p className="text-xs text-muted">Simulated daily liquidity trajectory maintaining minimum required balance.</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#F7F8F2] p-1 rounded-xl border border-subtle">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'chart' ? 'bg-[#173F35] text-white' : 'text-muted hover:text-[#18241F]'
            }`}
          >
            <ChartIcon className="w-3.5 h-3.5" />
            <span>Chart</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              viewMode === 'table' ? 'bg-[#173F35] text-white' : 'text-muted hover:text-[#18241F]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E6D8" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5C6B64' }} interval={6} />
              <YAxis tick={{ fontSize: 11, fill: '#5C6B64' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              
              <ReferenceLine
                y={minimumBalance}
                label={{ value: `Min Balance (${homeCurrency} ${minimumBalance.toLocaleString()})`, fill: '#e11d48', fontSize: 11, position: 'insideTopLeft' }}
                stroke="#e11d48"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              
              <Line
                type="monotone"
                dataKey="Baseline"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={false}
                name="Balance Before Purchase"
              />
              
              <Line
                type="monotone"
                dataKey="Plan"
                stroke="#173F35"
                strokeWidth={3}
                dot={false}
                name="Balance With Recommended Plan"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto border border-subtle rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8F2] text-[#18241F] sticky top-0 font-semibold border-b border-subtle">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Baseline ({homeCurrency})</th>
                <th className="py-2.5 px-4">Plan Balance ({homeCurrency})</th>
                <th className="py-2.5 px-4">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-[#18241F]">
              {forecast.map((pt, idx) => (
                <tr key={idx} className={pt.plan_balance < minimumBalance ? 'bg-rose-50' : 'hover:bg-gray-50'}>
                  <td className="py-2 px-4 font-mono font-medium">{pt.date}</td>
                  <td className="py-2 px-4">{pt.baseline_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 px-4 font-semibold text-[#173F35]">{pt.plan_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 px-4 text-muted">{pt.events.join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
