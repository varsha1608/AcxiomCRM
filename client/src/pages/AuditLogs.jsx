import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import {
  History,
  Search,
  Filter,
  Eye,
  Calendar,
  ShieldAlert,
  Terminal,
  User,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [resultFilter, setResultFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Details Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchLogs = async (p = page) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/audit-logs?search=${search}&entityName=${entityFilter}&action=${actionFilter}&result=${resultFilter}&page=${p}&limit=15`
      );
      if (res.data.success) {
        setLogs(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || res.data.count || 0);
      }
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [search, entityFilter, actionFilter, resultFilter]);

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const openLogDetails = (log) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Security & Audit Log</h1>
            <span className="text-[10px] bg-slate-900 text-slate-200 font-mono px-2 py-0.5 rounded-full border border-slate-700">
              Append-Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable, timestamped record of authentication events, user updates, and CRM state mutations.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, user, details, IP..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Modules</option>
            <option value="Auth">Auth</option>
            <option value="User">User</option>
            <option value="Customer">Customer</option>
            <option value="Lead">Lead</option>
            <option value="Opportunity">Opportunity</option>
            <option value="FollowUp">FollowUp</option>
            <option value="Activity">Activity</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="FAILED_LOGIN">FAILED_LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="CONVERT_LEAD">CONVERT_LEAD</option>
            <option value="LOCKOUT">LOCKOUT</option>
            <option value="UNLOCK">UNLOCK</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading immutable audit stream...</div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries found" message="Security events and entity changes appear here." />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User & Role</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Module</th>
                  <th className="py-3.5 px-4">Result</th>
                  <th className="py-3.5 px-4">Details</th>
                  <th className="py-3.5 px-4">IP Address</th>
                  <th className="py-3.5 px-4 text-right">View Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-800">
                      <span>{log.userName}</span>
                      <span className="block text-[10px] text-slate-400">{log.userRole}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-blue-600">
                      {log.entityName}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={log.result} size="xs">{log.result}</Badge>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate" title={log.details}>
                      {log.details || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(log.oldValue || log.newValue) ? (
                        <button
                          onClick={() => openLogDetails(log)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Inspect Old & New State"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            total={totalCount}
            limit={15}
            onPageChange={setPage}
          />
        </>
      )}
      </div>

      {/* Inspect Audit Entry Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={`Audit Record #${selectedLog?._id?.slice(-8)}`}
        maxWidth="max-w-3xl"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block">Action</span>
                <strong className="text-slate-900">{selectedLog.action}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Entity</span>
                <strong className="text-blue-600">{selectedLog.entityName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Actor</span>
                <strong className="text-slate-900">{selectedLog.userName} ({selectedLog.userRole})</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Timestamp</span>
                <strong className="text-slate-900">{new Date(selectedLog.createdAt).toLocaleString()}</strong>
              </div>
            </div>

            {selectedLog.details && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 text-slate-700">
                <span className="font-semibold block text-slate-900 mb-0.5">Details:</span>
                <p>{selectedLog.details}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <span>Previous State (Old Value)</span>
                </h4>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] overflow-x-auto max-h-60 font-mono">
                  {selectedLog.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : 'None / Newly Created'}
                </pre>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <span>New State (New Value)</span>
                </h4>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] overflow-x-auto max-h-60 font-mono">
                  {selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : 'None / Deleted'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogs;
