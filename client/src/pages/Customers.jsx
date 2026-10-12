import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Building,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  Clock,
  Target,
  CalendarCheck
} from 'lucide-react';

const Customers = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form State
  const initialForm = {
    customerName: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    city: '',
    state: '',
    status: 'Active',
    assignedTo: '',
    notes: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async (p = page) => {
    try {
      setLoading(true);
      const res = await api.get(`/customers?search=${search}&status=${statusFilter}&page=${p}&limit=10`);
      if (res.data.success) {
        setCustomers(res.data.data);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || res.data.count || 0);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
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
    fetchCustomers(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCustomers(page);
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setSelectedCustomer(null);
    setFormData({
      ...initialForm,
      assignedTo: user?._id || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (c) => {
    setSelectedCustomer(c);
    setFormData({
      customerName: c.customerName || '',
      email: c.email || '',
      phone: c.phone || '',
      companyName: c.companyName || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      status: c.status || 'Active',
      assignedTo: c.assignedTo?._id || c.assignedTo || '',
      notes: c.notes || ''
    });
    setFormError('');
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openDetailsModal = async (c) => {
    setIsDetailsOpen(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/customers/${c._id}`);
      if (res.data.success) {
        setCustomerDetails(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load customer 360:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openDeleteDialog = (c) => {
    setSelectedCustomer(c);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errors = {};

    // Client-side validations
    if (!formData.customerName.trim()) {
      errors.customerName = 'Customer name is required';
    } else if (formData.customerName.length > 100) {
      errors.customerName = 'Customer name cannot exceed 100 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Enter a valid email address (e.g. user@example.com)';
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

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      const el = document.getElementById(`customer-${firstField}`);
      if (el) el.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (selectedCustomer) {
        await api.put(`/customers/${selectedCustomer._id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setIsFormOpen(false);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed. Please try again.';
      setFormError(msg);
      if (msg.toLowerCase().includes('email')) {
        setFieldErrors((prev) => ({ ...prev, email: msg }));
        document.getElementById('customer-email')?.focus();
      } else if (msg.toLowerCase().includes('phone')) {
        setFieldErrors((prev) => ({ ...prev, phone: msg }));
        document.getElementById('customer-phone')?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;
    setSubmitting(true);
    try {
      await api.delete(`/customers/${selectedCustomer._id}`);
      setIsDeleteOpen(false);
      fetchCustomers();
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Customer Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain customer master data, corporate accounts, and contact points.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, company..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Prospect">Prospect</option>
            <option value="Lead">Lead</option>
          </select>
        </div>
      </div>

      {/* Customers Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading customer directory...</div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers match your criteria"
            message="Add a customer or try adjusting your search terms."
            action={
              <button
                onClick={openCreateModal}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Create Customer
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Customer Code</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Company</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {c.customerCode || 'CUST-AUTO'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{c.customerName}</span>
                      <span className="text-[11px] text-slate-400">{c.city ? `${c.city}, ${c.state}` : 'Location unlisted'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {c.companyName || '—'}
                    </td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="flex items-center space-x-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.email}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={c.status}>{c.status}</Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {c.assignedTo?.name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => openDetailsModal(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Customer 360 View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {(isAdmin || isManager) && (
                        <button
                          onClick={() => openDeleteDialog(c)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Customer"
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

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedCustomer ? `Edit Customer: ${selectedCustomer.customerName}` : 'Add New Customer'}
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
              <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
              <input
                id="customer-customerName"
                type="text"
                value={formData.customerName}
                onChange={(e) => {
                  setFormData({ ...formData, customerName: e.target.value });
                  if (fieldErrors.customerName) setFieldErrors({ ...fieldErrors, customerName: '' });
                }}
                placeholder="e.g. Acme Corporation"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.customerName ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {fieldErrors.customerName && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.customerName}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                id="customer-companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g. Acme Global Inc."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address (Unique) *</label>
              <input
                id="customer-email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                }}
                placeholder="contact@acme.com"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.email ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number (Unique) *</label>
              <input
                id="customer-phone"
                type="text"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
                }}
                placeholder="e.g. 9876543210"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl transition-all ${
                  fieldErrors.phone ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              {fieldErrors.phone && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Mumbai"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="e.g. Maharashtra"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Prospect">Prospect</option>
                <option value="Lead">Lead</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. 100 Cyber Heights, Sector 1"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assigned Sales Executive</label>
            <select
              value={formData.assignedTo}
              onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
            <label className="block font-semibold text-slate-700 mb-1">Notes / Relationship Details</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Key business context, procurement requirements..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/25 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : selectedCustomer ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer 360 Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={customerDetails?.customerName || 'Customer 360 View'}
        maxWidth="max-w-4xl"
      >
        {loadingDetails ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading 360 profile...</div>
        ) : customerDetails ? (
          <div className="space-y-6 text-xs">
            {/* Customer Snapshot Header */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">{customerDetails.customerCode}</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{customerDetails.customerName}</h3>
                <p className="text-slate-500">{customerDetails.companyName || 'No corporate parent'}</p>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant={customerDetails.status}>{customerDetails.status}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1.5">Contact Details</h4>
                <p><span className="text-slate-400">Email:</span> <span className="font-semibold text-slate-800">{customerDetails.email}</span></p>
                <p><span className="text-slate-400">Phone:</span> <span className="font-semibold text-slate-800">{customerDetails.phone}</span></p>
                <p><span className="text-slate-400">Address:</span> <span className="text-slate-700">{customerDetails.address || '—'}, {customerDetails.city} {customerDetails.state}</span></p>
              </div>

              <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1.5">Account Ownership</h4>
                <p><span className="text-slate-400">Assigned To:</span> <span className="font-semibold text-slate-800">{customerDetails.assignedTo?.name || 'Unassigned'}</span></p>
                <p><span className="text-slate-400">Created By:</span> <span className="text-slate-700">{customerDetails.createdBy?.name || 'System'}</span></p>
                <p><span className="text-slate-400">Created Date:</span> <span className="text-slate-700">{new Date(customerDetails.createdAt).toLocaleDateString()}</span></p>
              </div>
            </div>

            {/* Related Opportunities */}
            <div className="border border-slate-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-900 flex items-center space-x-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span>Linked Opportunities ({customerDetails.opportunities?.length || 0})</span>
                </h4>
              </div>
              {customerDetails.opportunities?.length === 0 ? (
                <p className="text-slate-400">No active opportunities linked to this customer.</p>
              ) : (
                <div className="space-y-2">
                  {customerDetails.opportunities.map((opp) => (
                    <div key={opp._id} className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">{opp.opportunityName}</p>
                        <p className="text-[11px] text-slate-400">Amount: ${opp.amount?.toLocaleString()} &bull; Probability: {opp.probability}%</p>
                      </div>
                      <Badge variant={opp.stage}>{opp.stage}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Related Follow-Ups */}
            <div className="border border-slate-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-900 flex items-center space-x-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-600" />
                  <span>Follow-Up Activities ({customerDetails.followUps?.length || 0})</span>
                </h4>
              </div>
              {customerDetails.followUps?.length === 0 ? (
                <p className="text-slate-400">No scheduled follow-up records.</p>
              ) : (
                <div className="space-y-2">
                  {customerDetails.followUps.map((fu) => (
                    <div key={fu._id} className="p-2.5 rounded-lg bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">{fu.subject}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(fu.followUpDate).toLocaleDateString()} &bull; {fu.followUpType}
                        </p>
                      </div>
                      <Badge variant={fu.status}>{fu.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={`Are you sure you want to delete customer '${selectedCustomer?.customerName}' (${selectedCustomer?.customerCode})? This action will generate an audit log.`}
        confirmText="Confirm Delete"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
};

export default Customers;
