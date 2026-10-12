const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const FollowUp = require('../models/FollowUp');
const Activity = require('../models/Activity');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// Build query filter based on role and optional assignedTo query parameter
const buildRoleFilter = (user, requestedAssignedTo) => {
  if (user.role === 'Admin' || user.role === 'Manager') {
    if (requestedAssignedTo && requestedAssignedTo !== 'All') {
      return { assignedTo: requestedAssignedTo };
    }
    return {};
  }
  // Sales Executive is strictly scoped to assigned or created records
  return {
    $or: [{ assignedTo: user._id }, { createdBy: user._id }]
  };
};

// Helper to paginate and sort an array of records
const paginateAndSort = (items, pageQuery = 1, limitQuery = 10, sortBy, sortOrder = 'desc', isExport = false) => {
  let sortedItems = [...items];

  if (sortBy) {
    sortedItems.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle numbers or strings with currency / percentage
      if (typeof valA === 'string' && valA.endsWith('%')) valA = parseFloat(valA);
      if (typeof valB === 'string' && valB.endsWith('%')) valB = parseFloat(valB);

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalRecords = sortedItems.length;

  if (isExport) {
    return {
      pagedData: sortedItems,
      pagination: {
        page: 1,
        limit: totalRecords,
        totalRecords,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    };
  }

  const page = Math.max(1, parseInt(pageQuery, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 10));
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const startIndex = (page - 1) * limit;
  const pagedData = sortedItems.slice(startIndex, startIndex + limit);

  return {
    pagedData,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// @desc    Get comprehensive reports based on type (All 8 Core Reports)
// @route   GET /api/reports/:reportType
// @access  Authenticated
const getReportData = async (req, res, next) => {
  try {
    const { reportType } = req.params;
    const {
      search,
      status,
      stage,
      source,
      priority,
      type: followUpTypeParam,
      assignedTo,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
      export: exportParam,
      all
    } = req.query;

    const isExport = exportParam === 'true' || exportParam === 'csv' || all === 'true' || parseInt(limit, 10) >= 1000;
    const roleFilter = buildRoleFilter(req.user, assignedTo);

    switch (reportType) {
      // 1. Sales Pipeline Report (Stage-wise and Owner-wise breakdown, weighted pipeline)
      case 'pipeline': {
        const queryFilter = { ...roleFilter };

        if (stage && stage !== 'All') {
          queryFilter.stage = stage;
        }
        if (status && status !== 'All') {
          queryFilter.status = status;
        }

        // Date range filtering on expectedCloseDate
        if (startDate || endDate) {
          queryFilter.expectedCloseDate = {};
          if (startDate) queryFilter.expectedCloseDate.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.expectedCloseDate.$lte = end;
          }
        }

        const opportunities = await Opportunity.find(queryFilter)
          .populate('customerId', 'customerName customerCode')
          .populate('assignedTo', 'name email')
          .sort({ amount: -1 });

        const stageSummary = {};
        const ownerSummary = {};
        let totalPipeline = 0;
        let weightedPipeline = 0;

        let flattenedData = opportunities.map((opp) => {
          const currentStage = opp.stage || 'Unassigned';
          const ownerName = opp.assignedTo?.name || 'Unassigned';
          const customerName = opp.customerId?.customerName || 'Unassigned';
          const amt = opp.amount || 0;
          const weighted = (amt * (opp.probability || 0)) / 100;

          if (!stageSummary[currentStage]) stageSummary[currentStage] = { count: 0, totalAmount: 0 };
          stageSummary[currentStage].count += 1;
          stageSummary[currentStage].totalAmount += amt;

          if (!ownerSummary[ownerName]) ownerSummary[ownerName] = { count: 0, totalAmount: 0 };
          ownerSummary[ownerName].count += 1;
          ownerSummary[ownerName].totalAmount += amt;

          if (opp.status === 'Open') {
            totalPipeline += amt;
            weightedPipeline += weighted;
          }

          return {
            opportunityName: opp.opportunityName,
            customerName,
            amount: opp.amount,
            stage: opp.stage,
            probability: `${opp.probability}%`,
            weightedAmount: Math.round(weighted),
            expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().split('T')[0] : '—',
            status: opp.status,
            ownerName
          };
        });

        // Search text filtering
        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          flattenedData = flattenedData.filter(
            (item) =>
              item.opportunityName.toLowerCase().includes(term) ||
              item.customerName.toLowerCase().includes(term) ||
              item.ownerName.toLowerCase().includes(term) ||
              item.stage.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          flattenedData,
          page,
          limit,
          sortBy || 'amount',
          sortOrder || 'desc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'Sales Pipeline Report',
          summary: {
            totalDeals: opportunities.length,
            totalOpenPipeline: totalPipeline,
            weightedOpenPipeline: Math.round(weightedPipeline),
            stageSummary,
            ownerSummary
          },
          data: pagedData,
          pagination
        });
      }

      // 2. Opportunity Report (Stage, amount, probability, expected close date)
      case 'opportunities': {
        const queryFilter = { ...roleFilter };

        if (stage && stage !== 'All') {
          queryFilter.stage = stage;
        }
        if (status && status !== 'All') {
          queryFilter.status = status;
        }

        if (startDate || endDate) {
          queryFilter.expectedCloseDate = {};
          if (startDate) queryFilter.expectedCloseDate.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.expectedCloseDate.$lte = end;
          }
        }

        const opportunities = await Opportunity.find(queryFilter)
          .populate('customerId', 'customerName')
          .populate('assignedTo', 'name email')
          .sort({ expectedCloseDate: 1 });

        let totalOpportunityAmount = 0;
        const stageCounts = {};

        let flattenedData = opportunities.map((opp) => {
          totalOpportunityAmount += opp.amount || 0;
          stageCounts[opp.stage] = (stageCounts[opp.stage] || 0) + 1;
          const weighted = ((opp.amount || 0) * (opp.probability || 0)) / 100;

          return {
            opportunityName: opp.opportunityName,
            customer: opp.customerId?.customerName || '—',
            stage: opp.stage,
            amount: opp.amount,
            probability: `${opp.probability}%`,
            weightedValue: Math.round(weighted),
            expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString().split('T')[0] : '—',
            status: opp.status,
            assignedUser: opp.assignedTo?.name || 'Unassigned'
          };
        });

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          flattenedData = flattenedData.filter(
            (item) =>
              item.opportunityName.toLowerCase().includes(term) ||
              item.customer.toLowerCase().includes(term) ||
              item.stage.toLowerCase().includes(term) ||
              item.assignedUser.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          flattenedData,
          page,
          limit,
          sortBy || 'expectedCloseDate',
          sortOrder || 'asc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'Opportunity Report',
          summary: {
            totalOpportunities: opportunities.length,
            totalOpportunityAmount,
            stageCounts
          },
          data: pagedData,
          pagination
        });
      }

      // 3. Customer Report (Customer list, status, owner, created date)
      case 'customers': {
        const queryFilter = { ...roleFilter };

        if (status && status !== 'All') {
          queryFilter.status = status;
        }

        if (startDate || endDate) {
          queryFilter.createdAt = {};
          if (startDate) queryFilter.createdAt.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.createdAt.$lte = end;
          }
        }

        const customers = await Customer.find(queryFilter)
          .populate('assignedTo', 'name email')
          .sort({ createdAt: -1 });

        const statusCounts = {};
        let flattenedData = customers.map((c) => {
          statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
          return {
            customerCode: c.customerCode,
            customerName: c.customerName,
            email: c.email,
            phone: c.phone,
            companyName: c.companyName || '—',
            city: c.city || '—',
            state: c.state || '—',
            status: c.status,
            assignedOwner: c.assignedTo?.name || 'Unassigned',
            createdDate: new Date(c.createdAt).toISOString().split('T')[0]
          };
        });

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          flattenedData = flattenedData.filter(
            (item) =>
              item.customerName.toLowerCase().includes(term) ||
              item.customerCode.toLowerCase().includes(term) ||
              item.email.toLowerCase().includes(term) ||
              item.companyName.toLowerCase().includes(term) ||
              item.assignedOwner.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          flattenedData,
          page,
          limit,
          sortBy || 'createdDate',
          sortOrder || 'desc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'Customer Report',
          summary: {
            totalCustomers: customers.length,
            statusCounts
          },
          data: pagedData,
          pagination
        });
      }

      // 4. Lead Report (Source, status, owner, conversion info)
      case 'leads': {
        const queryFilter = { ...roleFilter };

        if (status && status !== 'All') {
          queryFilter.status = status;
        }
        if (source && source !== 'All') {
          queryFilter.source = source;
        }
        if (priority && priority !== 'All') {
          queryFilter.priority = priority;
        }

        if (startDate || endDate) {
          queryFilter.createdAt = {};
          if (startDate) queryFilter.createdAt.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.createdAt.$lte = end;
          }
        }

        const leads = await Lead.find(queryFilter)
          .populate('assignedTo', 'name email')
          .populate('convertedCustomerId', 'customerCode customerName')
          .sort({ createdAt: -1 });

        const statusCounts = {};
        const sourceCounts = {};
        let totalExpectedValue = 0;

        let flattenedData = leads.map((l) => {
          statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
          sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
          totalExpectedValue += l.expectedValue || 0;

          return {
            leadCode: l.leadCode,
            leadName: l.leadName,
            email: l.email,
            phone: l.phone,
            companyName: l.companyName || '—',
            source: l.source,
            status: l.status,
            priority: l.priority,
            expectedValue: l.expectedValue || 0,
            assignedOwner: l.assignedTo?.name || 'Unassigned',
            convertedCustomer: l.convertedCustomerId?.customerName || 'Not Converted',
            createdDate: new Date(l.createdAt).toISOString().split('T')[0]
          };
        });

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          flattenedData = flattenedData.filter(
            (item) =>
              item.leadName.toLowerCase().includes(term) ||
              item.leadCode.toLowerCase().includes(term) ||
              item.email.toLowerCase().includes(term) ||
              item.source.toLowerCase().includes(term) ||
              item.assignedOwner.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          flattenedData,
          page,
          limit,
          sortBy || 'createdDate',
          sortOrder || 'desc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'Lead Report',
          summary: {
            totalLeads: leads.length,
            totalExpectedValue,
            statusCounts,
            sourceCounts
          },
          data: pagedData,
          pagination
        });
      }

      // 5. Follow-Up Report (Planned, completed, missed, overdue)
      case 'followups': {
        const queryFilter = { ...roleFilter };

        if (status && status !== 'All') {
          queryFilter.status = status;
        }
        if (followUpTypeParam && followUpTypeParam !== 'All') {
          queryFilter.followUpType = followUpTypeParam;
        }

        if (startDate || endDate) {
          queryFilter.followUpDate = {};
          if (startDate) queryFilter.followUpDate.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.followUpDate.$lte = end;
          }
        }

        const followUps = await FollowUp.find(queryFilter)
          .populate('customerId', 'customerName')
          .populate('leadId', 'leadName')
          .populate('assignedTo', 'name')
          .sort({ followUpDate: 1 });

        const now = new Date();
        const statusSummary = {
          Planned: 0,
          Completed: 0,
          Missed: 0,
          Cancelled: 0,
          Overdue: 0
        };

        let flattenedData = followUps.map((f) => {
          if (statusSummary[f.status] !== undefined) {
            statusSummary[f.status] += 1;
          }
          const isOverdue = f.status === 'Planned' && new Date(f.followUpDate) < now;
          if (isOverdue) {
            statusSummary.Overdue += 1;
          }

          return {
            subject: f.subject,
            relatedType: f.relatedType,
            relatedEntity: f.relatedType === 'Customer' ? (f.customerId?.customerName || 'General') : (f.leadId?.leadName || 'General'),
            followUpType: f.followUpType,
            followUpDate: new Date(f.followUpDate).toISOString().replace('T', ' ').slice(0, 16),
            status: isOverdue ? 'Overdue (Planned)' : f.status,
            assignedUser: f.assignedTo?.name || 'Unassigned',
            remarks: f.remarks || '—'
          };
        });

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          flattenedData = flattenedData.filter(
            (item) =>
              item.subject.toLowerCase().includes(term) ||
              item.relatedEntity.toLowerCase().includes(term) ||
              item.assignedUser.toLowerCase().includes(term) ||
              item.status.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          flattenedData,
          page,
          limit,
          sortBy || 'followUpDate',
          sortOrder || 'asc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'Follow-Up Report',
          summary: statusSummary,
          data: pagedData,
          pagination
        });
      }

      // 6. Sales/Conversion Report (Lead conversion and opportunity outcome metrics)
      case 'conversion': {
        const queryFilter = { ...roleFilter };

        if (startDate || endDate) {
          queryFilter.createdAt = {};
          if (startDate) queryFilter.createdAt.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            queryFilter.createdAt.$lte = end;
          }
        }

        const totalLeads = await Lead.countDocuments(queryFilter);
        const convertedLeads = await Lead.countDocuments({ ...queryFilter, status: 'Converted' });
        const wonOpps = await Opportunity.countDocuments({ ...queryFilter, status: 'Won' });
        const lostOpps = await Opportunity.countDocuments({ ...queryFilter, status: 'Lost' });
        const openOpps = await Opportunity.countDocuments({ ...queryFilter, status: 'Open' });
        const totalClosedOpps = wonOpps + lostOpps;

        const leadConversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;
        const winRate = totalClosedOpps > 0 ? ((wonOpps / totalClosedOpps) * 100).toFixed(1) : 0;

        const conversionRows = [
          { Metric: 'Total Leads Captured', Count: totalLeads, Ratio: '100%' },
          { Metric: 'Converted Leads', Count: convertedLeads, Ratio: `${leadConversionRate}%` },
          { Metric: 'Open Opportunities', Count: openOpps, Ratio: '—' },
          { Metric: 'Closed Won Deals', Count: wonOpps, Ratio: `${winRate}% of closed` },
          { Metric: 'Closed Lost Deals', Count: lostOpps, Ratio: `${(100 - parseFloat(winRate)).toFixed(1)}% of closed` }
        ];

        return res.json({
          success: true,
          reportType: 'Sales & Conversion Report',
          summary: {
            totalLeads,
            convertedLeads,
            leadConversionRate: `${leadConversionRate}%`,
            wonOpportunities: wonOpps,
            lostOpportunities: lostOpps,
            opportunityWinRate: `${winRate}%`
          },
          data: conversionRows,
          pagination: {
            page: 1,
            limit: conversionRows.length,
            totalRecords: conversionRows.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        });
      }

      // 7. User Activity Report (User actions and activity counts - Manager and Admin only)
      case 'user-activity': {
        if (req.user.role === 'Sales Executive') {
          return res.status(403).json({
            success: false,
            message: 'User Activity reports are restricted to Managers and Administrators'
          });
        }

        const userFilter = { isActive: true };
        if (assignedTo && assignedTo !== 'All') {
          userFilter._id = assignedTo;
        }

        const users = await User.find(userFilter).select('name email role department');
        let userActivityStats = [];

        for (const u of users) {
          const actQuery = { assignedTo: u._id };
          const oppQuery = { assignedTo: u._id };
          const fuQuery = { assignedTo: u._id };
          const custQuery = { assignedTo: u._id };
          const leadQuery = { assignedTo: u._id };

          if (startDate || endDate) {
            const dateQ = {};
            if (startDate) dateQ.$gte = new Date(startDate);
            if (endDate) {
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              dateQ.$lte = end;
            }
            actQuery.createdAt = dateQ;
            oppQuery.createdAt = dateQ;
            fuQuery.createdAt = dateQ;
            custQuery.createdAt = dateQ;
            leadQuery.createdAt = dateQ;
          }

          const actCount = await Activity.countDocuments(actQuery);
          const oppCount = await Opportunity.countDocuments(oppQuery);
          const followUpCount = await FollowUp.countDocuments(fuQuery);
          const custCount = await Customer.countDocuments(custQuery);
          const leadCount = await Lead.countDocuments(leadQuery);

          userActivityStats.push({
            userName: u.name,
            email: u.email,
            role: u.role,
            department: u.department || 'Sales',
            loggedActivities: actCount,
            assignedCustomers: custCount,
            assignedLeads: leadCount,
            assignedOpportunities: oppCount,
            assignedFollowUps: followUpCount
          });
        }

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          userActivityStats = userActivityStats.filter(
            (item) =>
              item.userName.toLowerCase().includes(term) ||
              item.email.toLowerCase().includes(term) ||
              item.role.toLowerCase().includes(term) ||
              item.department.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          userActivityStats,
          page,
          limit,
          sortBy || 'loggedActivities',
          sortOrder || 'desc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'User Activity Report',
          summary: {
            activeUsers: users.length,
            totalActivities: userActivityStats.reduce((acc, curr) => acc + curr.loggedActivities, 0)
          },
          data: pagedData,
          pagination
        });
      }

      // 8. Audit Report (Security & business audit events - Admin only)
      case 'audit': {
        if (req.user.role !== 'Admin') {
          return res.status(403).json({
            success: false,
            message: 'Audit reports are restricted to Administrators only'
          });
        }

        const auditQuery = {};
        if (status && status !== 'All') {
          auditQuery.result = status;
        }

        if (startDate || endDate) {
          auditQuery.createdAt = {};
          if (startDate) auditQuery.createdAt.$gte = new Date(startDate);
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            auditQuery.createdAt.$lte = end;
          }
        }

        const totalEvents = await AuditLog.countDocuments(auditQuery);
        const failedEvents = await AuditLog.countDocuments({ ...auditQuery, result: 'FAILED' });
        const loginEvents = await AuditLog.countDocuments({ ...auditQuery, action: 'LOGIN' });
        const securityEvents = await AuditLog.countDocuments({
          ...auditQuery,
          action: { $in: ['LOCKOUT', 'FAILED_LOGIN', 'UNLOCK', 'PASSWORD_RESET'] }
        });

        const allLogs = await AuditLog.find(auditQuery).sort({ createdAt: -1 });

        let flattenedData = allLogs.map((log) => ({
          timestamp: new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19),
          userName: log.userName,
          userRole: log.userRole,
          action: log.action,
          entityName: log.entityName,
          result: log.result,
          details: log.details || '—',
          ipAddress: log.ipAddress || '127.0.0.1'
        }));

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          flattenedData = flattenedData.filter(
            (item) =>
              item.userName.toLowerCase().includes(term) ||
              item.action.toLowerCase().includes(term) ||
              item.entityName.toLowerCase().includes(term) ||
              item.details.toLowerCase().includes(term) ||
              item.ipAddress.toLowerCase().includes(term)
          );
        }

        const { pagedData, pagination } = paginateAndSort(
          flattenedData,
          page,
          limit,
          sortBy || 'timestamp',
          sortOrder || 'desc',
          isExport
        );

        return res.json({
          success: true,
          reportType: 'Security & Audit Report',
          summary: {
            totalEvents,
            failedEvents,
            loginEvents,
            securityEvents
          },
          data: pagedData,
          pagination
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown report type: ${reportType}`
        });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getReportData };
