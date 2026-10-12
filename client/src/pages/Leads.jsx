import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import {
  UserPlus,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ArrowRightCircle,
  Building,
  Mail,
  Phone,
  DollarSign,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

const Leads = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const initialForm = {
    leadName: '',
    email: '',
    phone: '',
    companyName: '',
    source: 'Website',
    status: 'New',
    priority: 'Medium',
    expectedValue: 0,
    assignedTo: '',
    notes: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});

  // Conversion Form State
  const [convertData, setConvertData] = useState({
    createCustomer: true,
    createOpportunity: true,
    opportunityName: '',
    opportunityAmount: '',
    opportunityStage: 'Qualification',
    expectedCloseDate: ''
  });

  const fetchLeads = async (p = page) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/leads?search=${search}&status=${statusFilter}&priority=${priorityFilter}&source=${sourceFilter}&page=${p}&limit=10`
      );
      if (res.data.success) {
        setLeads(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || res.data.count || 0);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/assignable');
      if (res.data.success) {
        setAssignableUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load assignable users:', err);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchLeads(1);
  }, [search, statusFilter, priorityFilter, sourceFilter]);

  useEffect(() => {
    fetchLeads(page);
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setSelectedLead(null);
    setFormData({
      ...initialForm,
      assignedTo: user?._id || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (lead) => {
    setSelectedLead(lead);
    setFormData({
      leadName: lead.leadName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      companyName: lead.companyName || '',
      source: lead.source || 'Website',
      status: lead.status || 'New',
      priority: lead.priority || 'Medium',
      expectedValue: lead.expectedValue || 0,
      assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
      notes: lead.notes || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openConvertModal = (lead) => {
    setSelectedLead(lead);
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setConvertData({
      createCustomer: true,
      createOpportunity: true,
      opportunityName: `${lead.companyName || lead.leadName} Enterprise Opportunity`,
      opportunityAmount: lead.expectedValue || 10000,
      opportunityStage: 'Qualification',
      expectedCloseDate: thirtyDaysLater
    });
    setFormError('');
    setIsConvertOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errors = {};

    if (!formData.leadName.trim()) {
      errors.leadName = 'Lead name is mandatory';
    } else if (formData.leadName.length > 100) {
      errors.leadName = 'Lead name cannot exceed 100 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Enter a valid email address';
      }
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      const phoneRegex = /^[0-9+() -]{7,20}$/;
      if (!phoneRegex.test(formData.phone.trim())) {
        errors.phone = 'Enter a valid phone number (7-20 digits)';
      }
    }

    const val = Number(formData.expectedValue);
    if (isNaN(val) || val < 0) {
      errors.expectedValue = 'Expected value cannot be negative';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      const el = document.getElementById(`lead-${firstField}`);
      if (el) el.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (selectedLead) {
        await api.put(`/leads/${selectedLead._id}`, formData);
      } else {
        await api.post('/leads', formData);
      }
      setIsFormOpen(false);
      fetchLeads();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed';
      setFormError(msg);
      if (msg.toLowerCase().includes('email')) {
        setFieldErrors((prev) => ({ ...prev, email: msg }));
        document.getElementById('lead-email')?.focus();
      } else if (msg.toLowerCase().includes('phone')) {
        setFieldErrors((prev) => ({ ...prev, phone: msg }));
        document.getElementById('lead-phone')?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (convertData.createOpportunity) {
      if (Number(convertData.opportunityAmount) <= 0) {
        setFormError('Opportunity Amount must be greater than 0.');
        return;
      }
      if (!convertData.expectedCloseDate) {
        setFormError('Expected close date is required');
        return;
      }
      const closeDate = new Date(convertData.expectedCloseDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (closeDate < today) {
        setFormError('Expected Close Date cannot be in the past');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.post(`/leads/${selectedLead._id}/convert`, convertData);
      setIsConvertOpen(false);
      fetchLeads();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Lead conversion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLead) return;
    setSubmitting(true);
    try {
      await api.delete(`/leads/${selectedLead._id}`);
      setIsDeleteOpen(false);
      fetchLeads();
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Lead Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Capture prospective leads, qualify interest, and convert to sales opportunities.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Capture New Lead</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads, company, email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Unqualified">Unqualified</option>
            <option value="Converted">Converted</option>
            <option value="Lost">Lost</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Sources</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
            <option value="Cold Call">Cold Call</option>
            <option value="Social Media">Social Media</option>
            <option value="Partner">Partner</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading lead registry...</div>
        ) : leads.length === 0 ? (
          <EmptyState
            title="No leads found"
            message="No leads matched your criteria. Create a lead to start tracking potential deals."
            action={
              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Create Lead
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Lead Code</th>
                  <th className="py-3.5 px-4">Lead Name</th>
                  <th className="py-3.5 px-4">Company & Source</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Expected Value</th>
                  <th className="py-3.5 px-4">Priority & Status</th>
                  <th className="py-3.5 px-4">Owner</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {l.leadCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{l.leadName}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{l.companyName || '—'}</span>
                      <span className="text-[11px] text-slate-400">via {l.source}</span>
                    </td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="flex items-center space-x-1 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{l.email}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{l.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      ${l.expectedValue?.toLocaleString() || '0'}
                    </td>
                    <td className="py-3.5 px-4 space-x-1.5">
                      <Badge variant={l.priority}>{l.priority}</Badge>
                      <Badge variant={l.status}>{l.status}</Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {l.assignedTo?.name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {l.status !== 'Converted' && (
                        <button
                          onClick={() => openConvertModal(l)}
                          className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg font-bold text-[11px] inline-flex items-center space-x-1 transition-colors"
                          title="Convert to Customer & Opportunity"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          <span>Convert</span>
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(l)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit Lead"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {(isAdmin || isManager) && (
                        <button
                          onClick={() => {
                            setSelectedLead(l);
                            setIsDeleteOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Lead"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
            limit={10}
            onPageChange={setPage}
          />
        </>
      )}
      </div>

      {/* Add / Edit Lead Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedLead ? `Edit Lead: ${selectedLead.leadName}` : 'Capture New Lead'}
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lead Contact Name *</label>
              <input
                id="lead-leadName"
                type="text"
                value={formData.leadName}
                onChange={(e) => {
                  setFormData({ ...formData, leadName: e.target.value });
                  if (fieldErrors.leadName) setFieldErrors({ ...fieldErrors, leadName: '' });
                }}
                placeholder="e.g. Elena Rostova"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.leadName ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {fieldErrors.leadName && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.leadName}</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company / Organization</label>
              <input
                id="lead-companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g. Quantum Systems Inc."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email *</label>
              <input
                id="lead-email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                }}
                placeholder="elena@quantumsys.com"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.email ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                id="lead-phone"
                type="text"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
                }}
                placeholder="9876543210"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.phone ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {fieldErrors.phone && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lead Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Social Media">Social Media</option>
                <option value="Partner">Partner</option>
                <option value="Exhibition">Exhibition</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Unqualified">Unqualified</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Deal Value ($)</label>
              <input
                id="lead-expectedValue"
                type="number"
                min="0"
                value={formData.expectedValue}
                onChange={(e) => {
                  setFormData({ ...formData, expectedValue: e.target.value });
                  if (fieldErrors.expectedValue) setFieldErrors({ ...fieldErrors, expectedValue: '' });
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.expectedValue ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.expectedValue && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.expectedValue}</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assign To</label>
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
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              {submitting ? 'Saving...' : selectedLead ? 'Update Lead' : 'Create Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Convert Lead Workflow Modal */}
      <Modal
        isOpen={isConvertOpen}
        onClose={() => setIsConvertOpen(false)}
        title={`Lead Qualification: Convert ${selectedLead?.leadName}`}
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
          <p className="font-bold flex items-center space-x-1.5">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span>Convert Lead to Customer & Opportunity</span>
          </p>
          <p className="mt-1 text-blue-700">
            This workflow transitions the lead to "Converted", creates a permanent Customer account, and launches a Sales Pipeline opportunity.
          </p>
        </div>

        <form onSubmit={handleConvertSubmit} className="space-y-4 text-xs">
          <div className="space-y-2">
            <label className="flex items-center space-x-2 font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={convertData.createCustomer}
                onChange={(e) => setConvertData({ ...convertData, createCustomer: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Create Customer Account ({selectedLead?.leadName})</span>
            </label>
            <label className="flex items-center space-x-2 font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={convertData.createOpportunity}
                onChange={(e) => setConvertData({ ...convertData, createOpportunity: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Create Pipeline Opportunity</span>
            </label>
          </div>

          {convertData.createOpportunity && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opportunity Name</label>
                <input
                  type="text"
                  value={convertData.opportunityName}
                  onChange={(e) => setConvertData({ ...convertData, opportunityName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opportunity Amount ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={convertData.opportunityAmount}
                    onChange={(e) => setConvertData({ ...convertData, opportunityAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Close Date</label>
                  <input
                    type="date"
                    value={convertData.expectedCloseDate}
                    onChange={(e) => setConvertData({ ...convertData, expectedCloseDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsConvertOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md shadow-purple-500/25 disabled:opacity-50"
            >
              {submitting ? 'Converting...' : 'Execute Conversion'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Lead"
        message={`Are you sure you want to delete lead '${selectedLead?.leadName}' (${selectedLead?.leadCode})?`}
        confirmText="Confirm Delete"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
};

export default Leads;
