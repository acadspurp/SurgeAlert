import React from 'react';

export default function CanaryView(props) {
  const { canaryState, isHeadAdmin, handleAdvanceCanaryPhase, handleRollbackCanaryPhase } = props;

  const phaseLabel = (canaryState?.phase || '').replaceAll('_', ' ');

  return (
    <div className="animate-fade-in max-w-4xl">
      <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">Manual Canary Rollout</h1>

      <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-lg mb-6">
        <h3 className="text-lg font-bold text-sky-100 mb-4">Current Rollout State</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 uppercase text-xs">Phase</p>
            <p className="text-xl font-black text-cyan-300 mt-1">{phaseLabel || 'N/A'}</p>
          </div>
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 uppercase text-xs">Enabled</p>
            <p className={`text-xl font-black mt-1 ${canaryState?.enabled ? 'text-green-400' : 'text-slate-300'}`}>
              {String(!!canaryState?.enabled).toUpperCase()}
            </p>
          </div>
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 uppercase text-xs">Sensor Canary %</p>
            <p className="text-xl font-black text-amber-300 mt-1">{canaryState?.sensorCanaryPercentage ?? 0}%</p>
          </div>
          <div className="bg-[#0f172a] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 uppercase text-xs">Last Updated</p>
            <p className="text-sm font-bold text-slate-200 mt-2">
              {canaryState?.phaseUpdatedAt ? new Date(canaryState.phaseUpdatedAt).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-lg">
        <h3 className="text-lg font-bold text-sky-100 mb-4">Manual Controls</h3>
        {!isHeadAdmin ? (
          <p className="text-slate-300 text-sm">
            View-only mode: only HEAD_ADMIN can advance or rollback rollout phases.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAdvanceCanaryPhase}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
            >
              Advance Phase
            </button>
            <button
              onClick={handleRollbackCanaryPhase}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
            >
              Rollback Phase
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
