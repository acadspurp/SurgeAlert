import React from 'react';

export default function AdminUsersView(props) {
  const { 
    isHeadAdmin, 
    adminUsers, 
    setShowUserModal, 
    setEditingUser, 
    setUserForm, 
    showUserModal, 
    userForm, 
    editingUser,
    systemLogs, 
    activeView, 
    openCreateUserModal, 
    openEditUserModal, 
    saveUserModal, 
    handleDeleteAdminUser 
  } = props;

  return (
    <div className="animate-fade-in">
        {activeView === 'admin_users' && isHeadAdmin && (
            <div className="animate-fade-in">
                <h1 className="mb-6 pl-0 text-2xl font-black tracking-tight text-sky-100 sm:mb-8 sm:text-3xl md:pl-10">Admin Accounts</h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Accounts Table */}
                    <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
                            <h3 className="text-lg font-bold text-sky-100 flex items-center">
                                <i className="fa-solid fa-shield-halved mr-2 text-indigo-500"></i> Admin Accounts
                            </h3>
                            <button onClick={openCreateUserModal} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-sm font-bold shadow transition flex items-center">
                                <i className="fa-solid fa-plus mr-2"></i> Create
                            </button>
                        </div>
                        <div className="overflow-x-auto p-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-700">
                                        <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                                        <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                                        <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {adminUsers.map((a, i) => (
                                        <tr key={i} className="hover:bg-[#0f172a] transition-colors">
                                            <td className="py-3 px-4">
                                                <p className="font-bold text-slate-100">{a.fullName}</p>
                                                <p className="text-xs text-slate-400 font-mono">{a.username}</p>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${a.role === 'HEAD_ADMIN' ? 'bg-red-900/40 text-red-400 border border-red-500/30' : 'bg-blue-900/40 text-blue-400 border border-blue-500/30'}`}>
                                                    {a.role}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => openEditUserModal(a)} className="text-blue-400 hover:text-blue-300 mx-2 transition-colors"><i className="fa-solid fa-pen"></i></button>
                                                <button onClick={() => handleDeleteAdminUser(a.id, a.fullName)} className="text-red-400 hover:text-red-300 mx-2 transition-colors"><i className="fa-solid fa-trash"></i></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* System Action Logs */}
                    <div className="bg-[#1e293b] rounded-2xl shadow-lg border border-slate-700 flex flex-col max-h-[600px]">
                        <div className="p-6 border-b border-slate-700 bg-[#0f172a]">
                            <h3 className="text-lg font-bold text-sky-100 flex items-center">
                                <i className="fa-solid fa-list-check mr-2 text-teal-600"></i> System Action Logs
                            </h3>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                            {systemLogs.length === 0 ? (
                                <div className="text-center text-slate-400 py-8 italic opacity-50">No recorded actions.</div>
                            ) : (
                                systemLogs.map((log, i) => {
                                    const timeStr = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                    return (
                                        <div key={i} className="flex gap-4 group">
                                            <div className="w-16 text-[10px] font-black text-slate-500 pt-1.5 text-right uppercase tracking-tighter">{timeStr}</div>
                                            <div className="flex-1 bg-[#0f172a] rounded-xl p-4 text-sm font-medium text-slate-200 border border-slate-800 border-l-4 border-l-blue-500 group-hover:border-slate-700 transition-all">
                                                {log.message}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {/* USER MODAL */}
        {showUserModal && (
            <div className="fixed inset-0 flex items-center justify-center z-[100] animate-fade-in bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-[#1e293b] rounded-3xl shadow-2xl p-5 max-w-sm w-full border border-slate-700 ring-1 ring-white/10 overflow-hidden">
                    <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg shadow-lg ${editingUser ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                            <i className={`fa-solid ${editingUser ? 'fa-user-pen' : 'fa-user-plus'}`}></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-sky-100 leading-tight">{editingUser ? 'Update Account' : 'Create Admin Account'}</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Configure credentials and permissions</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4 mb-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Full Name</label>
                            <input type="text" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full border border-slate-700 p-2.5 rounded-lg bg-[#0f172a] text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold placeholder:text-slate-600" placeholder="e.g. Juan Luna" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Username</label>
                            <input type="text" disabled={!!editingUser} value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className={`w-full border border-slate-700 p-2.5 rounded-lg bg-[#0f172a] text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold placeholder:text-slate-600 ${editingUser ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="j.luna" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Password {editingUser && <span className="text-[9px] font-normal text-slate-500 normal-case">(Leave blank to keep current)</span>}</label>
                            <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full border border-slate-700 p-2.5 rounded-lg bg-[#0f172a] text-sm text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold placeholder:text-slate-600" placeholder="••••••••" />
                        </div>
                        
                        <div className="pt-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Assigned Role</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div 
                                    onClick={() => setUserForm({...userForm, role: 'ADMIN'})}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${userForm.role === 'ADMIN' ? 'border-blue-500 bg-blue-900/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-slate-700 hover:border-slate-500 bg-[#0f172a]'}`}
                                >
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-2 transition-colors ${userForm.role === 'ADMIN' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                                        <i className="fa-solid fa-user text-sm"></i>
                                    </div>
                                    <h4 className="font-black text-slate-100 text-xs uppercase tracking-wide">Admin</h4>
                                    <p className="text-[9px] text-slate-500 mt-0.5 font-bold leading-tight uppercase">Monitoring & Standard Access</p>
                                </div>
                                <div 
                                    onClick={() => setUserForm({...userForm, role: 'HEAD_ADMIN'})}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${userForm.role === 'HEAD_ADMIN' ? 'border-red-500 bg-red-900/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-slate-700 hover:border-slate-500 bg-[#0f172a]'}`}
                                >
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-2 transition-colors ${userForm.role === 'HEAD_ADMIN' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                                        <i className="fa-solid fa-user-shield text-sm"></i>
                                    </div>
                                    <h4 className="font-black text-slate-100 text-xs uppercase tracking-wide">Head Admin</h4>
                                    <p className="text-[9px] text-slate-500 mt-0.5 font-bold leading-tight uppercase">Full System Control</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4 border-t border-slate-700">
                        <button onClick={() => setShowUserModal(false)} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-100 font-black uppercase tracking-widest transition-all text-[10px] active:scale-95">Cancel</button>
                        <button onClick={saveUserModal} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-black uppercase tracking-widest shadow-lg shadow-indigo-900/20 transition-all text-[10px] active:scale-95">
                            {editingUser ? 'Save Updates' : 'Create User'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
