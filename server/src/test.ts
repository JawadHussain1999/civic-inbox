import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User';
import Complaint from './models/Complaint';
import Job from './models/Job';
import { getDistanceMeters, getKeywordSimilarity, validateAISuggestion, getLocalFallbackSuggestion } from './services/ai';
import { createComplaint } from './controllers/complaintController';
import { claimJob, updateJob } from './controllers/jobController';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civic-inbox-test';

async function runAuditTests() {
  console.log('\n=========================================');
  console.log('🏁 RUNNING FINAL ENGINEERING AUDIT TESTS');
  console.log('=========================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to test database.');

    // Clear test DB
    await User.deleteMany({});
    await Complaint.deleteMany({});
    await Job.deleteMany({});

    // ----------------------------------------------------
    // TEST 1: User Registration and Password Hash Security
    // ----------------------------------------------------
    console.log('Test 1: User Registration Security');
    const pwdHash = await bcrypt.hash('password123', 10);
    const mockCitizen = new User({
      name: 'Sarah Test Citizen',
      email: 'citizen-test@example.com',
      password: pwdHash,
      role: 'citizen'
    });
    const mockAdmin = new User({
      name: 'Arthur Test Admin',
      email: 'admin-test@example.com',
      password: pwdHash,
      role: 'admin'
    });
    const mockStaffRoads = new User({
      name: 'Steve Roads Crew',
      email: 'staff-roads@example.com',
      password: pwdHash,
      role: 'staff',
      department: 'Roads'
    });
    const mockStaffWater = new User({
      name: 'Wanda Water Crew',
      email: 'staff-water@example.com',
      password: pwdHash,
      role: 'staff',
      department: 'Water'
    });

    await mockCitizen.save();
    await mockAdmin.save();
    await mockStaffRoads.save();
    await mockStaffWater.save();
    console.log('✅ User seeds saved.');

    // ----------------------------------------------------
    // TEST 2: AI Validation Layer
    // ----------------------------------------------------
    console.log('\nTest 2: AI Schema and Value Validation Layer');
    const validRaw = { department: 'Water', urgency: 'urgent', summary: 'Leaking pipe', confidence: 0.9 };
    const invalidDept = { department: 'HACK_DEPARTMENT', urgency: 'urgent', summary: 'Leaking pipe', confidence: 0.9 };
    const invalidConfidence = { department: 'Water', urgency: 'urgent', summary: 'Leaking pipe', confidence: 1.5 };
    
    const val1 = validateAISuggestion(validRaw);
    const val2 = validateAISuggestion(invalidDept);
    const val3 = validateAISuggestion(invalidConfidence);

    if (val1 && !val2 && !val3) {
      console.log('✅ AI Validation Layer passed.');
    } else {
      console.error('❌ AI Validation Layer failed.', { val1, val2, val3 });
    }

    // ----------------------------------------------------
    // TEST 3: Configurable Distance & Jaccard Lexical Similarity
    // ----------------------------------------------------
    console.log('\nTest 3: Lexical Similarity & Configurable Proximity Grouping');
    const sim1 = getKeywordSimilarity('large pothole near the school bus stop', 'pothole road damage near the bus stop');
    const sim2 = getKeywordSimilarity('broken street light lamp', 'water leak pipe flooding');
    console.log(`- Similarity (Similar): ${(sim1 * 100).toFixed(1)}%`);
    console.log(`- Similarity (Different): ${(sim2 * 100).toFixed(1)}%`);
    
    if (sim1 > 0.4 && sim2 === 0) {
      console.log('✅ Lexical Synonym similarity passed.');
    } else {
      console.error('❌ Lexical similarity failed.');
    }

    // ----------------------------------------------------
    // TEST 4: Human Corrections Locking & Urgency Escalation
    // ----------------------------------------------------
    console.log('\nTest 4: Human Override lock and Urgency Escalation');
    
    const initialJob = new Job({
      complaints: [],
      department: 'Roads',
      urgency: 'routine',
      summary: 'Initial pothole repair',
      location: { latitude: 40.7580, longitude: -73.9855 }
    });
    await initialJob.save();

    // Admin updates the job
    const reqMockAdmin: any = {
      user: { id: mockAdmin._id.toString(), role: 'admin' },
      params: { jobId: initialJob._id.toString() },
      body: { department: 'Parks', urgency: 'routine', summary: 'New park summary' }
    };
    let updatedResData: any = null;
    const resMock: any = {
      json: (data: any) => { updatedResData = data; },
      status: (code: number) => ({ json: (d: any) => { console.error('Status override err:', d); } })
    };
    
    await updateJob(reqMockAdmin, resMock);

    // Verify admin locks are preserved
    if (updatedResData && updatedResData.humanCorrection.department === 'Parks') {
      console.log('✅ Human Override department locked.');
    } else {
      console.error('❌ Human Override lock failed.');
    }

    // Verify urgency escalation upgrades it
    const reqMockComplaint: any = {
      user: { id: mockCitizen._id.toString(), role: 'citizen' },
      body: {
        description: 'Dangerous tree branch falling down in the park emergency',
        latitude: 40.7581,
        longitude: -73.9854
      }
    };
    let complaintResData: any = null;
    const resMockComplaint: any = {
      status: (code: number) => ({
        json: (data: any) => { complaintResData = data; }
      }),
      json: (data: any) => { complaintResData = data; }
    };

    await createComplaint(reqMockComplaint, resMockComplaint);
    
    const escalatedJob = await Job.findById(initialJob._id);
    if (escalatedJob && escalatedJob.urgency === 'emergency') {
      console.log('✅ Job Urgency Escalated correctly to Emergency.');
    } else {
      console.error('❌ Job Urgency Escalation failed. Current:', escalatedJob?.urgency);
    }
    
    // Ensure admin overridden department 'Parks' is preserved after AI processing
    if (escalatedJob && escalatedJob.department === 'Parks') {
      console.log('✅ Human corrected department remains locked as Parks.');
    } else {
      console.error('❌ Human corrected department overwritten by new AI suggestion. Current:', escalatedJob?.department);
    }

    // ----------------------------------------------------
    // TEST 5: Atomic Claiming Concurrency (Race Condition Test)
    // ----------------------------------------------------
    console.log('\nTest 5: Concurrent Claim Race Condition Protection');
    const claimJobObj = new Job({
      complaints: [],
      department: 'Roads',
      urgency: 'routine',
      summary: 'Race condition test work order',
      status: 'unassigned',
      location: { latitude: 40.7580, longitude: -73.9855 }
    });
    await claimJobObj.save();

    // Simulate two staff members claiming the same job simultaneously
    const claimPromise1 = claimJob({
      user: { id: mockStaffRoads._id.toString(), role: 'staff', department: 'Roads' },
      params: { jobId: claimJobObj._id.toString() }
    } as any, {
      json: (data: any) => data,
      status: (code: number) => ({ json: (d: any) => ({ code, data: d }) })
    } as any);

    const claimPromise2 = claimJob({
      user: { id: mockStaffRoads._id.toString(), role: 'staff', department: 'Roads' },
      params: { jobId: claimJobObj._id.toString() }
    } as any, {
      json: (data: any) => data,
      status: (code: number) => ({ json: (d: any) => ({ code, data: d }) })
    } as any);

    const [res1, res2] = await Promise.all([claimPromise1, claimPromise2]);

    // One must succeed (returns job object with status 'claimed')
    // One must return conflict (returns status 409)
    const successResult = (res1 && (res1 as any).status === 'claimed') || (res2 && (res2 as any).status === 'claimed');
    const conflictResult = (res1 && (res1 as any).code === 409) || (res2 && (res2 as any).code === 409);

    if (successResult && conflictResult) {
      console.log('✅ Race Condition test passed. 1 claimed successfully, 1 returned 409 conflict.');
    } else {
      console.error('❌ Race Condition test failed.', { res1, res2 });
    }

    // ----------------------------------------------------
    // TEST 6: Authorization & Department Isolation
    // ----------------------------------------------------
    console.log('\nTest 6: Department Isolation and Authorization');
    const waterJob = new Job({
      complaints: [],
      department: 'Water',
      urgency: 'routine',
      summary: 'Water main leak',
      status: 'unassigned',
      location: { latitude: 40.7580, longitude: -73.9855 }
    });
    await waterJob.save();

    // Staff from Roads tries to claim Water job
    let claimIsolationRes: any = null;
    const resMockStaff: any = {
      status: (code: number) => ({
        json: (data: any) => { claimIsolationRes = { code, data }; }
      }),
      json: (data: any) => { claimIsolationRes = { code: 200, data }; }
    };

    await claimJob({
      user: { id: mockStaffRoads._id.toString(), role: 'staff', department: 'Roads' },
      params: { jobId: waterJob._id.toString() }
    } as any, resMockStaff);

    if (claimIsolationRes && claimIsolationRes.code === 409) {
      console.log('✅ Department Isolation passed: Roads crew blocked from claiming Water job.');
    } else {
      console.error('❌ Department Isolation failed.', claimIsolationRes);
    }

  } catch (err: any) {
    console.error('Test Execution Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n=========================================');
    console.log('🏁 TEST RUNS COMPLETE');
    console.log('=========================================\n');
  }
}

runAuditTests();
