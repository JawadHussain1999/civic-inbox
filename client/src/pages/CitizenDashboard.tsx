import { useState, useEffect } from 'react';
import { Camera, MapPin, Send, Clock, AlertCircle, FileText } from 'lucide-react';
import type { Complaint } from '../types';

interface CitizenDashboardProps {
  token: string;
}

export default function CitizenDashboard({ token }: CitizenDashboardProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/complaints/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComplaints(data);
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
    }
  };

  const captureLocation = () => {
    setGettingLocation(true);
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setGettingLocation(false);
      setLocation({ latitude: 40.7128 + (Math.random() - 0.5) * 0.02, longitude: -74.0060 + (Math.random() - 0.5) * 0.02 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGettingLocation(false);
      },
      (err) => {
        console.warn('Geolocation error, using mock coordinates:', err.message);
        setLocation({
          latitude: 40.7128 + (Math.random() - 0.5) * 0.02,
          longitude: -74.0060 + (Math.random() - 0.5) * 0.02
        });
        setGettingLocation(false);
      },
      { timeout: 10000 }
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;
    if (!location) {
      setError('Please capture your location before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          description,
          photo,
          latitude: location.latitude,
          longitude: location.longitude
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit complaint.');
      }

      setSuccessMsg('Complaint reported successfully! Our AI is grouping and assigning it.');
      setDescription('');
      setPhoto('');
      setLocation(null);
      fetchComplaints();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getJobStatusDisplay = (job: any) => {
    if (!job) return { text: 'AI Analyzing', color: 'text-amber-700 bg-amber-50 border-amber-200', step: 1 };
    switch (job.status) {
      case 'completed':
        return { text: 'Completed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', step: 4 };
      case 'claimed':
        return { text: 'In Progress', color: 'text-cyan-700 bg-cyan-50 border-cyan-200', step: 3 };
      case 'assigned':
        return { text: 'Assigned', color: 'text-blue-700 bg-blue-50 border-blue-200', step: 2 };
      default:
        return { text: 'Grouped & Dispatching', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', step: 2 };
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Side: Submit Complaint Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-100">
            <h2 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-slate-800" />
              <span>Report an Issue</span>
            </h2>

            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs font-semibold">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Describe the Problem
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-250 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all text-sm font-medium"
                  placeholder="e.g. A large pothole is blocking the right lane in front of the medical store, causing traffic issues."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Upload Photo (Optional)
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-all w-20 h-20 relative overflow-hidden group">
                    {photo ? (
                      <img src={photo} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Camera className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-all" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <div className="text-xs text-slate-500 font-medium">
                    {photo ? 'Photo selected. Click preview to replace.' : 'Attach an image to help crew identify the issue.'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Complaint Location
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={gettingLocation}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-sm font-bold transition-all w-full cursor-pointer ${
                      location
                        ? 'bg-slate-50 border-emerald-500 text-emerald-600'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-350 text-slate-800'
                    }`}
                  >
                    <MapPin className={`h-4 w-4 ${location ? 'text-emerald-500 animate-bounce' : 'text-slate-400'}`} />
                    <span>
                      {gettingLocation
                        ? 'Locating...'
                        : location
                        ? 'Location Captured'
                        : 'Capture Location'}
                    </span>
                  </button>
                </div>
                {location && (
                  <p className="mt-2 text-[10px] text-slate-500 font-mono text-center">
                    Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Submit Complaint</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: My Complaints Tracker */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-100">
            <h2 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center space-x-2">
              <Clock className="h-5 w-5 text-slate-800" />
              <span>Track Your Complaints</span>
            </h2>

            {complaints.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl">
                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-semibold">You haven't reported any complaints yet.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {complaints.map((c) => {
                  const status = getJobStatusDisplay(c.job);
                  return (
                    <div
                      key={c._id}
                      className="p-5 bg-white border border-slate-150 hover:border-slate-250 rounded-2xl transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-sm shadow-slate-50"
                    >
                      <div className="space-y-3.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${status.color}`}>
                            {status.text}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Reported: {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{c.description}</p>

                        {/* Custom visual progress bar */}
                        <div className="pt-2">
                          <div className="flex justify-between text-[9px] text-slate-400 mb-1.5 font-bold tracking-wider">
                            <span>REPORTED</span>
                            <span>ASSIGNED</span>
                            <span>IN PROGRESS</span>
                            <span>RESOLVED</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                            <div
                              className={`h-full rounded-full transition-all ${
                                status.step === 4
                                  ? 'bg-emerald-500 w-full'
                                  : status.step === 3
                                  ? 'bg-cyan-500 w-3/4'
                                  : status.step === 2
                                  ? 'bg-blue-500 w-2/4'
                                  : 'bg-amber-500 w-1/4'
                              }`}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {c.photo && (
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 self-center md:self-start shadow-inner">
                          <img src={c.photo} alt="Complaint Attachment" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
