import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civic-inbox';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB. Clearing existing users...');

    await User.deleteMany({});

    const passwordHash = await bcrypt.hash('password123', 10);

    const citizen = new User({
      name: 'Sarah Citizen',
      email: 'citizen@example.com',
      password: passwordHash,
      role: 'citizen'
    });

    const admin = new User({
      name: 'Arthur Admin',
      email: 'admin@example.com',
      password: passwordHash,
      role: 'admin'
    });

    const staff = new User({
      name: 'Steve Staff',
      email: 'staff@example.com',
      password: passwordHash,
      role: 'staff',
      department: 'Roads'
    });

    await citizen.save();
    await admin.save();
    await staff.save();

    console.log('✅ Database seeded successfully with 3 users!');
    console.log('------------------------------------------------');
    console.log('1. Citizen Account: citizen@example.com / password123');
    console.log('2. Admin Account:   admin@example.com   / password123');
    console.log('3. Staff Account:   staff@example.com   / password123 (Roads Dept)');
    console.log('------------------------------------------------');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
