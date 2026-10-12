require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { hashPassword } = require('../utils/aspnetIdentityHasher');

async function repairDemoUsers() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acxiomcrm';
  await mongoose.connect(mongoUri);
  console.log('[Repair] Connected to MongoDB');

  const demoAccounts = [
    {
      email: 'admin@acxiomcrm.com',
      name: 'Alexander Pierce (Admin)',
      role: 'Admin',
      department: 'Executive Administration',
      phone: '9876543210',
      password: 'Admin@12345'
    },
    {
      email: 'admin1@acxiomcrm.com',
      name: 'Varsha Kumari (Admin)',
      role: 'Admin',
      department: 'Executive Administration',
      phone: '9334592796',
      password: 'Admin@12345'
    },
    {
      email: 'manager@acxiomcrm.com',
      name: 'Sarah Connor (Manager)',
      role: 'Manager',
      department: 'Enterprise Sales',
      phone: '9876543211',
      password: 'Manager@12345'
    },
    {
      email: 'sales@acxiomcrm.com',
      name: 'Marcus Vance (Sales)',
      role: 'Sales Executive',
      department: 'Inbound Sales',
      phone: '9876543212',
      password: 'Sales@12345'
    }
  ];

  for (const acc of demoAccounts) {
    const existing = await User.findOne({ email: acc.email });
    const hashedPassword = hashPassword(acc.password);

    if (existing) {
      existing.name = acc.name;
      existing.role = acc.role;
      existing.department = acc.department;
      existing.phone = acc.phone;
      existing.password = hashedPassword;
      existing.isActive = true;
      existing.failedLoginCount = 0;
      existing.lockoutEnd = null;
      await existing.save();
      console.log(`[Repair] Updated existing user: ${acc.email} -> Role: ${acc.role}, Name: ${acc.name}`);
    } else {
      await User.create({
        name: acc.name,
        userName: acc.email,
        email: acc.email,
        password: hashedPassword,
        role: acc.role,
        department: acc.department,
        phone: acc.phone,
        isActive: true,
        emailConfirmed: true,
        lockoutEnabled: true
      });
      console.log(`[Repair] Created demo user: ${acc.email} -> Role: ${acc.role}`);
    }
  }

  console.log('[Repair] All demo users successfully verified and repaired.');
  process.exit(0);
}

repairDemoUsers().catch((err) => {
  console.error('[Repair Error]', err);
  process.exit(1);
});
