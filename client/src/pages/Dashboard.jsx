import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import KPICard from '../components/KPICard';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import {
  Users,
  UserPlus,
  Target,
  DollarSign,
  TrendingUp,
  Award,
  AlertOctagon,
  Calendar,
  Activity as ActivityIcon,
  Filter,
  CheckCircle2,
  Clock,
  Shield,
  RefreshCw
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = () => {
  const { user, isAdmin, isManager, isSalesExecutive } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async (tf = timeframe, sDate = startDate, eDate = endDate) => {
    try {
      setRefreshing(true);
      let url = `/dashboard?timeframe=${tf}`;
      if (tf === 'custom' && sDate && eDate) {
        url += `&startDate=${sDate}&endDate=${eDate}`;
      }
      const res = await api.get(url);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (timeframe !== 'custom') {
      fetchDashboard(timeframe);
    }
  }, [timeframe]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">Loading AcxiomCRM Analytics...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const recentActivities = data?.recentActivities || [];
  const upcomingFollowUps = data?.upcomingFollowUps || [];
  const adminStats = data?.adminStats;

  // Chart 1: Lead Status Doughnut
  const leadStatusData = {
    labels: Object.keys(charts.leadStatus || {}),
    datasets: [
      {
        data: Object.values(charts.leadStatus || {}),
        backgroundColor: [
          '#38bdf8', // New (sky)
          '#6366f1', // Contacted (indigo)
          '#10b981', // Qualified (emerald)
          '#94a3b8', // Unqualified (slate)
          '#a855f7', // Converted (purple)
          '#f43f5e'  // Lost (rose)
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // Chart 2: Opportunity Pipeline Bar
  const oppStages = Object.keys(charts.opportunityPipeline || {});
  const oppValues = oppStages.map((s) => charts.opportunityPipeline[s]?.value || 0);
  const oppCounts = oppStages.map((s) => charts.opportunityPipeline[s]?.count || 0);

  const pipelineChartData = {
    labels: oppStages,
    datasets: [
      {
        label: 'Pipeline Value ($)',
        data: oppValues,
        backgroundColor: '#3b82f6',
        borderRadius: 8
      }
    ]
  };

  // Chart 3: Monthly Sales Trend Line
  const monthlyData = charts.monthlySales || [];
  const monthlyChartData = {
    labels: monthlyData.map((m) => m.month),
    datasets: [
      {
        label: 'Won Revenue ($)',
        data: monthlyData.map((m) => m.wonRevenue),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointRadius: 4
      }
    ]
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome & Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {isAdmin
                ? 'System Administrator Dashboard'
                : isManager
                ? 'Sales Manager Dashboard'
                : 'Sales Executive Dashboard'}
            </h1>
            <Badge variant={user?.role}>{user?.role}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Here is your CRM pipeline overview.
          </p>
        </div>

        {/* Timeframe Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-sm">
            {['all', 'this_month', 'this_week', 'today', 'custom'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tf.replace('_', ' ')}
              </button>
            ))}
            <button
              onClick={() => fetchDashboard(timeframe, startDate, endDate)}
              disabled={refreshing}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors ml-1"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>

          {timeframe === 'custom' && (
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
              />
              <button
                onClick={() => fetchDashboard('custom', startDate, endDate)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors"
              >
                Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Customers"
          value={kpis.totalCustomers || 0}
          subtitle="Active client accounts"
          icon={Users}
          color="blue"
        />
        <KPICard
          title="Total Leads"
          value={kpis.totalLeads || 0}
          subtitle={`${kpis.openLeads || 0} active / unqualified`}
          icon={UserPlus}
          color="indigo"
        />
        <KPICard
          title="Total Pipeline Value"
          value={formatCurrency(kpis.totalPipelineValue)}
          subtitle={`Weighted: ${formatCurrency(kpis.weightedPipelineValue)}`}
          icon={DollarSign}
          color="purple"
        />
        <KPICard
          title="Won Opportunities"
          value={kpis.wonOpportunities || 0}
          subtitle={`Closed won: ${formatCurrency(kpis.totalWonRevenue)}`}
          icon={Award}
          color="emerald"
        />
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Opportunities</span>
          <p className="text-xl font-bold text-blue-600 mt-1">{kpis.openOpportunities || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lost Deals</span>
          <p className="text-xl font-bold text-rose-600 mt-1">{kpis.lostOpportunities || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Follow-Ups</span>
          <p className="text-xl font-bold text-amber-600 mt-1">{kpis.pendingFollowUps || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weighted Forecast</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(kpis.weightedPipelineValue)}</p>
        </div>
      </div>

      {/* Admin Security Banner (if Admin) */}
      {isAdmin && adminStats && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#172554] text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Security & User Administration Status</h3>
              <p className="text-xs text-slate-500">System account lockout protection and user management active.</p>
            </div>
          </div>
          <div className="flex items-center space-x-6 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Total Users: </span>
              <span className="font-bold text-slate-900">{adminStats.totalUsers}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Active: </span>
              <span className="font-bold text-emerald-600">{adminStats.activeUsers}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Locked Accounts: </span>
              <span className={`font-bold ${adminStats.lockedUsers > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {adminStats.lockedUsers}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Working Chart.js Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opportunity Pipeline Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Opportunity Sales Pipeline</h3>
              <p className="text-xs text-slate-500">Distribution of deal amounts across active sales stages</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            {oppValues.some((v) => v > 0) ? (
              <Bar
                data={pipelineChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (v) => `$${v / 1000}k`
                      }
                    }
                  }
                }}
              />
            ) : (
              <EmptyState title="No Pipeline Data" message="Create opportunities to populate stage analytics." />
            )}
          </div>
        </div>

        {/* Lead Status Breakdown Doughnut */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Lead Status Breakdown</h3>
            <p className="text-xs text-slate-500">Proportion of leads by qualification stage</p>
          </div>
          <div className="h-64 flex items-center justify-center">
            {Object.values(charts.leadStatus || {}).some((v) => v > 0) ? (
              <Doughnut
                data={leadStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 10, font: { size: 11 } }
                    }
                  }
                }}
              />
            ) : (
              <EmptyState title="No Leads" message="Create leads to view qualification breakdown." />
            )}
          </div>
        </div>
      </div>

      {/* Monthly Sales Revenue Trend Line Chart */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Monthly Won Sales Trend</h3>
            <p className="text-xs text-slate-500">Trailing performance of closed won opportunity values</p>
          </div>
        </div>
        <div className="h-60">
          <Line
            data={monthlyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (v) => `$${v / 1000}k`
                  }
                }
              }
            }}
          />
        </div>
      </div>

      {/* Bottom Row: Upcoming Follow-ups & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Follow-ups Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Upcoming Follow-Ups</h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">Next Scheduled</span>
          </div>

          {upcomingFollowUps.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No upcoming follow-ups scheduled.</p>
          ) : (
            <div className="space-y-3">
              {upcomingFollowUps.map((item) => (
                <div
                  key={item._id}
                  className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-slate-800 truncate">{item.subject}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {item.customerId?.customerName || item.leadId?.leadName || 'General Contact'} &bull;{' '}
                      {new Date(item.followUpDate).toLocaleDateString()} at{' '}
                      {new Date(item.followUpDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant={item.followUpType} size="xs">{item.followUpType}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <ActivityIcon className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent CRM Activities</h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">Audit Stream</span>
          </div>

          {recentActivities.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No CRM activities recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((act) => (
                <div
                  key={act._id}
                  className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-slate-800 truncate">{act.subject}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Logged by {act.assignedTo?.name || 'User'} &bull;{' '}
                      {new Date(act.activityDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={act.activityType} size="xs">{act.activityType}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
