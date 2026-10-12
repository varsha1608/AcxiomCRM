import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import {
  Activity as ActivityIcon,
  Plus,
  Filter,
  PhoneCall,
  Users,
  Mail,
  CheckSquare,
  AlertCircle,
  Trash2,
  Calendar
} from 'lucide-react';

const Activities = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const initialForm = {
    activityType: 'Call',
    subject: '',
    description: '',
    activityDate: new Date().toISOString().slice(0, 16),
    customerId: '',
    leadId: '',
    assignedTo: '',
    status: 'Completed'
  };
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/activities?type=${typeFilter}&status=${statusFilter}`);
      if (res.data.success) {
        setActivities(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
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
      console.error('Failed to load activity dropdowns:', err);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const openCreateModal = () => {
    setFormData({
      ...initialForm,
      assignedTo: user?._id || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
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

    if (!formData.activityType) {
      errors.activityType = 'Activity type is required';
    }

    if (!formData.activityDate) {
      errors.activityDate = 'Activity date and time are required';
    } else {
      const dt = new Date(formData.activityDate);
      if (isNaN(dt.getTime())) {
        errors.activityDate = 'Invalid activity date and time';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      const el = document.getElementById(`act-${firstField}`);
      if (el) el.focus();
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/activities', formData);
      setIsFormOpen(false);
      fetchActivities();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log activity';
      setFormError(msg);
      if (msg.toLowerCase().includes('subject')) {
        setFieldErrors((prev) => ({ ...prev, subject: msg }));
        document.getElementById('act-subject')?.focus();
      } else if (msg.toLowerCase().includes('date')) {
        setFieldErrors((prev) => ({ ...prev, activityDate: msg }));
        document.getElementById('act-activityDate')?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedActivity) return;
    setSubmitting(true);
    try {
      await api.delete(`/activities/${selectedActivity._id}`);
      setIsDeleteOpen(false);
      fetchActivities();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Call': return <PhoneCall className="w-4 h-4 text-blue-600" />;
      case 'Meeting': return <Users className="w-4 h-4 text-purple-600" />;
      case 'Email': return <Mail className="w-4 h-4 text-emerald-600" />;
      default: return <CheckSquare className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Activity Stream</h1>
          <p className="text-xs text-slate-500 mt-1">
            Log client interactions including calls, emails, product demos, and strategic meetings.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Log Activity</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Activity Types</option>
            <option value="Call">Calls</option>
            <option value="Meeting">Meetings</option>
            <option value="Email">Emails</option>
            <option value="Task">Tasks</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Planned">Planned</option>
          </select>
        </div>
      </div>

      {/* Activities Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading activities...</div>
        ) : activities.length === 0 ? (
          <EmptyState
            title="No activities recorded"
            message="Keep track of your client touchpoints by logging calls, meetings, or emails."
            action={
              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Log First Activity
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {activities.map((act) => (
              <div
                key={act._id}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start justify-between"
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs mt-0.5">
                    {getTypeIcon(act.activityType)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{act.subject}</span>
                      <Badge variant={act.activityType} size="xs">{act.activityType}</Badge>
                      <Badge variant={act.status} size="xs">{act.status}</Badge>
                    </div>

                    {act.description && (
                      <p className="text-xs text-slate-600 max-w-2xl">{act.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-1">
                      <span>Logged by: <strong className="text-slate-600">{act.assignedTo?.name || 'User'}</strong></span>
                      {act.customerId && (
                        <span>Customer: <strong className="text-slate-600">{act.customerId.customerName}</strong></span>
                      )}
                      {act.leadId && (
                        <span>Lead: <strong className="text-slate-600">{act.leadId.leadName}</strong></span>
                      )}
                      <span>Date: {new Date(act.activityDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedActivity(act);
                    setIsDeleteOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete Activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Activity Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Log CRM Activity"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs" noValidate>
          <div>
            <label htmlFor="act-subject" className="block font-semibold text-slate-700 mb-1">Subject / Summary *</label>
            <input
              id="act-subject"
              type="text"
              value={formData.subject}
              onChange={(e) => {
                setFormData({ ...formData, subject: e.target.value });
                if (fieldErrors.subject) setFieldErrors((prev) => ({ ...prev, subject: undefined }));
              }}
              placeholder="e.g. Discovery call with Chief Information Security Officer"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                fieldErrors.subject ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
              }`}
            />
            {fieldErrors.subject && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.subject}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="act-activityType" className="block font-semibold text-slate-700 mb-1">Activity Type *</label>
              <select
                id="act-activityType"
                value={formData.activityType}
                onChange={(e) => {
                  setFormData({ ...formData, activityType: e.target.value });
                  if (fieldErrors.activityType) setFieldErrors((prev) => ({ ...prev, activityType: undefined }));
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  fieldErrors.activityType ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Email">Email</option>
                <option value="Task">Task</option>
              </select>
              {fieldErrors.activityType && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.activityType}</p>
              )}
            </div>

            <div>
              <label htmlFor="act-activityDate" className="block font-semibold text-slate-700 mb-1">Activity Date *</label>
              <input
                id="act-activityDate"
                type="datetime-local"
                value={formData.activityDate}
                onChange={(e) => {
                  setFormData({ ...formData, activityDate: e.target.value });
                  if (fieldErrors.activityDate) setFieldErrors((prev) => ({ ...prev, activityDate: undefined }));
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  fieldErrors.activityDate ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.activityDate && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.activityDate}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Completed">Completed</option>
                <option value="Planned">Planned</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Related Customer</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">None / General</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.customerName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Related Lead</label>
              <select
                value={formData.leadId}
                onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="">None / General</option>
                {leads.map((l) => (
                  <option key={l._id} value={l._id}>{l.leadName}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Detailed Notes / Minutes</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was discussed, agreement on timeline, next action items..."
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
              {submitting ? 'Saving...' : 'Log Activity'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Activity Record"
        message="Are you sure you want to delete this activity record from the CRM log?"
        confirmText="Confirm Delete"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
};

export default Activities;
