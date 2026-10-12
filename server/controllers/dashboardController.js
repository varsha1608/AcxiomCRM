const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const User = require('../models/User');

const buildRoleFilter = (user) => {
  if (user.role === 'Admin' || user.role === 'Manager') {
    return {};
  }
  return {
    $or: [{ assignedTo: user._id }, { createdBy: user._id }]
  };
};

const getDateFilter = (timeframe, startDate, endDate) => {
  if (startDate || endDate) {
    const range = {};
    if (startDate) range.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    return { createdAt: range };
  }
  const now = new Date();
  if (timeframe === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { createdAt: { $gte: start } };
  }
  if (timeframe === 'this_week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { createdAt: { $gte: start } };
  }
  if (timeframe === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { createdAt: { $gte: start } };
  }
  return {};
};

// @desc    Get dashboard metrics & chart data
// @route   GET /api/dashboard
// @access  Authenticated
const getDashboardData = async (req, res, next) => {
  try {
    const { timeframe = 'all', startDate, endDate } = req.query;
    const roleFilter = buildRoleFilter(req.user);
    const dateFilter = getDateFilter(timeframe, startDate, endDate);

    const mergedFilter = { ...roleFilter, ...dateFilter };

    // Customers Count
    const totalCustomers = await Customer.countDocuments(mergedFilter);

    // Leads Counts
    const totalLeads = await Lead.countDocuments(mergedFilter);
    const openLeads = await Lead.countDocuments({
      ...mergedFilter,
      status: { $in: ['New', 'Contacted', 'Qualified'] }
    });

    // Opportunities Counts
    const totalOpportunities = await Opportunity.countDocuments(mergedFilter);
    const openOpportunities = await Opportunity.countDocuments({
      ...mergedFilter,
      status: 'Open'
    });
    const wonOpportunities = await Opportunity.countDocuments({
      ...mergedFilter,
      status: 'Won'
    });
    const lostOpportunities = await Opportunity.countDocuments({
      ...mergedFilter,
      status: 'Lost'
    });

    // Pipeline Value & Weighted Pipeline
    const openOpps = await Opportunity.find({
      ...mergedFilter,
      status: 'Open'
    }).select('amount probability');

    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;

    openOpps.forEach((opp) => {
      const amt = opp.amount || 0;
      totalPipelineValue += amt;
      weightedPipelineValue += (amt * (opp.probability || 0)) / 100;
    });

    const wonOpps = await Opportunity.find({
      ...mergedFilter,
      status: 'Won'
    }).select('amount');

    const totalWonRevenue = wonOpps.reduce((sum, o) => sum + (o.amount || 0), 0);

    // Pending Follow-Ups
    const pendingFollowUps = await FollowUp.countDocuments({
      ...roleFilter,
      status: 'Planned'
    });

    // Lead Status breakdown
    const leadStatuses = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
    const leadStatusCounts = {};
    for (const st of leadStatuses) {
      leadStatusCounts[st] = await Lead.countDocuments({ ...mergedFilter, status: st });
    }

    // Opportunity Stages breakdown
    const oppStages = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
    const oppStageData = {};
    for (const st of oppStages) {
      const count = await Opportunity.countDocuments({ ...mergedFilter, stage: st });
      const records = await Opportunity.find({ ...mergedFilter, stage: st }).select('amount');
      const val = records.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      oppStageData[st] = { count, value: val };
    }

    // Monthly Sales / Outcome Trend (Last 6 Months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySales = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthWon = await Opportunity.find({
        ...roleFilter,
        status: 'Won',
        updatedAt: { $gte: start, $lte: end }
      }).select('amount');

      const monthCreated = await Opportunity.find({
        ...roleFilter,
        createdAt: { $gte: start, $lte: end }
      }).select('amount');

      monthlySales.push({
        month: monthNames[start.getMonth()] + ' ' + start.getFullYear().toString().slice(-2),
        wonRevenue: monthWon.reduce((s, o) => s + (o.amount || 0), 0),
        wonCount: monthWon.length,
        pipelineAdded: monthCreated.reduce((s, o) => s + (o.amount || 0), 0)
      });
    }

    // Recent Activities (Latest 5)
    const recentActivities = await Activity.find(roleFilter)
      .populate('assignedTo', 'name email')
      .populate('customerId', 'customerName')
      .populate('leadId', 'leadName')
      .sort({ activityDate: -1 })
      .limit(5);

    // Upcoming Follow-ups (Next 5)
    const upcomingFollowUps = await FollowUp.find({
      ...roleFilter,
      status: 'Planned',
      followUpDate: { $gte: new Date() }
    })
      .populate('customerId', 'customerName phone')
      .populate('leadId', 'leadName phone')
      .populate('assignedTo', 'name')
      .sort({ followUpDate: 1 })
      .limit(5);

    // Security/Admin Extra Stats if Admin
    let adminStats = null;
    if (req.user.role === 'Admin') {
      const activeUsers = await User.countDocuments({ isActive: true });
      const lockedUsers = await User.countDocuments({ lockoutEnd: { $gt: new Date() } });
      adminStats = {
        totalUsers: await User.countDocuments(),
        activeUsers,
        lockedUsers
      };
    }

    res.json({
      success: true,
      kpis: {
        totalCustomers,
        totalLeads,
        openLeads,
        totalOpportunities,
        openOpportunities,
        wonOpportunities,
        lostOpportunities,
        totalPipelineValue,
        weightedPipelineValue: Math.round(weightedPipelineValue),
        totalWonRevenue,
        pendingFollowUps
      },
      charts: {
        leadStatus: leadStatusCounts,
        opportunityPipeline: oppStageData,
        monthlySales
      },
      recentActivities,
      upcomingFollowUps,
      adminStats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardData };
