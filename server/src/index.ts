import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { register, login } from './controllers/authController';
import { createComplaint, getCitizenComplaints, getComplaintById } from './controllers/complaintController';
import { getAllJobs, updateJob, getDepartmentJobs, claimJob, completeJob } from './controllers/jobController';
import { authenticate, authorize } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support base64 image uploads

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civic-inbox';
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000 // 5 seconds timeout
})
.then(() => console.log('Connected to MongoDB successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  console.log('Ensure MongoDB is running locally on port 27017, or configure MONGODB_URI in a .env file.');
});

// Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// Complaint Routes (Citizens)
app.post('/api/complaints', authenticate, authorize(['citizen']), createComplaint);
app.get('/api/complaints/my', authenticate, authorize(['citizen']), getCitizenComplaints);
app.get('/api/complaints/:complaintId', authenticate, authorize(['citizen']), getComplaintById);

// Admin Routes (Admin)
app.get('/api/admin/jobs', authenticate, authorize(['admin']), getAllJobs);
app.put('/api/admin/jobs/:jobId', authenticate, authorize(['admin']), updateJob);

// Staff Routes (Staff)
app.get('/api/staff/jobs', authenticate, authorize(['staff']), getDepartmentJobs);
app.post('/api/staff/jobs/:jobId/claim', authenticate, authorize(['staff']), claimJob);
app.post('/api/staff/jobs/:jobId/complete', authenticate, authorize(['staff']), completeJob);

// Root / Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Civic Inbox API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
