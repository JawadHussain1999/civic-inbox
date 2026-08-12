import mongoose, { Schema } from 'mongoose';

const ComplaintSchema = new Schema({
  citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  photo: { type: String }, // Base64 or URL
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  aiSuggestion: {
    department: { type: String, enum: ['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks'] },
    urgency: { type: String, enum: ['routine', 'urgent', 'emergency'] },
    summary: { type: String },
    confidence: { type: Number }
  },
  job: { type: Schema.Types.ObjectId, ref: 'Job' }
}, { timestamps: true });

ComplaintSchema.index({ citizen: 1 });

export default mongoose.model('Complaint', ComplaintSchema);
