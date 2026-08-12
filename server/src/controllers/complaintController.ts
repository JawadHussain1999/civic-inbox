import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Complaint from '../models/Complaint';
import Job from '../models/Job';
import { analyzeComplaint, getDistanceMeters, getKeywordSimilarity, GROUPING_DISTANCE_METERS } from '../services/ai';
import mongoose from 'mongoose';

// Create a new citizen complaint with validation and hybrid grouping
export const createComplaint = async (req: AuthRequest, res: Response) => {
  try {
    const { description, photo, latitude, longitude } = req.body;
    const citizenId = req.user?.id;

    if (!citizenId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 1. Validate description
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ message: 'Description must be at least 10 characters long' });
    }
    if (description.length > 2000) {
      return res.status(400).json({ message: 'Description exceeds length limit of 2000 characters' });
    }

    // 2. Validate coordinates
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ message: 'Coordinates are invalid' });
    }

    // 3. Validate image (optional)
    if (photo) {
      if (typeof photo !== 'string') {
        return res.status(400).json({ message: 'Photo payload must be a string' });
      }
      // Simple signature & size check
      const imageRegex = /^data:image\/(png|jpeg|webp);base64,/;
      if (!imageRegex.test(photo)) {
        return res.status(400).json({ message: 'Invalid image format. Allowed formats: PNG, JPEG, WEBP' });
      }
      const approxSizeBytes = photo.length * 0.75;
      if (approxSizeBytes > 5 * 1024 * 1024) { // 5MB limit
        return res.status(400).json({ message: 'Image size exceeds the 5MB limit' });
      }
    }

    // 4. Run AI suggestions
    const aiSuggestion = await analyzeComplaint(description);

    // 5. Create Complaint document
    const complaint = new Complaint({
      citizen: citizenId,
      description,
      photo,
      location: { latitude: lat, longitude: lon },
      aiSuggestion
    });

    // 6. Find grouping candidates
    const activeJobs = await Job.find({ status: { $ne: 'completed' } }).populate('complaints');
    let bestMatchedJobId: string | null = null;
    let highestGroupScore = -Infinity;

    for (const job of activeJobs) {
      if (!job.location || job.location.latitude === undefined || job.location.longitude === undefined) continue;
      const distance = getDistanceMeters(lat, lon, job.location.latitude, job.location.longitude);
      
      if (distance <= GROUPING_DISTANCE_METERS) {
        // Calculate hybrid score components
        const lexicalSimilarity = getKeywordSimilarity(description, job.summary);
        const departmentScore = (aiSuggestion.department === job.department) ? 1.0 : 0.2;
        const distanceScore = 1.0 - (distance / GROUPING_DISTANCE_METERS);

        // groupScore = lexicalSimilarity * 0.5 + departmentScore * 0.3 + distanceScore * 0.2
        const groupScore = (lexicalSimilarity * 0.5) + (departmentScore * 0.3) + (distanceScore * 0.2);

        // Group only if score exceeds threshold (0.5) and is the best fit
        if (groupScore >= 0.5 && groupScore > highestGroupScore) {
          highestGroupScore = groupScore;
          bestMatchedJobId = job._id.toString();
        }
      }
    }

    if (bestMatchedJobId) {
      const job = await Job.findById(bestMatchedJobId);
      if (job && job.location) {
        job.complaints.push(complaint._id);

        // Centroid calculation
        const allComplaints = await Complaint.find({ _id: { $in: job.complaints } });
        let totalLat = lat;
        let totalLon = lon;
        allComplaints.forEach(c => {
          if (c.location && c.location.latitude !== undefined && c.location.longitude !== undefined) {
            totalLat += c.location.latitude;
            totalLon += c.location.longitude;
          }
        });
        job.location.latitude = totalLat / (allComplaints.length + 1);
        job.location.longitude = totalLon / (allComplaints.length + 1);

        // Urgency escalation policy: routine = 1 < urgent = 2 < emergency = 3
        const urgencyHierarchy: Record<string, number> = { routine: 1, urgent: 2, emergency: 3 };
        const currentUrgencyVal = urgencyHierarchy[job.urgency] || 1;
        const newUrgencyVal = urgencyHierarchy[aiSuggestion.urgency] || 1;

        if (newUrgencyVal > currentUrgencyVal) {
          job.urgency = aiSuggestion.urgency;
        }

        // If job was NOT human reviewed, we can also update department/summary
        if (!job.adminReviewed) {
          job.department = aiSuggestion.department;
          job.summary = aiSuggestion.summary;
        }

        await job.save();
        complaint.job = job._id;
      }
    } else {
      // Create new Job
      const newJob = new Job({
        complaints: [complaint._id],
        department: aiSuggestion.department,
        urgency: aiSuggestion.urgency,
        summary: aiSuggestion.summary,
        location: { latitude: lat, longitude: lon },
        aiSuggestion: {
          department: aiSuggestion.department,
          urgency: aiSuggestion.urgency,
          summary: aiSuggestion.summary
        }
      });
      await newJob.save();
      complaint.job = newJob._id;
    }

    await complaint.save();
    return res.status(201).json(complaint);

  } catch (error: any) {
    console.error('Create complaint error:', error);
    return res.status(500).json({ message: 'Error processing complaint', error: error.message });
  }
};

// Fetch only own complaints (Citizen role-restricted)
export const getCitizenComplaints = async (req: AuthRequest, res: Response) => {
  try {
    const citizenId = req.user?.id;
    const complaints = await Complaint.find({ citizen: citizenId })
      .populate('job')
      .sort({ createdAt: -1 });

    return res.json(complaints);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching complaints', error: error.message });
  }
};

// Fetch a single complaint (IDOR protected)
export const getComplaintById = async (req: AuthRequest, res: Response) => {
  try {
    const { complaintId } = req.params;
    const citizenId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(complaintId)) {
      return res.status(400).json({ message: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(complaintId).populate('job');
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Verify ownership to block IDOR attacks
    if (complaint.citizen.toString() !== citizenId) {
      return res.status(403).json({ message: 'Access forbidden: You do not own this complaint' });
    }

    return res.json(complaint);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching complaint details', error: error.message });
  }
};
