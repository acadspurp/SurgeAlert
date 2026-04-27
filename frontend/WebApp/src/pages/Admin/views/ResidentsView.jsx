import React, { useState, useMemo } from 'react';

export default function ResidentsView(props) {
  const { 
    residents, 
    searchTerm, 
    setSearchTerm, 
    handleDeleteResident, 
    isAddingResident, 
    setIsAddingResident,
    newResidentState, 
    setNewResidentState, 
    handleAddManualResident,
    handleTogglePriority
  } = props;

  // Local state for UI controls
  const [priorityFilter, setPriorityFilter] = useState('ALL'); // ALL, PRIORITY, REGULAR
  const [sortOrder, setSortOrder] = useState('DESC'); // DESC = Newest first, ASC = Oldest first
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Apply Filtering (Search + Priority)
  const filteredData = useMemo(() => {
    let result = (Array.isArray(residents) ? residents : []);

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r => 
        (r.fullName || '').toLowerCase().includes(q) || 
        (r.phoneNumber || '').toLowerCase().includes(q)
      );
    }

    // Priority filter
    if (priorityFilter === 'PRIORITY') {
      result = result.filter(r => r.isPriority);
    } else if (priorityFilter === 'REGULAR') {
      result = result.filter(r => !r.isPriority);
    }

    // 2. Apply Sorting (By Date)
    result.sort((a, b) => {
      const timeA = a.registrationDate ? new Date(a.registrationDate).getTime() : 0;
      const timeB = b.registrationDate ? new Date(b.registrationDate).getTime() : 0;
      return sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [residents, searchTerm, priorityFilter, sortOrder]);

  // 3. Apply Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const validateAndNormalizePhone = (phone) => {
    // Starts with 9 and 10 digits
    if (/^9\d{9}$/.test(phone)) return phone;
    // Starts with 09 and 11 digits
    if (/^09\d{9}$/.test(phone)) return phone.substring(1);
    return null;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const normalized = validateAndNormalizePhone(newResidentState.phone);
    if (!normalized) {
      alert("Invalid Phone Number. Please enter a 10-digit number starting with 9 (e.g., 9123...) or 11-digit starting with 09 (e.g., 0912...).");
      return;
    }
    // Proceed with adding
    handleAddManualResident(e, normalized);
  };

  return (
    <div className="animate-fade-in pb-10">
      <h1 className="text-3xl font-black text-sky-100 tracking-tight mb-8 pl-4 uppercase">Subscribers Management</h1>
      
      {/* TOOLBAR */}
      <div className="bg-[#1e293b] rounded-2xl p-6 mb-6 border border-slate-700 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Search */}
          <div className="lg:col-span-5 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search by name or phone..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-700 bg-[#0f172a] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-white transition-all placeholder:text-slate-500"
            />
          </div>

          {/* Filters */}
          <div className="lg:col-span-4 flex gap-2">
            <select 
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              className="flex-1 bg-[#0f172a] border-2 border-slate-700 text-white rounded-xl px-4 py-2 outline-none focus:border-blue-500 font-bold"
            >
              <option value="ALL">All Subscribers</option>
              <option value="PRIORITY">Priority Only</option>
              <option value="REGULAR">Regular Only</option>
            </select>
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="flex-1 bg-[#0f172a] border-2 border-slate-700 text-white rounded-xl px-4 py-2 outline-none focus:border-blue-500 font-bold"
            >
              <option value="DESC">Newest Registered</option>
              <option value="ASC">Oldest Registered</option>
            </select>
          </div>

          {/* Add Button */}
          <div className="lg:col-span-3 flex gap-2">
            <button
              onClick={() => setIsAddingResident(!isAddingResident)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${isAddingResident ? 'bg-slate-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
            >
              <i className={`fa-solid ${isAddingResident ? 'fa-xmark' : 'fa-user-plus'}`}></i>
              {isAddingResident ? 'Close' : 'Add Subscriber'}
            </button>
          </div>

        </div>
      </div>

      {/* ADD FORM */}
      {isAddingResident && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-blue-500/30 p-8 mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <i className="fa-solid fa-user-plus"></i>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Register New Subscriber</h3>
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-widest mb-2 ml-1">Name (Optional)</label>
                <input 
                  type="text" 
                  className="w-full bg-[#0f172a] border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-sky-500 outline-none transition-all font-bold" 
                  value={newResidentState.name} 
                  onChange={e => setNewResidentState({...newResidentState, name: e.target.value})} 
                  placeholder="e.g. Dela Cruz" 
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 text-sm font-black text-slate-200 bg-slate-800 border-2 border-r-0 border-slate-700 rounded-l-xl">+63</span>
                  <input 
                    required 
                    type="tel" 
                    maxLength={newResidentState.phone.startsWith('0') ? 11 : 10} 
                    className="w-full bg-[#0f172a] font-black border-2 border-slate-700 text-white rounded-r-xl px-4 py-3 outline-none focus:border-sky-500 transition-all" 
                    value={newResidentState.phone} 
                    onChange={e => setNewResidentState({...newResidentState, phone: e.target.value})} 
                    placeholder="9XXXXXXXXX" 
                  />
                </div>
              </div>
              <div className="flex items-center h-[52px] pl-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={newResidentState.isPriority} 
                      onChange={e => setNewResidentState({...newResidentState, isPriority: e.target.checked})} 
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${newResidentState.isPriority ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${newResidentState.isPriority ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className={`text-sm font-black uppercase tracking-wide transition-colors ${newResidentState.isPriority ? 'text-amber-400' : 'text-slate-300'}`}>
                    Priority User
                  </span>
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-green-900/20 active:scale-95">
                  Register
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-700 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-[#0f172a]">
              <tr>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-300 uppercase tracking-widest">Name</th>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-300 uppercase tracking-widest">Phone Number</th>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-300 uppercase tracking-widest">Priority</th>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-300 uppercase tracking-widest">Registered At</th>
                <th className="px-6 py-5 text-right text-xs font-black text-slate-300 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-[#1e293b]">
              {paginatedData.map((res, i) => (
                <tr key={res.id || i} className="group hover:bg-[#0f172a] transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${res.isPriority ? 'bg-amber-500/20 text-amber-500' : 'bg-sky-500/20 text-sky-400'}`}>
                        {(res.fullName || 'A').charAt(0)}
                      </div>
                      <span className="text-sm font-black text-white">{res.fullName || 'Anonymous'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-black text-slate-200 group-hover:text-sky-400 transition-colors">
                    {res.phoneNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => handleTogglePriority(res.id)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${res.isPriority ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/30' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'}`}
                    >
                      <i className={`fa-solid ${res.isPriority ? 'fa-star' : 'fa-star-half-stroke opacity-30'}`}></i>
                      {res.isPriority ? 'Priority' : 'Normal'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                    {formatDate(res.registrationDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      className="text-slate-400 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all" 
                      onClick={() => handleDeleteResident(res.id, res.fullName)}
                      title="Remove Subscriber"
                    >
                      <i className="fa-solid fa-trash-can text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))}
              
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-20">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                        <i className="fa-solid fa-users-slash text-3xl text-slate-500"></i>
                      </div>
                      <p className="font-black text-lg uppercase tracking-tight text-white">No Subscribers Found</p>
                      <p className="text-sm mt-1 font-bold opacity-60">Try adjusting your search or filters.</p>
                      {searchTerm && (
                        <button 
                          onClick={() => {setSearchTerm(""); setPriorityFilter("ALL");}}
                          className="mt-4 text-blue-400 hover:text-blue-300 font-black text-sm underline uppercase tracking-widest"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {totalPages > 1 && (
          <div className="bg-[#0f172a] px-6 py-4 flex items-center justify-between border-t border-slate-800">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Showing <span className="text-sky-400">{Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-sky-400">{Math.min(filteredData.length, currentPage * itemsPerPage)}</span> of <span className="text-sky-400">{filteredData.length}</span>
            </p>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700 transition-all ${currentPage === 1 ? 'opacity-20 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              {[...Array(totalPages)].map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === idx + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {idx + 1}
                </button>
              ))}
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700 transition-all ${currentPage === totalPages ? 'opacity-20 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
