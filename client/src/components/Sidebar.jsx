import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Target,
  CalendarCheck,
  Activity,
  BarChart3,
  ShieldCheck,
  History,
  LogOut,
  Shield,
  X
} from 'lucide-react';
import Badge from './Badge';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, isAdmin } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Leads', path: '/leads', icon: UserPlus },
    { name: 'Opportunities', path: '/opportunities', icon: Target },
    { name: 'Follow-Ups', path: '/followups', icon: CalendarCheck },
    { name: 'Activities', path: '/activities', icon: Activity },
    { name: 'Reports', path: '/reports', icon: BarChart3 }
  ];

  if (isAdmin) {
    navItems.push(
      { name: 'User Management', path: '/users', icon: ShieldCheck, adminOnly: true },
      { name: 'Audit Logs', path: '/audit-logs', icon: History, adminOnly: true }
    );
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#172554] text-slate-200 flex flex-col transition-transform duration-300 ease-in-out border-r border-blue-900/60 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-blue-900/70 bg-[#0f1a3d]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-sm">
              <Shield className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                Acxiom<span className="text-[#38BDF8]">CRM</span>
              </span>
              <span className="block text-[10px] font-medium text-slate-400 tracking-wider uppercase">
                Enterprise Edition
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-blue-900/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Sidebar">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            CRM Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-blue-900/40 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
                {item.adminOnly && (
                  <span className="ml-auto text-[9px] bg-purple-500/25 text-purple-200 font-semibold px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-blue-900/70 bg-[#0f1a3d]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-600/30 text-blue-200 border border-blue-400/40 flex items-center justify-center font-bold text-xs flex-shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0 truncate">
                <p className="text-xs font-semibold text-white truncate" title={user?.name}>
                  {user?.name || 'CRM User'}
                </p>
                <p className="text-[10px] text-slate-400 truncate" title={user?.email}>
                  {user?.email || ''}
                </p>
                <div className="mt-1">
                  <Badge variant={user?.role} size="xs">
                    {user?.role || 'Guest'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-blue-950/60 hover:bg-red-600/20 hover:text-red-300 hover:border-red-500/40 border border-blue-900/60 transition-all duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
