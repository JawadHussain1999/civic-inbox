export interface User {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'admin' | 'staff';
  department?: 'Sanitation' | 'Roads' | 'Water' | 'Electricity' | 'Parks';
}

export interface AISuggestion {
  department: 'Sanitation' | 'Roads' | 'Water' | 'Electricity' | 'Parks';
  urgency: 'routine' | 'urgent' | 'emergency';
  summary: string;
  confidence: number;
}

export interface Complaint {
  _id: string;
  citizen: string | { _id: string; name: string; email: string };
  description: string;
  photo?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  aiSuggestion: AISuggestion;
  job?: string | Job;
  createdAt: string;
}

export interface Job {
  _id: string;
  complaints: string[] | Complaint[];
  department: 'Sanitation' | 'Roads' | 'Water' | 'Electricity' | 'Parks';
  urgency: 'routine' | 'urgent' | 'emergency';
  status: 'unassigned' | 'assigned' | 'claimed' | 'completed';
  assignedTo?: { _id: string; name: string; email: string };
  claimedAt?: string;
  completedAt?: string;
  summary: string;
  location: {
    latitude: number;
    longitude: number;
  };
  adminReviewed: boolean;
  adminVersion?: number;
  humanCorrection?: {
    department?: string;
    urgency?: string;
    summary?: string;
  };
  createdAt: string;
}
