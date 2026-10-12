import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import {
  Target,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
  Building,
  CheckCircle2,
  XCircle,
  Layers
} from 'lucide-react';

const Opportunities = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [customers, setCustomers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const initialForm = {
    opportunityName: '',
    customerId: '',
    amount: '',
    stage: 'Qualification',
    probability: 20,
    expectedCloseDate: '',
    assignedTo: '',
    notes: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchOpportunities = async (p = page) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/opportunities?search=${search}&stage=${stageFilter}&status=${statusFilter}&page=${p}&limit=10`
      );
      if (res.data.success) {
        setOpportunities(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || res.data.count || 0);
      }
    } catch (err) {
      console.error('Failed to load opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [custRes, userRes] = await Promise.all([
        api.get('/customers?limit=200'),
        api.get('/users/assignable')
      ]);
      if (custRes.data.success) setCustomers(custRes.data.data);
      if (userRes.data.success) setAssignableUsers(userRes.data.data);
    } catch (err) {
      console.error('Failed to load form options:', err);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchOpportunities(1);
  }, [search, stageFilter, statusFilter]);

  useEffect(() => {
    fetchOpportunities(page);
  }, [page]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const openCreateModal = () => {
    setSelectedOpp(null);
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      ...initialForm,
      assignedTo: user?._id || '',
      expectedCloseDate: thirtyDaysLater
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (opp) => {
    setSelectedOpp(opp);
    const closeDate = opp.expectedCloseDate
      ? new Date(opp.expectedCloseDate).toISOString().split('T')[0]
      : '';
    setFormData({
      opportunityName: opp.opportunityName || '',
      customerId: opp.customerId?._id || opp.customerId || '',
      amount: opp.amount || '',
      stage: opp.stage || 'Qualification',
      probability: opp.probability !== undefined ? opp.probability : 20,
      expectedCloseDate: closeDate,
      assignedTo: opp.assignedTo?._id || opp.assignedTo || '',
      notes: opp.notes || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const handleStageChange = (e) => {
    const stage = e.target.value;
    let defaultProb = formData.probability;
    if (stage === 'Qualification') defaultProb = 20;
    else if (stage === 'Proposal') defaultProb = 50;
    else if (stage === 'Negotiation') defaultProb = 80;
    else if (stage === 'Won') defaultProb = 100;
    else if (stage === 'Lost') defaultProb = 0;

    setFormData({
      ...formData,
      stage,
      probability: defaultProb
    });
    if (fieldErrors.stage) setFieldErrors({ ...fieldErrors, stage: '' });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errors = {};

    if (!formData.opportunityName.trim()) {
      errors.opportunityName = 'Opportunity name is required';
    } else if (formData.opportunityName.length > 150) {
      errors.opportunityName = 'Opportunity name cannot exceed 150 characters';
    }

    if (!formData.customerId) {
      errors.customerId = 'Related Customer is required';
    }

    // Business validation: Amount must be > 0
    const amt = Number(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      errors.amount = 'Opportunity Amount must be greater than 0.';
    }

    // Business validation: Probability 0 to 100
    const prob = Number(formData.probability);
    if (isNaN(prob) || prob < 0 || prob > 100) {
      errors.probability = 'Probability must be between 0 and 100.';
    }

    // Business validation: Expected Close Date cannot be in the past
    if (!formData.expectedCloseDate) {
      errors.expectedCloseDate = 'Expected Close Date is required';
    } else {
      const closeDate = new Date(formData.expectedCloseDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (formData.stage !== 'Won' && formData.stage !== 'Lost' && closeDate < today) {
        errors.expectedCloseDate = 'Expected Close Date cannot be in the past for active opportunities.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      const el = document.getElementById(`opp-${firstField}`);
      if (el) el.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (selectedOpp) {
        await api.put(`/opportunities/${selectedOpp._id}`, formData);
      } else {
        await api.post('/opportunities', formData);
      }
      setIsFormOpen(false);
      fetchOpportunities();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed';
      setFormError(msg);
      if (msg.toLowerCase().includes('amount')) {
        setFieldErrors((prev) => ({ ...prev, amount: msg }));
        document.getElementById('opp-amount')?.focus();
      } else if (msg.toLowerCase().includes('probability')) {
        setFieldErrors((prev) => ({ ...prev, probability: msg }));
        document.getElementById('opp-probability')?.focus();
      } else if (msg.toLowerCase().includes('close date')) {
        setFieldErrors((prev) => ({ ...prev, expectedCloseDate: msg }));
        document.getElementById('opp-expectedCloseDate')?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedOpp) return;
    setSubmitting(true);
    try {
      await api.delete(`/opportunities/${selectedOpp._id}`);
      setIsDeleteOpen(false);
      fetchOpportunities();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPipeline = opportunities
    .filter((o) => o.status === 'Open')
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  const weightedPipeline = opportunities
    .filter((o) => o.status === 'Open')
    .reduce((sum, o) => sum + ((o.amount || 0) * (o.probability || 0)) / 100, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Pipeline Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sales Opportunity Pipeline</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track deals across qualification, proposals, negotiation, and closed outcomes.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Opportunity</span>
        </button>
      </div>

      {/* Pipeline Quick Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Open Pipeline</span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">
              ${totalPipeline.toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weighted Forecast</span>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
              ${Math.round(weightedPipeline).toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Deals</span>
            <p className="text-xl font-extrabold text-purple-600 mt-0.5">
              {opportunities.filter((o) => o.status === 'Open').length} Opportunities
            </p>
          </div>
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
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
            placeholder="Search opportunity or customer..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Stages</option>
            <option value="Qualification">Qualification</option>
            <option value="Proposal">Proposal</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading pipeline opportunities...</div>
        ) : opportunities.length === 0 ? (
          <EmptyState
            title="No opportunities found"
            message="Create an opportunity to track sales progress."
            action={
              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Create Opportunity
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Opportunity Name</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Stage</th>
                  <th className="py-3.5 px-4">Probability</th>
                  <th className="py-3.5 px-4">Weighted Value</th>
                  <th className="py-3.5 px-4">Expected Close</th>
                  <th className="py-3.5 px-4">Owner</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {opportunities.map((opp) => {
                  const weighted = ((opp.amount || 0) * (opp.probability || 0)) / 100;
                  return (
                    <tr key={opp._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{opp.opportunityName}</span>
                        {opp.notes && <span className="text-[11px] text-slate-400 line-clamp-1">{opp.notes}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-semibold">
                        {opp.customerId?.customerName || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ${opp.amount?.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={opp.stage}>{opp.stage}</Badge>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        <div className="flex items-center space-x-2">
                          <span>{opp.probability}%</span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${opp.probability}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-600">
                        ${Math.round(weighted).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {opp.expectedCloseDate
                          ? new Date(opp.expectedCloseDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {opp.assignedTo?.name || 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(opp)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit Opportunity"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(isAdmin || isManager) && (
                          <button
                            onClick={() => {
                              setSelectedOpp(opp);
                              setIsDeleteOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Opportunity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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

      {/* Add / Edit Opportunity Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedOpp ? `Edit Opportunity: ${selectedOpp.opportunityName}` : 'Create Sales Opportunity'}
      >
        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Opportunity Name *</label>
            <input
              id="opp-opportunityName"
              type="text"
              value={formData.opportunityName}
              onChange={(e) => {
                setFormData({ ...formData, opportunityName: e.target.value });
                if (fieldErrors.opportunityName) setFieldErrors({ ...fieldErrors, opportunityName: '' });
              }}
              placeholder="e.g. Enterprise License Expansion 2026"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                fieldErrors.opportunityName ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {fieldErrors.opportunityName && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.opportunityName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Account *</label>
              <select
                id="opp-customerId"
                value={formData.customerId}
                onChange={(e) => {
                  setFormData({ ...formData, customerId: e.target.value });
                  if (fieldErrors.customerId) setFieldErrors({ ...fieldErrors, customerId: '' });
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.customerId ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.customerName} ({c.customerCode})
                  </option>
                ))}
              </select>
              {fieldErrors.customerId && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.customerId}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Deal Amount ($ &gt; 0) *</label>
              <input
                id="opp-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => {
                  setFormData({ ...formData, amount: e.target.value });
                  if (fieldErrors.amount) setFieldErrors({ ...fieldErrors, amount: '' });
                }}
                placeholder="50000"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.amount ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.amount && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.amount}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pipeline Stage</label>
              <select
                value={formData.stage}
                onChange={handleStageChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Qualification">Qualification</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Probability (0 - 100%) *</label>
              <input
                id="opp-probability"
                type="number"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => {
                  setFormData({ ...formData, probability: e.target.value });
                  if (fieldErrors.probability) setFieldErrors({ ...fieldErrors, probability: '' });
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.probability ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.probability && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.probability}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Close Date *</label>
              <input
                id="opp-expectedCloseDate"
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => {
                  setFormData({ ...formData, expectedCloseDate: e.target.value });
                  if (fieldErrors.expectedCloseDate) setFieldErrors({ ...fieldErrors, expectedCloseDate: '' });
                }}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.expectedCloseDate ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                }`}
              />
              {fieldErrors.expectedCloseDate && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.expectedCloseDate}</p>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Calculated Weighted Pipeline Value:</span>
            <span className="font-bold text-emerald-600 text-sm">
              ${Math.round(((Number(formData.amount) || 0) * (Number(formData.probability) || 0)) / 100).toLocaleString()}
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assigned Sales Executive</label>
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
            <label className="block font-semibold text-slate-700 mb-1">Opportunity Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Terms discussed, procurement details, key decision makers..."
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
              {submitting ? 'Saving...' : selectedOpp ? 'Update Opportunity' : 'Save Opportunity'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Opportunity"
        message={`Are you sure you want to delete opportunity '${selectedOpp?.opportunityName}'?`}
        confirmText="Confirm Delete"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
};

export default Opportunities;
