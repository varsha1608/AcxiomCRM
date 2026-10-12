require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const AuditLog = require('../models/AuditLog');
const { hashPassword } = require('../utils/aspnetIdentityHasher');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acxiomcrm';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB');

    // Clear existing data for fresh seed
    await Promise.all([
      User.deleteMany({}),
      Customer.deleteMany({}),
      Lead.deleteMany({}),
      Opportunity.deleteMany({}),
      FollowUp.deleteMany({}),
      Activity.deleteMany({}),
      AuditLog.collection.drop().catch(() => {}) // drop collection safely
    ]);

    console.log('[Seed] Cleared collections');

    // 1. Create or Repair Demo Users idempotently
    const upsertUser = async ({ email, name, role, department, phone, password }) => {
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      const hashedPassword = hashPassword(password);
      if (existing) {
        existing.name = name;
        existing.role = role;
        existing.department = department;
        existing.phone = phone || existing.phone;
        existing.password = hashedPassword;
        existing.isActive = true;
        existing.failedLoginCount = 0;
        existing.lockoutEnd = null;
        await existing.save();
        return existing;
      }
      return await User.create({
        name,
        userName: email.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        department,
        phone: phone || '',
        isActive: true,
        emailConfirmed: true,
        lockoutEnabled: true
      });
    };

    const admin = await upsertUser({
      name: 'Alexander Pierce (Admin)',
      email: 'admin@acxiomcrm.com',
      password: 'Admin@12345',
      role: 'Admin',
      phone: '9876543210',
      department: 'Executive Administration'
    });

    const admin1 = await upsertUser({
      name: 'Varsha Kumari (Admin)',
      email: 'admin1@acxiomcrm.com',
      password: 'Admin@12345',
      role: 'Admin',
      phone: '9334592796',
      department: 'Executive Administration'
    });

    const manager = await upsertUser({
      name: 'Sarah Connor (Manager)',
      email: 'manager@acxiomcrm.com',
      password: 'Manager@12345',
      role: 'Manager',
      phone: '9876543211',
      department: 'Enterprise Sales'
    });

    const salesExec1 = await upsertUser({
      name: 'Marcus Vance (Sales)',
      email: 'sales@acxiomcrm.com',
      password: 'Sales@12345',
      role: 'Sales Executive',
      phone: '9876543212',
      department: 'Inbound Sales'
    });

    const salesExec2 = await upsertUser({
      name: 'Rachel Green (Sales)',
      email: 'rachel@acxiomcrm.com',
      password: 'Sales@12345',
      role: 'Sales Executive',
      phone: '9876543213',
      department: 'SMB Sales'
    });

    console.log('[Seed] Demo users verified and repaired idempotently');

    // 2. Create Customers
    const customers = await Customer.create([
      {
        customerCode: 'CUST-1001',
        customerName: 'Apex Cloud Solutions',
        email: 'billing@apexcloud.io',
        phone: '9812345671',
        companyName: 'Apex Technologies Inc',
        address: '400 Cyber City, Sector 21',
        city: 'Gurugram',
        state: 'Haryana',
        status: 'Active',
        assignedTo: salesExec1._id,
        createdBy: admin._id,
        notes: 'High-tier enterprise client deploying multi-cloud analytics.'
      },
      {
        customerCode: 'CUST-1002',
        customerName: 'BlueSky Logistics',
        email: 'ops@blueskylogistics.com',
        phone: '9812345672',
        companyName: 'BlueSky Transport Ltd',
        address: '88 Harbor Way, Port Terminal',
        city: 'Mumbai',
        state: 'Maharashtra',
        status: 'Active',
        assignedTo: salesExec1._id,
        createdBy: admin._id,
        notes: 'Fleet tracking and warehouse management integration.'
      },
      {
        customerCode: 'CUST-1003',
        customerName: 'Vertex BioPharma',
        email: 'contact@vertexbio.org',
        phone: '9812345673',
        companyName: 'Vertex Therapeutics',
        address: '15 Science Park Drive',
        city: 'Bengaluru',
        state: 'Karnataka',
        status: 'Active',
        assignedTo: salesExec2._id,
        createdBy: manager._id,
        notes: 'Clinical trial records management compliance deal.'
      },
      {
        customerCode: 'CUST-1004',
        customerName: 'Zenith Retail Chain',
        email: 'partners@zenithretail.in',
        phone: '9812345674',
        companyName: 'Zenith Commerce Group',
        address: '22 Fashion Avenue',
        city: 'New Delhi',
        state: 'Delhi',
        status: 'Prospect',
        assignedTo: salesExec2._id,
        createdBy: salesExec2._id,
        notes: 'Evaluating POS integration with our CRM core.'
      },
      {
        customerCode: 'CUST-1005',
        customerName: 'Nova Energy Systems',
        email: 'procure@novaenergy.com',
        phone: '9812345675',
        companyName: 'Nova Solar & Wind Ltd',
        address: '10 Industrial Area, Phase II',
        city: 'Ahmedabad',
        state: 'Gujarat',
        status: 'Inactive',
        assignedTo: salesExec1._id,
        createdBy: manager._id,
        notes: 'Paused procurement due to annual budget cycle.'
      }
    ]);

    console.log('[Seed] Customers created');

    // 3. Create Leads
    const leads = await Lead.create([
      {
        leadCode: 'LEAD-1001',
        leadName: 'David Miller',
        email: 'david.miller@fintechglobal.com',
        phone: '9923456781',
        companyName: 'Fintech Global Services',
        source: 'Website',
        status: 'Qualified',
        priority: 'High',
        expectedValue: 45000,
        assignedTo: salesExec1._id,
        createdBy: manager._id,
        notes: 'Requested product demo for 50-seat CRM deployment.'
      },
      {
        leadCode: 'LEAD-1002',
        leadName: 'Elena Rostova',
        email: 'elena@quantumdata.ai',
        phone: '9923456782',
        companyName: 'Quantum AI Systems',
        source: 'Referral',
        status: 'Contacted',
        priority: 'High',
        expectedValue: 72000,
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id,
        notes: 'Met at SaaSTech 2026 conference. Very interested in API sync.'
      },
      {
        leadCode: 'LEAD-1003',
        leadName: 'Amitabh Sharma',
        email: 'sharma@heritagecrafts.in',
        phone: '9923456783',
        companyName: 'Heritage Crafts Co',
        source: 'Social Media',
        status: 'New',
        priority: 'Medium',
        expectedValue: 18000,
        assignedTo: salesExec2._id,
        createdBy: salesExec2._id,
        notes: 'Downloaded e-commerce conversion whitepaper.'
      },
      {
        leadCode: 'LEAD-1004',
        leadName: 'Sophie Bennett',
        email: 'sophie.b@luminaarchitects.com',
        phone: '9923456784',
        companyName: 'Lumina Architects',
        source: 'Partner',
        status: 'Converted',
        priority: 'High',
        expectedValue: 35000,
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id,
        convertedCustomerId: customers[0]._id,
        notes: 'Converted successfully to Apex Cloud Solutions affiliate.'
      },
      {
        leadCode: 'LEAD-1005',
        leadName: 'Carlos Hernandez',
        email: 'carlos@vanguardrealestate.net',
        phone: '9923456785',
        companyName: 'Vanguard Realty',
        source: 'Cold Call',
        status: 'Lost',
        priority: 'Low',
        expectedValue: 12000,
        assignedTo: salesExec2._id,
        createdBy: salesExec2._id,
        notes: 'Chose a niche real estate proprietary tool.'
      }
    ]);

    console.log('[Seed] Leads created');

    // 4. Create Opportunities
    const now = new Date();
    const oppClose1 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const oppClose2 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const oppClose3 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const opportunities = await Opportunity.create([
      {
        opportunityName: 'Apex Cloud - Annual Enterprise Subscription',
        customerId: customers[0]._id,
        leadId: leads[3]._id,
        amount: 85000,
        stage: 'Negotiation',
        probability: 80,
        expectedCloseDate: oppClose1,
        status: 'Open',
        assignedTo: salesExec1._id,
        createdBy: manager._id,
        notes: 'Reviewing enterprise master services agreement with legal.'
      },
      {
        opportunityName: 'BlueSky Logistics - Fleet CRM Module',
        customerId: customers[1]._id,
        amount: 52000,
        stage: 'Proposal',
        probability: 50,
        expectedCloseDate: oppClose2,
        status: 'Open',
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id,
        notes: 'Submitted RFP proposal on schedule.'
      },
      {
        opportunityName: 'Vertex BioPharma - Compliance Suite Expansion',
        customerId: customers[2]._id,
        amount: 110000,
        stage: 'Won',
        probability: 100,
        expectedCloseDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        status: 'Won',
        assignedTo: salesExec2._id,
        createdBy: manager._id,
        notes: 'Contract signed! Initial payment received.'
      },
      {
        opportunityName: 'Zenith Retail - Omnichannel Pilot',
        customerId: customers[3]._id,
        amount: 28000,
        stage: 'Qualification',
        probability: 25,
        expectedCloseDate: oppClose3,
        status: 'Open',
        assignedTo: salesExec2._id,
        createdBy: salesExec2._id,
        notes: 'Technical discovery session scheduled.'
      },
      {
        opportunityName: 'Nova Energy - Infrastructure Rollout',
        customerId: customers[4]._id,
        amount: 40000,
        stage: 'Lost',
        probability: 0,
        expectedCloseDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        status: 'Lost',
        assignedTo: salesExec1._id,
        createdBy: manager._id,
        notes: 'Budget cancelled by board for this fiscal year.'
      }
    ]);

    console.log('[Seed] Opportunities created');

    // 5. Create Follow-Ups
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    tomorrow.setHours(14, 0, 0, 0);

    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    inThreeDays.setHours(11, 30, 0, 0);

    const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    await FollowUp.create([
      {
        relatedType: 'Customer',
        customerId: customers[0]._id,
        followUpDate: tomorrow,
        followUpType: 'Call',
        subject: 'Review legal terms for Apex Enterprise MSA',
        remarks: 'Discuss clause 8.2 with VP of Engineering.',
        status: 'Planned',
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id
      },
      {
        relatedType: 'Lead',
        leadId: leads[0]._id,
        followUpDate: inThreeDays,
        followUpType: 'Demo',
        subject: 'Deliver 50-Seat Fintech CRM Product Demo',
        remarks: 'Prepare dashboard KPIs slide deck.',
        status: 'Planned',
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id
      },
      {
        relatedType: 'Customer',
        customerId: customers[1]._id,
        followUpDate: yesterday,
        followUpType: 'Meeting',
        subject: 'Finalize Proposal pricing with BlueSky CFO',
        remarks: 'Completed pricing review meeting. Sent updated quote.',
        status: 'Completed',
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id,
        completedAt: yesterday
      },
      {
        relatedType: 'Customer',
        customerId: customers[3]._id,
        followUpDate: inThreeDays,
        followUpType: 'Email',
        subject: 'Send API Architecture Overview to Zenith CTO',
        remarks: 'Share developer portal and webhook specs.',
        status: 'Planned',
        assignedTo: salesExec2._id,
        createdBy: salesExec2._id
      }
    ]);

    console.log('[Seed] Follow-ups created');

    // 6. Create Activities
    await Activity.create([
      {
        activityType: 'Meeting',
        subject: 'Quarterly Executive Review with Apex Cloud',
        description: 'Reviewed adoption metrics and upcoming expansion roadmap.',
        activityDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        customerId: customers[0]._id,
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id,
        status: 'Completed'
      },
      {
        activityType: 'Call',
        subject: 'Introductory Discovery Call with David Miller',
        description: 'Identified core pain points in existing legacy system.',
        activityDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        leadId: leads[0]._id,
        assignedTo: salesExec1._id,
        createdBy: salesExec1._id,
        status: 'Completed'
      },
      {
        activityType: 'Email',
        subject: 'Sent Contract Signoff Notification to Vertex BioPharma',
        description: 'Transmitted final countersigned MSA agreement.',
        activityDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        customerId: customers[2]._id,
        assignedTo: salesExec2._id,
        createdBy: salesExec2._id,
        status: 'Completed'
      },
      {
        activityType: 'Task',
        subject: 'Prepare custom onboarding deck for BlueSky Logistics',
        description: 'Tailor supply-chain integration diagram.',
        activityDate: new Date(),
        customerId: customers[1]._id,
        assignedTo: salesExec1._id,
        createdBy: manager._id,
        status: 'Planned'
      }
    ]);

    console.log('[Seed] Activities created');

    // 7. Create Audit Logs
    await AuditLog.create([
      {
        userId: admin._id,
        userName: admin.name,
        userRole: admin.role,
        action: 'SYSTEM_INITIALIZATION',
        entityName: 'System',
        recordId: 'INIT-001',
        details: 'AcxiomCRM seed database provisioned successfully.',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1'
      },
      {
        userId: admin._id,
        userName: admin.name,
        userRole: admin.role,
        action: 'LOGIN',
        entityName: 'Auth',
        recordId: admin._id.toString(),
        details: 'Admin logged in from local console.',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1'
      },
      {
        userId: salesExec1._id,
        userName: salesExec1.name,
        userRole: salesExec1.role,
        action: 'CREATE',
        entityName: 'Customer',
        recordId: customers[0]._id.toString(),
        details: 'Created customer Apex Cloud Solutions (CUST-1001)',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1'
      },
      {
        userId: manager._id,
        userName: manager.name,
        userRole: manager.role,
        action: 'CONVERT_LEAD',
        entityName: 'Lead',
        recordId: leads[3]._id.toString(),
        details: 'Converted Lead LEAD-1004 to Customer and Opportunity',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1'
      }
    ]);

    console.log('[Seed] Audit Logs created');
    console.log('[Seed] Database seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]', err);
    process.exit(1);
  }
};

seedData();
