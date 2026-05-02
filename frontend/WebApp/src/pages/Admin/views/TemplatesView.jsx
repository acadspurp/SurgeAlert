import React, { useState } from 'react';

export default function TemplatesView(props) {
  const { 
    templates, 
    editingTemplateType, 
    templateDrafts, 
    setTemplateDrafts, 
    saveEditedTemplate,
    beginEditTemplate, 
    cancelEditTemplate 
  } = props;

  const [showModal, setShowModal] = useState(false);
  const [activeType, setActiveType] = useState(null);

  const handleOpenEdit = (type, currentText) => {
    setActiveType(type);
    beginEditTemplate(type, currentText);
    setShowModal(true);
  };

  const handleClose = () => {
    cancelEditTemplate();
    setShowModal(false);
  };

  const handleSave = async (type) => {
    await saveEditedTemplate(type);
    setShowModal(false);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 pl-0 text-2xl font-black tracking-tight text-sky-100 sm:mb-8 sm:text-3xl md:pl-10">Message Templates</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl, i) => {
          const typeKey = String(tpl.alertType).toUpperCase();
          const preview = tpl.template || 'No template content.';
          
          return (
            <div key={i} className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 hover:border-blue-500/50 transition-all duration-300 group flex flex-col overflow-hidden">
              <div className={`h-2 w-full ${
                tpl.alertType === 'RED' ? 'bg-red-500' : 
                tpl.alertType === 'ORANGE' ? 'bg-orange-500' : 
                tpl.alertType === 'YELLOW' ? 'bg-yellow-400' : 
                tpl.alertType === 'GREEN' ? 'bg-green-500' : 
                tpl.alertType === 'OTP' ? 'bg-purple-500' : 
                tpl.alertType === 'MANUAL' ? 'bg-blue-500' : 
                'bg-gray-400'}`}></div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <i className="fa-solid fa-message mr-2 opacity-50"></i> {tpl.alertType} Alert
                  </h3>
                  <button
                    onClick={() => handleOpenEdit(tpl.alertType, tpl.template)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-all shadow-sm"
                    title="Edit template"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                  </button>
                </div>
                
                <div className="bg-[#0f172a] rounded-xl p-5 border border-slate-800/50 flex-1 relative min-h-[120px]">
                  <p className="text-slate-100 font-medium leading-relaxed italic text-sm">
                    "{preview}"
                  </p>
                  <div className="absolute bottom-2 right-3 opacity-20 text-3xl">
                    <i className="fa-solid fa-quote-right"></i>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-tighter text-slate-500">
                    <span>{preview.length} Characters</span>
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">Ready for broadcast</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <i className="fa-solid fa-pen-nib"></i>
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Edit {activeType} Template</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase">Customize your emergency broadcast message</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Editor Side */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Message Content</label>
                    <textarea
                      rows="8"
                      className="w-full bg-[#0f172a] border-2 border-slate-700 rounded-2xl p-5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-100 shadow-inner resize-none font-medium leading-relaxed"
                      value={templateDrafts[String(activeType).toUpperCase()] || ''}
                      onChange={(e) => {
                        const key = String(activeType).toUpperCase();
                        setTemplateDrafts(prev => ({ ...prev, [key]: e.target.value }));
                      }}
                      placeholder="Write your SMS template here..."
                    ></textarea>
                    
                    <div className="mt-3 flex items-center justify-between text-xs font-bold">
                        <div className={`${(templateDrafts[String(activeType).toUpperCase()] || '').length > 160 ? 'text-red-400' : 'text-slate-400'}`}>
                            {(templateDrafts[String(activeType).toUpperCase()] || '').length} / 160 characters
                        </div>
                        <div className="text-slate-500">
                            Tip: Keep it concise for better delivery.
                        </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                        <i className="fa-solid fa-wand-magic-sparkles text-blue-400"></i> Insert Dynamic Data
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {(() => {
                            const typeKey = String(activeType).toUpperCase();
                            const rows = typeKey === 'OTP' ? [
                                { k: '[OTP Code]', v: "Code" },
                                { k: '[Time]', v: "Time" }
                            ] : typeKey === 'MANUAL' ? [
                                { k: '[Manual Message]', v: "Message" },
                                { k: '[Time]', v: "Time" }
                            ] : [
                                { k: '[Resident Name]', v: "Name" },
                                { k: '[Current Water Height]', v: "Height" },
                                { k: '[Alert Color]', v: "Status" },
                                { k: '[Time]', v: "Time" }
                            ];
                            
                            return rows.map((r, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => {
                                        const key = String(activeType).toUpperCase();
                                        setTemplateDrafts(prev => ({ ...prev, [key]: (prev[key] || '') + r.k }));
                                    }}
                                    className="bg-slate-800 hover:bg-blue-600 border border-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <i className="fa-solid fa-plus opacity-50"></i> {r.k}
                                </button>
                            ));
                        })()}
                    </div>
                  </div>
                </div>

                {/* Legend Side */}
                <div className="lg:col-span-5">
                    <div className="bg-[#0f172a] rounded-2xl p-6 border border-slate-800 h-full">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-circle-info text-blue-400"></i> Cheat Sheet / Legend
                        </h4>
                        <div className="space-y-4">
                            {(() => {
                                const typeKey = String(activeType).toUpperCase();
                                const rows = typeKey === 'OTP' ? [
                                    { k: '[OTP Code]', v: "The 6-digit authentication code." },
                                    { k: '[Time]', v: "Automatic timestamp of request." }
                                ] : typeKey === 'MANUAL' ? [
                                    { k: '[Manual Message]', v: "Custom text entered during broadcast." },
                                    { k: '[Time]', v: "Automatic timestamp of broadcast." }
                                ] : [
                                    { k: '[Resident Name]', v: "The name of the resident recipient." },
                                    { k: '[Current Water Height]', v: "The latest depth reading in meters." },
                                    { k: '[Alert Color]', v: "The official status (Normal/Yellow/etc)." },
                                    { k: '[Time]', v: "The time the sensor data was logged." }
                                ];
                                
                                return rows.map((r, idx) => (
                                    <div key={idx} className="pb-3 border-b border-slate-800/50 last:border-0">
                                        <div className="text-xs font-mono font-black text-blue-400 mb-1">{r.k}</div>
                                        <div className="text-xs font-medium text-slate-400 leading-relaxed">{r.v}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                        <div className="mt-6 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                            <p className="text-[11px] text-blue-300 leading-relaxed italic">
                                <i className="fa-solid fa-lightbulb mr-1"></i> Data in brackets will be replaced with real-time values before sending.
                            </p>
                        </div>
                    </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#0f172a] border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl text-slate-300 font-black uppercase tracking-widest hover:bg-slate-800 transition-all text-sm"
              >
                Discard
              </button>
              <button
                onClick={() => handleSave(activeType)}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95 text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
