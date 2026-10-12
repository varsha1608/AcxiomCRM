import React from 'react';

const Badge = ({ children, variant = 'default', size = 'sm' }) => {
  const styles = {
    // Lead statuses
    New: 'bg-sky-50 text-sky-700 border-sky-200',
    Contacted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Unqualified: 'bg-slate-100 text-slate-700 border-slate-200',
    Converted: 'bg-purple-50 text-purple-700 border-purple-200',
    Lost: 'bg-rose-50 text-rose-700 border-rose-200',

    // Customer statuses
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    Prospect: 'bg-amber-50 text-amber-700 border-amber-200',
    Lead: 'bg-blue-50 text-blue-700 border-blue-200',

    // Opportunity stages
    Qualification: 'bg-sky-50 text-sky-700 border-sky-200',
    Proposal: 'bg-amber-50 text-amber-700 border-amber-200',
    Negotiation: 'bg-purple-50 text-purple-700 border-purple-200',
    Won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Open: 'bg-blue-50 text-blue-700 border-blue-200',

    // FollowUp / Activity statuses
    Planned: 'bg-blue-50 text-blue-700 border-blue-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Missed: 'bg-rose-50 text-rose-700 border-rose-200',
    Cancelled: 'bg-slate-100 text-slate-600 border-slate-200',

    // Priority
    High: 'bg-rose-50 text-rose-700 border-rose-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    Low: 'bg-slate-100 text-slate-600 border-slate-200',

    // Roles
    Admin: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
    Manager: 'bg-blue-100 text-blue-800 border-blue-300 font-semibold',
    'Sales Executive': 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',

    // Results
    SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',

    default: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const currentStyle = styles[variant] || styles[children] || styles.default;
  const sizeStyle = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center justify-center font-medium rounded-full border ${sizeStyle} ${currentStyle}`}>
      {children}
    </span>
  );
};

export default Badge;
