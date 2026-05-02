import React, { useState, useEffect } from 'react';

export default function CanaryView(props) {
  const { canaryState, isHeadAdmin, handleAdvanceCanaryPhase, handleRollbackCanaryPhase, handleUpdateCanaryConfig } = props;

  const formatPhaseLabel = (phase) => {
    switch(phase) {
      case 'HEAD_ADMIN_ONLY': return 'Head Admin Only';
      case 'ADMIN_ONLY': return 'Admins Only';
      case 'SENSOR_CANARY': return 'Partial Sensor Testing';
      case 'EVERYONE': return 'Full Public Release';
      default: return (phase || '').replaceAll('_', ' ');
    }
  };

  const phaseLabel = formatPhaseLabel(canaryState?.phase);

  const [config, setConfig] = useState({
      enabled: false,
      percentage: 0,
      allowlist: ''
  });

  useEffect(() => {
      if (canaryState) {
          setConfig({
              enabled: canaryState.enabled || false,
              percentage: canaryState.sensorCanaryPercentage || 0,
              allowlist: canaryState.sensorAllowlist || ''
          });
      }
  }, [canaryState]);

  const handleSaveConfig = () => {
      handleUpdateCanaryConfig(config);
  };



  return (
    <div className="animate-fade-in max-w-4xl">
      <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-10">System Update Testing</h1>

      <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-lg mb-6">
        <h3 className="text-lg font-bold text-sky-100 mb-4">Current Testing Phase</h3>
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
            <p className="text-slate-400 uppercase text-xs">Testing Group Size (%)</p>
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
            View-only mode: only HEAD_ADMIN can advance or rollback testing phases.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3 mb-8">
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

        {isHeadAdmin && (
          <div className="mt-8 border-t border-slate-700 pt-6">
            <h3 className="text-lg font-bold text-sky-100 mb-4">Configuration Settings</h3>
            
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between bg-[#0f172a] p-4 rounded-lg border border-slate-700">
                <div>
                  <p className="font-bold text-white">Enable System Update Testing</p>
                  <p className="text-xs text-slate-400">Master switch to enable the testing framework</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={config.enabled} onChange={(e) => setConfig({...config, enabled: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>

              <div className="bg-[#0f172a] p-4 rounded-lg border border-slate-700">
                <div className="flex justify-between mb-2">
                  <p className="font-bold text-white">Testing Group Size (%)</p>
                  <span className="text-teal-400 font-black">{config.percentage}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={config.percentage} 
                  onChange={(e) => setConfig({...config, percentage: parseInt(e.target.value)})}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <p className="text-xs text-slate-400 mt-2">Percentage of sensors automatically included in the Partial Sensor Testing phase</p>
              </div>

              <div className="bg-[#0f172a] p-4 rounded-lg border border-slate-700">
                <p className="font-bold text-white mb-2">Specific Sensors to Test</p>
                <input 
                  type="text" 
                  value={config.allowlist} 
                  onChange={(e) => setConfig({...config, allowlist: e.target.value})}
                  placeholder="e.g. sensor-01, sensor-02"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg p-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-slate-400 mt-2">Comma-separated list of exact sensor IDs to ALWAYS include in the test</p>
              </div>

              <button 
                onClick={handleSaveConfig}
                className="w-full mt-4 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
