import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import {
  CalendarCheck,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  AlertCircle,
  Edit2,
  Trash2,
  User,
  Building
} from 'lucide-react';

const FollowUps = () => {
  const { user } = useAuth();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'upcoming', 'overdue', 'today'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const initialForm = {
    relatedType: 'Customer',
    customerId: '',
    leadId: '',
    followUpDate: '',
    followUpType: 'Call',
    subject: '',
    remarks: '',
    status: 'Planned',
    assignedTo: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchFollowUps = async (p = page) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/followups?status=${statusFilter}&type=${typeFilter}&filterType=${activeTab}&page=${p}&limit=10`
      );
      if (res.data.success) {
        setFollowUps(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || res.data.count || 0);
      }
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [custRes, leadRes, userRes] = await Promise.all([
        api.get('/customers?limit=100'),
        api.get('/leads?limit=100'),
        api.get('/users/assignable')
      ]);
      if (custRes.data.success) setCustomers(custRes.data.data);
      if (leadRes.data.success) setLeads(leadRes.data.data);
      if (userRes.data.success) setAssignableUsers(userRes.data.data);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchFollowUps(1);
  }, [statusFilter, typeFilter, activeTab]);

  useEffect(() => {
    fetchFollowUps(page);
  }, [page]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const openCreateModal = () => {
    setSelectedFollowUp(null);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(10, 0, 0, 0);
    const dateStr = tomorrow.toISOString().slice(0, 16);

    setFormData({
      ...initialForm,
      followUpDate: dateStr,
      assignedTo: user?._id || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (fu) => {
    setSelectedFollowUp(fu);
    const dateStr = fu.followUpDate ? new Date(fu.followUpDate).toISOString().slice(0, 16) : '';
    setFormData({
      relatedType: fu.relatedType || 'Customer',
      customerId: fu.customerId?._id || fu.customerId || '',
      leadId: fu.leadId?._id || fu.leadId || '',
      followUpDate: dateStr,
      followUpType: fu.followUpType || 'Call',
      subject: fu.subject || '',
      remarks: fu.remarks || '',
      status: fu.status || 'Planned',
      assignedTo: fu.assignedTo?._id || fu.assignedTo || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const handleQuickStatus = async (fu, newStatus) => {
    try {
      await api.put(`/followups/${fu._id}`, { status: newStatus });
      fetchFollowUps();
    } catch (err) {
      alert('Failed to update status: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errors = {};

    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    } else if (formData.subject.length > 150) {
      errors.subject = 'Subject cannot exceed 150 characters';
    }

    if (!formData.followUpDate) {
      errors.followUpDate = 'Follow-up date and time are required';
    } else {
      const chosenDate = new Date(formData.followUpDate);
      if (isNaN(chosenDate.getTime())) {
        errors.followUpDate = 'Invalid follow-up date and time';
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (formData.status === 'Planned' && !selectedFollowUp && chosenDate < today) {
          errors.followUpDate = 'Follow-up date cannot be earlier than today.';
        }
      }
    }

    if (formData.relatedType === 'Customer' && !formData.customerId) {
      errors.customerId = 'Please select a related customer';
    } else if (formData.relatedType === 'Lead' && !formData.leadId) {
      errors.leadId = 'Please select a related lead';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      const el = document.getElementById(`fu-${firstField}`);
      if (el) el.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (selectedFollowUp) {
        await api.put(`/followups/${selectedFollowUp._id}`, formData);
      } else {
        await api.post('/followups', formData);
      }
      setIsFormOpen(false);
      fetchFollowUps();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed';
      setFormError(msg);
      if (msg.toLowerCase().includes('subject')) {
        setFieldErrors((prev) => ({ ...prev, subject: msg }));
        document.getElementById('fu-subject')?.focus();
      } else if (msg.toLowerCase().includes('date')) {
        setFieldErrors((prev) => ({ ...prev, followUpDate: msg }));
        document.getElementById('fu-followUpDate')?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedFollowUp) return;
    setSubmitting(true);
    try {
      await api.delete(`/followups/${selectedFollowUp._id}`);
      setIsDeleteOpen(false);
      fetchFollowUps();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Follow-Up Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Schedule customer interactions, set alerts, and track ongoing prospect communications.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Follow-Up</span>
        </button>
      </div>

      {/* Tabs and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'today', label: 'Today' },
            { id: 'overdue', label: 'Overdue' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="Completed">Completed</option>
            <option value="Missed">Missed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Types</option>
            <option value="Call">Call</option>
            <option value="Meeting">Meeting</option>
            <option value="Email">Email</option>
            <option value="Demo">Demo</option>
            <option value="Task">Task</option>
          </select>
        </div>
      </div>

      {/* Follow-Ups Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading follow-ups...</div>
        ) : followUps.length === 0 ? (
          <EmptyState
            title="No follow-up items"
            message="No follow-ups match your current tab or status filter."
            action={
              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Schedule First Follow-Up
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Related To</th>
                  <th className="py-3.5 px-4">Scheduled Date & Time</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followUps.map((fu) => {
                  const isPast = new Date(fu.followUpDate) < new Date();
                  const isOverdue = isPast && fu.status === 'Planned';

                  return (
                    <tr
                      key={fu._id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isOverdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{fu.subject}</span>
                        {fu.remarks && (
                          <span className="text-[11px] text-slate-500 line-clamp-1">{fu.remarks}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {fu.relatedType === 'Customer'
                          ? fu.customerId?.customerName || 'General Customer'
                          : fu.leadId?.leadName || 'General Lead'}
                        <span className="block text-[10px] text-slate-400 uppercase">{fu.relatedType}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-semibold block ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                          {new Date(fu.followUpDate).toLocaleDateString()}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(fu.followUpDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={fu.followUpType}>{fu.followUpType}</Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={fu.status}>{fu.status}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {fu.assignedTo?.name || 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {fu.status === 'Planned' && (
                          <button
                            onClick={() => handleQuickStatus(fu, 'Completed')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Mark Completed"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(fu)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit / Reschedule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFollowUp(fu);
                            setIsDeleteOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            total={totalCount}
            limit={10}
            onPageChange={setPage}
          />
        </>
      )}
      </div>

      {/* Schedule / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedFollowUp ? `Edit Follow-Up: ${selectedFollowUp.subject}` : 'Schedule Follow-Up'}
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Subject / Task Title *</label>
            <input
              id="fu-subject"
              type="text"
              value={formData.subject}
              onChange={(e) => {
                setFormData({ ...formData, subject: e.target.value });
                if (fieldErrors.subject) setFieldErrors({ ...fieldErrors, subject: '' });
              }}
              placeholder="e.g. Discuss Q3 License Proposal with CTO"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                fieldErrors.subject ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {fieldErrors.subject && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.subject}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Related Entity Type</label>
              <select
                value={formData.relatedType}
                onChange={(e) => setFormData({ ...formData, relatedType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Customer">Customer Account</option>
                <option value="Lead">Lead Prospect</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select {formData.relatedType} *
              </label>
              {formData.relatedType === 'Customer' ? (
                <>
                  <select
                    id="fu-customerId"
                    value={formData.customerId}
                    onChange={(e) => {
                      setFormData({ ...formData, customerId: e.target.value });
                      if (fieldErrors.customerId) setFieldErrors({ ...fieldErrors, customerId: '' });
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                      fieldErrors.customerId ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Choose Customer</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.customerName} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.customerId && (
                    <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.customerId}</p>
                  )}
                </>
              ) : (
                <>
                  <select
                    id="fu-leadId"
                    value={formData.leadId}
                    onChange={(e) => {
                      setFormData({ ...formData, leadId: e.target.value });
                      if (fieldErrors.leadId) setFieldErrors({ ...fieldErrors, leadId: '' });
                    }}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                      fieldErrors.leadId ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                    }`}
                  >
                    <option value="">Choose Lead</option>
                    {leads.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.leadName} ({l.leadCode})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.leadId && (
                    <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.leadId}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date & Time *</label>
              <input
                id="fu-followUpDate"
                type="datetime-local"
                value={formData.followUpDate}
                onChange={(e) => {
                  setFormData({ ...formData, followUpDate: e.target.value });
                  if (fieldErrors.followUpDate) setFieldErrors({ ...fieldErrors, followUpDate: '' });
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.followUpDate ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.followUpDate && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.followUpDate}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Type</label>
              <select
                value={formData.followUpType}
                onChange={(e) => setFormData({ ...formData, followUpType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Email">Email</option>
                <option value="Demo">Demo</option>
                <option value="Task">Task</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Planned">Planned</option>
                <option value="Completed">Completed</option>
                <option value="Missed">Missed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assigned User</label>
            <select
              value={formData.assignedTo}
              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks / Agenda Notes</label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Key talking points or outcome..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/25 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : selectedFollowUp ? 'Update Follow-Up' : 'Schedule Follow-Up'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Follow-Up"
        message={`Are you sure you want to delete follow-up '${selectedFollowUp?.subject}'?`}
        confirmText="Confirm Delete"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
};

export default FollowUps;
