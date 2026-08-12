import mongoose, { Schema } from 'mongoose';

const JobSchema = new Schema({
  complaints: [{ type: Schema.Types.ObjectId, ref: 'Complaint' }],
  department: { type: String, enum: ['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks'], required: true },
  urgency: { type: String, enum: ['routine', 'urgent', 'emergency'], default: 'routine' },
  status: { type: String, enum: ['unassigned', 'assigned', 'claimed', 'completed'], default: 'unassigned' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' }, // Staff claimed
  claimedAt: { type: Date },
  completedAt: { type: Date },
  summary: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  aiSuggestion: {
    department: { type: String, enum: ['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks'] },
    urgency: { type: String, enum: ['routine', 'urgent', 'emergency'] },
    summary: { type: String }
  },
  humanCorrection: {
    department: { type: String, enum: ['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks'] },
    urgency: { type: String, enum: ['routine', 'urgent', 'emergency'] },
    summary: { type: String }
  },
  adminReviewed: { type: Boolean, default: false },
  adminVersion: { type: Number, default: 0 }
}, { timestamps: true });

// Compound index to support active department and status filtering for staff
JobSchema.index({ department: 1, status: 1 });


export default mongoose.model('Job', JobSchema);
