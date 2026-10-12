import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import {
  Download,
  Filter,
  TrendingUp,
  Users,
  Target,
  Calendar,
  ShieldAlert,
  Award,
  Layers,
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

const Reports = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [selectedReport, setSelectedReport] = useState('pipeline');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination & Sorting state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Core Reports list based on role
  const reportTabs = [
    { id: 'pipeline', name: '1. Pipeline Report', icon: Layers },
    { id: 'opportunities', name: '2. Opportunity Report', icon: Target },
    { id: 'customers', name: '3. Customer Report', icon: Users },
    { id: 'leads', name: '4. Lead Report', icon: Users },
    { id: 'followups', name: '5. Follow-Up Report', icon: Calendar },
    { id: 'conversion', name: '6. Conversion & Win Rate', icon: TrendingUp }
  ];

  if (isAdmin || isManager) {
    reportTabs.push({ id: 'user-activity', name: '7. User Activity Report', icon: Award });
  }

  if (isAdmin) {
    reportTabs.push({ id: 'audit', name: '8. Security & Audit Report', icon: ShieldAlert });
  }

  // Load assignable users for dropdown filter (Admin & Manager)
  useEffect(() => {
    if (isAdmin || isManager) {
      api.get('/users/assignable')
        .then((res) => {
          if (res.data?.success) {
            setAssignableUsers(res.data.data || []);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, isManager]);

  // Reset filters when changing active report tab
  const handleTabChange = (reportId) => {
    setSelectedReport(reportId);
    setSearch('');
    setStatusFilter('');
    setAssignedToFilter('');
    setStartDate('');
    setEndDate('');
    setSortBy('');
    setSortOrder('desc');
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setAssignedToFilter('');
    setStartDate('');
    setEndDate('');
    setSortBy('');
    setSortOrder('desc');
    setPage(1);
  };

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter, stage: statusFilter } : {}),
        ...(assignedToFilter ? { assignedTo: assignedToFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(sortBy ? { sortBy, sortOrder } : {})
      };

      const res = await api.get(`/reports/${selectedReport}`, { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedReport, page, limit, search, statusFilter, assignedToFilter, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Export filtered dataset to CSV
  const exportToCSV = async () => {
    try {
      setExporting(true);
      const params = {
        export: 'csv',
        all: 'true',
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter, stage: statusFilter } : {}),
        ...(assignedToFilter ? { assignedTo: assignedToFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(sortBy ? { sortBy, sortOrder } : {})
      };

      const res = await api.get(`/reports/${selectedReport}`, { params });
      const items = res.data?.data;

      if (!items || !Array.isArray(items) || items.length === 0) {
        alert('No data matching the active filters to export.');
        return;
      }

      const replacer = (key, value) => (value === null ? '' : value);
      const header = Object.keys(items[0]).filter(
        (k) => typeof items[0][k] !== 'object' && !k.startsWith('_')
      );

      const csv = [
        header.map((h) => h.replace(/([A-Z])/g, ' $1').toUpperCase()).join(','),
        ...items.map((row) =>
          header
            .map((fieldName) => JSON.stringify(row[fieldName] ?? '', replacer))
            .join(',')
        )
      ].join('\r\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `AcxiomCRM_${selectedReport}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export CSV report.');
    } finally {
      setExporting(false);
    }
  };

  // Determine available status options based on current report
  const getStatusOptions = () => {
    switch (selectedReport) {
      case 'pipeline':
      case 'opportunities':
        return [
          { value: 'Qualification', label: 'Qualification' },
          { value: 'Proposal', label: 'Proposal' },
          { value: 'Negotiation', label: 'Negotiation' },
          { value: 'Won', label: 'Won' },
          { value: 'Lost', label: 'Lost' }
        ];
      case 'customers':
        return [
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' },
          { value: 'Lead', label: 'Lead' },
          { value: 'Prospect', label: 'Prospect' }
        ];
      case 'leads':
        return [
          { value: 'New', label: 'New' },
          { value: 'Contacted', label: 'Contacted' },
          { value: 'Qualified', label: 'Qualified' },
          { value: 'Lost', label: 'Lost' }
        ];
      case 'followups':
        return [
          { value: 'Planned', label: 'Planned' },
          { value: 'Completed', label: 'Completed' },
          { value: 'Cancelled', label: 'Cancelled' },
          { value: 'Overdue', label: 'Overdue' }
        ];
      case 'audit':
        return [
          { value: 'SUCCESS', label: 'SUCCESS' },
          { value: 'FAILURE', label: 'FAILURE' }
        ];
      default:
        return null;
    }
  };

  const statusOptions = getStatusOptions();
  const tableHeaders = reportData?.data?.length > 0
    ? Object.keys(reportData.data[0]).filter((k) => typeof reportData.data[0][k] !== 'object' && !k.startsWith('_'))
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Intelligence & Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated CRM business reports, pipeline analytics, conversion funnels, pagination, and CSV export.
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={exporting || loading || !reportData?.data?.length}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-500/25 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Exporting CSV...' : 'Export Filtered CSV'}</span>
        </button>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Summary KPI Cards if available */}
      {reportData?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(reportData.summary)
            .filter(([k, v]) => typeof v !== 'object')
            .map(([key, value]) => (
              <div key={key} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('pipeline'))
                    ? `$${value.toLocaleString()}`
                    : value}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Interactive Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Report Filters & Controls</span>
          </div>
          <button
            onClick={resetFilters}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search in report..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Status / Stage Dropdown */}
          {statusOptions ? (
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Statuses / Stages</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-xs flex items-center">
              No status filter
            </div>
          )}

          {/* Assigned User Dropdown (Admin & Manager) */}
          {(isAdmin || isManager) ? (
            <div>
              <select
                value={assignedToFilter}
                onChange={(e) => {
                  setAssignedToFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Assigned Users</option>
                {assignableUsers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-xs flex items-center truncate">
              Assigned: {user?.name || 'My Records'}
            </div>
          )}

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              title="Start Date"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              title="End Date"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Page Size & Sorting Info Bar */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center space-x-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {sortBy && (
            <div className="flex items-center space-x-1.5 text-blue-600 font-medium">
              <span>Sorted by <strong className="font-bold">{sortBy.replace(/([A-Z])/g, ' $1')}</strong> ({sortOrder.toUpperCase()})</span>
              <button
                onClick={() => {
                  setSortBy('');
                  setSortOrder('desc');
                }}
                className="hover:underline text-slate-400"
              >
                (Clear sort)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Report Data Body */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{reportData?.reportType || 'Report Overview'}</h3>
            <span className="text-xs text-slate-400">
              {reportData?.pagination?.totalRecords ?? reportData?.data?.length ?? 0} Total Records Found
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading report metrics & records...</div>
        ) : !reportData?.data || reportData.data.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No report data found" message="No matching records found for the selected parameters and filters." />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    {tableHeaders.map((header) => {
                      const isSorted = sortBy === header;
                      return (
                        <th
                          key={header}
                          onClick={() => handleSort(header)}
                          className="py-3 px-4 cursor-pointer select-none hover:bg-slate-100/70 transition-colors"
                          title={`Sort by ${header}`}
                        >
                          <div className="inline-flex items-center space-x-1.5">
                            <span>{header.replace(/([A-Z])/g, ' $1')}</span>
                            {isSorted ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-300 hover:text-slate-500" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      {tableHeaders.map((col) => (
                        <td key={col} className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {col.toLowerCase().includes('date') && row[col] && !String(row[col]).includes(' ')
                            ? new Date(row[col]).toLocaleDateString()
                            : (col.toLowerCase().includes('amount') || col.toLowerCase().includes('value')) && !String(row[col]).includes('%')
                            ? `$${Number(row[col] || 0).toLocaleString()}`
                            : String(row[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {reportData?.pagination && (
              <Pagination
                currentPage={reportData.pagination.page}
                totalPages={reportData.pagination.totalPages}
                total={reportData.pagination.totalRecords}
                limit={reportData.pagination.limit}
                onPageChange={(newPage) => setPage(newPage)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
