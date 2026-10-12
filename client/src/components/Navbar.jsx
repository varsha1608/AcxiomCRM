import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  Search,
  Bell,
  CheckCircle2,
  Calendar,
  X
} from 'lucide-react';
import Badge from './Badge';

const Navbar = ({ onToggleSidebar }) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
      {/* Left: Mobile Sidebar Toggle & Search */}
      <div className="flex items-center space-x-3 flex-1 max-w-lg min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open sidebar menu"
          className="lg:hidden p-2 rounded-xl text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
          <input
            type="text"
            placeholder="Search records, customers, leads..."
            className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#1E293B] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            className="relative p-2 rounded-xl text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#2563EB] rounded-full ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                  System Notifications
                </h4>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-start space-x-3">
                  <div className="p-1.5 bg-green-50 text-[#16A34A] rounded-lg mt-0.5 flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E293B]">Live CRM Synchronized</p>
                    <p className="text-[#64748B] text-[11px]">Database active and authenticated.</p>
                  </div>
                </div>
                <div className="py-2.5 flex items-start space-x-3">
                  <div className="p-1.5 bg-blue-50 text-[#2563EB] rounded-lg mt-0.5 flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E293B]">Follow-Ups Active</p>
                    <p className="text-[#64748B] text-[11px]">Scheduled calls and meetings monitored.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Identity Snippet */}
        <div className="flex items-center space-x-2 pl-2 sm:pl-3 border-l border-[#E2E8F0]">
          <div className="w-8 h-8 rounded-full bg-[#172554] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            {getInitials(user?.name)}
          </div>
          <div className="hidden md:block text-left min-w-0 max-w-[140px] truncate">
            <p className="text-xs font-bold text-[#1E293B] truncate leading-tight">
              {user?.name || 'CRM User'}
            </p>
            <p className="text-[10px] text-[#64748B] truncate">
              {user?.department || 'Executive'}
            </p>
          </div>
          <div className="hidden sm:block">
            <Badge variant={user?.role} size="xs">
              {user?.role || 'Guest'}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
