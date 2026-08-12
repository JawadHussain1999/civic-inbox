import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Job from '../models/Job';
import Complaint from '../models/Complaint';

// Get all jobs (Admin only)
export const getAllJobs = async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await Job.find()
      .populate({
        path: 'complaints',
        populate: { path: 'citizen', select: 'name email' }
      })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    return res.json(jobs);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching jobs', error: error.message });
  }
};

// Admin updates job classification/assignment
export const updateJob = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const { department, urgency, summary, status } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const validDepartments = ['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks'];
    const validUrgencies = ['routine', 'urgent', 'emergency'];
    const validStatuses = ['unassigned', 'assigned', 'claimed', 'completed'];

    if (department && !validDepartments.includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }
    if (urgency && !validUrgencies.includes(urgency)) {
      return res.status(400).json({ message: 'Invalid urgency' });
    }
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const humanCorrection = job.humanCorrection || { department: undefined, urgency: undefined, summary: undefined };

    if (department) {
      job.department = department;
      humanCorrection.department = department;
    }
    if (urgency) {
      job.urgency = urgency;
      humanCorrection.urgency = urgency;
    }
    if (summary) {
      job.summary = summary;
      humanCorrection.summary = summary;
    }
    job.humanCorrection = humanCorrection as any;
    if (status) {
      job.status = status;
    }

    job.adminReviewed = true;
    job.adminVersion = (job.adminVersion || 0) + 1;

    await job.save();
    return res.json(job);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error updating job', error: error.message });
  }
};

// Get department jobs (Staff only)
export const getDepartmentJobs = async (req: AuthRequest, res: Response) => {
  try {
    const department = req.user?.department;
    if (!department) {
      return res.status(400).json({ message: 'Staff department not configured' });
    }

    // Staff can see jobs assigned to their department, which are either unassigned, assigned, claimed by them, or completed
    const jobs = await Job.find({ department })
      .populate({
        path: 'complaints',
        populate: { path: 'citizen', select: 'name email' }
      })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    return res.json(jobs);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching department jobs', error: error.message });
  }
};

// Claim a job (Staff only - prevents concurrent claims using atomic findOneAndUpdate)
export const claimJob = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;
    const department = req.user?.department;

    if (!department) {
      return res.status(400).json({ message: 'Staff department not configured' });
    }

    // Atomic update to ensure no other staff can claim simultaneously
    // Can only claim if job is unassigned/assigned and belongs to the staff's department
    const job = await Job.findOneAndUpdate(
      {
        _id: jobId,
        department,
        status: { $in: ['unassigned', 'assigned'] }
      },
      {
        $set: {
          status: 'claimed',
          assignedTo: userId,
          claimedAt: new Date()
        }
      },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!job) {
      return res.status(409).json({
        message: 'This job has already been claimed by another staff member, completed, or reassigned.'
      });
    }

    return res.json(job);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error claiming job', error: error.message });
  }
};

// Mark job as completed (Staff only)
export const completeJob = async (req: AuthRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    const department = req.user?.department;
    if (!department) {
      return res.status(400).json({ message: 'Staff department not configured' });
    }

    // A staff member can only complete a job that is claimed by them and belongs to their department
    const job = await Job.findOneAndUpdate(
      {
        _id: jobId,
        status: 'claimed',
        assignedTo: userId,
        department
      },
      {
        $set: {
          status: 'completed',
          completedAt: new Date()
        }
      },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!job) {
      return res.status(400).json({
        message: 'Job cannot be completed. Ensure you have claimed it first.'
      });
    }

    return res.json(job);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error completing job', error: error.message });
  }
};
