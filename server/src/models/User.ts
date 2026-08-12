import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['citizen', 'admin', 'staff'], default: 'citizen' },
  department: { type: String, enum: ['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks'], required: function(this: any) { return this.role === 'staff'; } }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
