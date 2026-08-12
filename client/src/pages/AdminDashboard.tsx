import { useState, useEffect } from 'react';
import { Sparkles, Map, List, CheckCircle, RefreshCw, Send } from 'lucide-react';
import type { Job, Complaint } from '../types';

interface AdminDashboardProps {
  token: string;
}

export default function AdminDashboard({ token }: AdminDashboardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editDept, setEditDept] = useState<Job['department']>('Sanitation');
  const [editUrgency, setEditUrgency] = useState<Job['urgency']>('routine');
  const [editSummary, setEditSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/admin/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        if (data.length > 0) {
          selectJob(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectJob = (job: Job) => {
    setSelectedJob(job);
    setEditDept(job.department);
    setEditUrgency(job.urgency);
    setEditSummary(job.summary);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setUpdating(true);
    setError('');

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/admin/jobs/${selectedJob._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          department: editDept,
          urgency: editUrgency,
          summary: editSummary,
          status: selectedJob.status === 'unassigned' ? 'assigned' : selectedJob.status
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update job assignment.');
      }

      const updatedJob = await response.json();
      setJobs(jobs.map(j => j._id === updatedJob._id ? { ...j, ...updatedJob } : j));
      setSelectedJob({ ...selectedJob, ...updatedJob });
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-50 text-red-700 border border-red-200';
      case 'urgent': return 'bg-amber-50 text-amber-700 border border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'claimed': return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
      case 'assigned': return 'bg-blue-50 text-blue-700 border border-blue-200';
      default: return 'bg-purple-50 text-purple-700 border border-purple-200';
    }
  };

  const getCoordinatesBoundary = () => {
    if (jobs.length === 0) return { minLat: 40.7, maxLat: 40.73, minLon: -74.02, maxLon: -73.98 };
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    jobs.forEach(j => {
      if (j.location.latitude < minLat) minLat = j.location.latitude;
      if (j.location.latitude > maxLat) maxLat = j.location.latitude;
      if (j.location.longitude < minLon) minLon = j.location.longitude;
      if (j.location.longitude > maxLon) maxLon = j.location.longitude;
    });
    const latPadding = Math.max((maxLat - minLat) * 0.2, 0.005);
    const lonPadding = Math.max((maxLon - minLon) * 0.2, 0.005);
    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding
    };
  };

  const bounds = getCoordinatesBoundary();
  const getSVGCoords = (lat: number, lon: number) => {
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lonRange = bounds.maxLon - bounds.minLon || 1;
    const y = 280 - ((lat - bounds.minLat) / latRange) * 230;
    const x = 30 + ((lon - bounds.minLon) / lonRange) * 440;
    return { x, y };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Map and Job Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dashboard City GIS Operations Room */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                <Map className="h-5 w-5 text-slate-800" />
                <span>GIS Operations Room</span>
              </h2>
              <button
                onClick={fetchJobs}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* City Map SVG representation */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden aspect-video">
              <svg className="w-full h-full" viewBox="0 0 500 300">
                {/* City Grid Road Lines */}
                <line x1="50" y1="0" x2="50" y2="300" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="150" y1="0" x2="150" y2="300" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="250" y1="0" x2="250" y2="300" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="350" y1="0" x2="350" y2="300" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="450" y1="0" x2="450" y2="300" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />

                <line x1="0" y1="60" x2="500" y2="60" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="0" y1="130" x2="500" y2="130" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="0" y1="200" x2="500" y2="200" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="0" y1="270" x2="500" y2="270" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" />

                {/* Major Highways */}
                <path d="M 0 100 Q 250 250 500 100" fill="transparent" stroke="#cbd5e1" strokeWidth="4" />
                <path d="M 100 0 Q 300 150 400 300" fill="transparent" stroke="#cbd5e1" strokeWidth="4" />

                {/* Pulsing Pins for Jobs */}
                {jobs.map((j) => {
                  const { x, y } = getSVGCoords(j.location.latitude, j.location.longitude);
                  const isSelected = selectedJob?._id === j._id;
                  const color = j.urgency === 'emergency' ? '#ef4444' : j.urgency === 'urgent' ? '#f59e0b' : '#3b82f6';
                  return (
                    <g key={j._id} className="cursor-pointer" onClick={() => selectJob(j)}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 10 : 6}
                        fill={color}
                        fillOpacity="0.3"
                        className="animate-ping"
                        style={{ transformOrigin: `${x}px ${y}px`, animationDuration: isSelected ? '1.5s' : '3s' }}
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 6 : 4}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={isSelected ? 2 : 1}
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-3 left-3 flex items-center space-x-4 bg-white/90 border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] text-slate-500 font-bold shadow-sm">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span>Emergency</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>Urgent</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>Routine</span>
                </div>
              </div>
            </div>
          </div>

          {/* Job Dispatch Feed */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-100">
            <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center space-x-2">
              <List className="h-5 w-5 text-slate-800" />
              <span>Incoming Job Groups</span>
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl text-slate-400 font-semibold text-sm">
                No complaint job groups reported.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {jobs.map((j) => {
                  const isSelected = selectedJob?._id === j._id;
                  return (
                    <div
                      key={j._id}
                      onClick={() => selectJob(j)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-slate-50 border-slate-800 shadow-sm'
                          : 'bg-white border-slate-150 hover:border-slate-250'
                      }`}
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-950 line-clamp-1">{j.summary}</h4>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-bold">
                          <span className="text-slate-700 capitalize">{j.department}</span>
                          <span>•</span>
                          <span>{j.complaints.length} Citizen Report(s)</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getUrgencyBadge(j.urgency)}`}>
                          {j.urgency}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusBadge(j.status)}`}>
                          {j.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Suggestion & Dispatch Details */}
        <div className="lg:col-span-1">
          {selectedJob ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-100 space-y-6">
              <div>
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Selected Job Group</span>
                <h3 className="text-lg font-extrabold text-slate-900 leading-tight mt-1">{selectedJob.summary}</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Coordinates: {selectedJob.location.latitude.toFixed(5)}, {selectedJob.location.longitude.toFixed(5)}</p>
              </div>

              {/* AI Insight Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden">
                <div className="flex items-center space-x-2 text-slate-800 text-xs font-extrabold uppercase tracking-wider mb-3">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>AI Suggestions</span>
                </div>
                {selectedJob.adminReviewed ? (
                  <div className="text-xs text-emerald-700 flex items-center space-x-2 bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-xl font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Human verified & locked. AI updates disabled (V{selectedJob.adminVersion}).</span>
                  </div>
                ) : (
                  <div className="space-y-2 font-semibold">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Department:</span>
                      <span className="text-slate-900 capitalize">{selectedJob.department}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Urgency Level:</span>
                      <span className="text-slate-900 capitalize">{selectedJob.urgency}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Confidence Index:</span>
                      <span className="text-indigo-600">92%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Correction & Dispatch Form */}
              <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Review & Dispatch</h4>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Job Summary</label>
                  <input
                    type="text"
                    required
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Department</label>
                    <select
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-semibold"
                    >
                      <option value="Sanitation">Sanitation</option>
                      <option value="Roads">Roads</option>
                      <option value="Water">Water</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Parks">Parks</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Urgency</label>
                    <select
                      value={editUrgency}
                      onChange={(e) => setEditUrgency(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-semibold"
                    >
                      <option value="routine">Routine</option>
                      <option value="urgent">Urgent</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Confirm & Dispatch Job</span>
                    </>
                  )}
                </button>
              </form>

              {/* Grouped Citizen Reports List */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Citizen Reports ({selectedJob.complaints.length})
                </h4>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {(selectedJob.complaints as Complaint[]).map((c) => (
                    <div key={c._id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 font-medium">
                      <p className="text-xs text-slate-700 leading-relaxed">{c.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                        <span>By: {(c.citizen as any)?.name || 'Citizen'}</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      {c.photo && (
                        <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                          <img src={c.photo} alt="Report attachment" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400 font-semibold text-sm shadow-xl shadow-slate-100">
              Select a job group to view analysis and dispatch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
