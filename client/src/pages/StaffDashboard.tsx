import { useState, useEffect } from 'react';
import { Briefcase, CheckCircle2, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Job, Complaint } from '../types';

interface StaffDashboardProps {
  token: string;
  department: string;
}

export default function StaffDashboard({ token, department }: StaffDashboardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/staff/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      } else {
        setError('Failed to fetch department jobs.');
      }
    } catch (err) {
      console.error('Error fetching staff jobs:', err);
      setError('Could not connect to API.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (jobId: string) => {
    setActionLoading(jobId);
    setError('');
    setSuccess('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/staff/jobs/${jobId}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.status === 409) {
        setError('RACE CONDITION ENCOUNTERED: This job was just claimed by another crew member. Syncing feed...');
        fetchJobs();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to claim job.');
      }

      setSuccess('Job claimed successfully! You are now dispatched to this location.');
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (jobId: string) => {
    setActionLoading(jobId);
    setError('');
    setSuccess('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/staff/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to complete job.');
      }

      setSuccess('Job marked as completed. Well done, team!');
      fetchJobs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getUrgencyBadgeColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-50 text-red-700 border border-red-200';
      case 'urgent': return 'bg-amber-50 text-amber-700 border border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  };

  const activeClaims = jobs.filter(j => j.status === 'claimed');
  const availableJobs = jobs.filter(j => j.status === 'unassigned' || j.status === 'assigned');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner with Feed Syncing */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {department} Crew Operations
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Review and resolve dispatched jobs for your department.
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-800 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Sync Operations Feed</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-bold flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-2xl text-sm font-bold flex items-center space-x-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid of Job Boards */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Board 1: Assigned / Dispatched */}
        <div className="space-y-4">
          <h3 className="text-base font-extrabold text-slate-500 flex items-center justify-between tracking-wide uppercase text-xs">
            <span>Dispatched Queue ({availableJobs.length})</span>
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-850 rounded-full animate-spin"></div>
            </div>
          ) : availableJobs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl text-slate-400 font-semibold text-xs">
              No new jobs dispatched.
            </div>
          ) : (
            <div className="space-y-4">
              {availableJobs.map((j) => (
                <div key={j._id} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 hover:border-slate-350 transition-all shadow-sm shadow-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getUrgencyBadgeColor(j.urgency)}`}>
                      {j.urgency}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      Reports: {j.complaints.length}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{j.summary}</h4>
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 font-medium">
                      {(j.complaints[0] as Complaint)?.description || j.summary}
                    </p>
                  </div>

                  <button
                    onClick={() => handleClaim(j._id)}
                    disabled={actionLoading !== null}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === j._id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>Claim Work Order</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Board 2: Claimed / Active Work */}
        <div className="space-y-4">
          <h3 className="text-base font-extrabold text-slate-500 flex items-center justify-between tracking-wide uppercase text-xs">
            <span>Active Work ({activeClaims.length})</span>
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-850 rounded-full animate-spin"></div>
            </div>
          ) : activeClaims.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl text-slate-400 font-semibold text-xs">
              No active claimed jobs.
            </div>
          ) : (
            <div className="space-y-4">
              {activeClaims.map((j) => (
                <div key={j._id} className="p-5 bg-white border-2 border-slate-900 rounded-2xl space-y-4 relative overflow-hidden shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getUrgencyBadgeColor(j.urgency)}`}>
                      {j.urgency}
                    </span>
                    <span className="text-[10px] text-slate-900 font-bold flex items-center space-x-1">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>My Job</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{j.summary}</h4>
                    <p className="text-[11px] text-slate-400 mt-2 font-bold">
                      Claimed: {j.claimedAt ? new Date(j.claimedAt).toLocaleTimeString() : 'Recently'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleComplete(j._id)}
                    disabled={actionLoading !== null}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === j._id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Resolve & Close Order</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Board 3: Completed Log */}
        <div className="space-y-4">
          <h3 className="text-base font-extrabold text-slate-500 flex items-center justify-between tracking-wide uppercase text-xs">
            <span>Completed Orders ({completedJobs.length})</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-850 rounded-full animate-spin"></div>
            </div>
          ) : completedJobs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl text-slate-400 font-semibold text-xs">
              No jobs completed yet today.
            </div>
          ) : (
            <div className="space-y-4">
              {completedJobs.map((j) => (
                <div key={j._id} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 opacity-60 hover:opacity-100 transition-all shadow-sm shadow-slate-50">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span className="font-mono">ID: {j._id.slice(-6).toUpperCase()}</span>
                    <span className="flex items-center space-x-1 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Resolved</span>
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-850 line-clamp-1">{j.summary}</h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Closed: {j.completedAt ? new Date(j.completedAt).toLocaleDateString() : 'Today'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
