/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Settings, 
  Bell, 
  LogOut, 
  Search, 
  Plus, 
  Filter,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  UserCircle,
  Menu,
  X,
  Download,
  Upload,
  AirVent,
  Eye,
  EyeOff,
  CheckCircle,
  TrendingUp,
  Database,
  Award,
  Activity,
  Phone,
  PhoneOff,
  Edit2,
  Trash2,
  FileText,
  FileSpreadsheet,
  Calendar,
  Info,
  Wrench,
  Share2,
  Pause,
  Lock,
  Layers,
  Palette,
  Star
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from './utils';
import { Role, User, Task, Attendance, TaskLog, TaskStatus, PointTransaction, TechnicianPerformance } from './types';
import { toast, Toaster } from 'sonner';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// --- Context ---
const ThemeContext = React.createContext('dark');

// --- Components ---

const GlassCard = ({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => {
  const theme = React.useContext(ThemeContext);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        theme === 'light' 
          ? "bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/50"
          : "bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  color = "text-blue-500",
  count = 0
}: { 
  icon: any, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  color?: string,
  count?: number
}) => {
  const theme = React.useContext(ThemeContext);
  
  return (
    <motion.button
      whileHover={{ scale: 1.05, x: 5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-300 relative group",
        active 
          ? theme === 'light'
            ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600 shadow-sm"
            : "bg-blue-600/10 text-blue-400 border-l-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
          : theme === 'light'
            ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon 
        size={20} 
        className={cn(
          "transition-colors duration-300",
          active ? color : "text-gray-400 group-hover:" + color
        )} 
      />
      <span className="font-semibold text-sm tracking-wide flex-1 text-left">{label}</span>
      
      {count > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-red-500/20">
          {count}
        </span>
      )}

      {active && (
        <motion.div
          layoutId="activeNav"
          className="absolute inset-0 bg-blue-500/5 rounded-xl -z-10"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );
};

const StatCard = ({ label, value, icon: Icon, color, trend }: { label: string, value: string | number, icon: any, color: string, trend?: string }) => (
  <GlassCard className="flex items-center justify-between">
    <div>
      <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{label}</p>
      <h3 className="text-3xl font-bold mt-1 text-white">{value}</h3>
      {trend && <p className="text-xs text-green-400 mt-2 font-medium">{trend}</p>}
    </div>
    <div className={cn("p-4 rounded-2xl", color)}>
      <Icon size={24} className="text-white" />
    </div>
  </GlassCard>
);

const ReportingPanel = ({ tasks, staff, user }: { tasks: Task[], staff: User[], user: User | null }) => {
  const [reportType, setReportType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('DAILY');
  const [startDate, setStartDate] = useState(new Date(new Date().setHours(0,0,0,0)).toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 16));
  const [selectedEngineer, setSelectedEngineer] = useState<string>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (user?.role === 'ENGINEER') {
      setSelectedEngineer(user.employeeId);
    }
  }, [user]);

  // Helper to find the engineer responsible for a staff member
  const getResponsibleEngineerId = (s: User | undefined) => {
    if (!s) return null;
    if (s.role === 'ENGINEER') return s.employeeId;
    if (s.role === 'OFFICER') {
      const eng = staff.find(e => e.id === s.supervisorId && e.role === 'ENGINEER');
      return eng?.employeeId || null;
    }
    if (s.role === 'TECHNICIAN') {
      const supervisor = staff.find(sup => sup.id === s.supervisorId);
      if (supervisor?.role === 'OFFICER') {
        const eng = staff.find(e => e.id === supervisor.supervisorId && e.role === 'ENGINEER');
        return eng?.employeeId || null;
      }
      if (supervisor?.role === 'ENGINEER') {
        return supervisor.employeeId;
      }
    }
    return null;
  };

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A';
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getReportData = (filteredTasks: Task[]) => {
    const role = user?.role;
    let headers: string[] = ['ID', 'Title', 'Model'];
    
    if (role === 'ENGINEER') {
      headers.push('Assigned Officer', 'Status', 'Deadline', 'Completed At', 'Time Taken', 'History');
    } else if (role === 'OFFICER') {
      headers.push('Assigned Engineer', 'Assigned Technician', 'Status', 'Deadline', 'Completed At', 'Time Taken', 'History');
    } else {
      // Super Admin / HOD / In-Charge / Model Manager
      headers.push('Engineer', 'Officer', 'Technician', 'Status', 'Deadline', 'Completed At', 'Time Taken', 'History');
    }

    const rows = filteredTasks.map(t => {
      const row: any[] = [t.taskId, t.title, t.model];
      
      const creator = staff.find(s => s.employeeId === t.createdBy);
      const assigner = staff.find(s => s.employeeId === t.assignedBy);
      const assignee = staff.find(s => s.name.toLowerCase().trim() === t.assignedTo.toLowerCase().trim());

      // Logic to find Engineer, Officer, Technician
      const findEngineer = (s: User | undefined) => {
        if (!s) return null;
        if (s.role === 'ENGINEER') return s;
        if (s.role === 'OFFICER') return staff.find(e => e.id === s.supervisorId && e.role === 'ENGINEER');
        if (s.role === 'TECHNICIAN') {
          const officer = staff.find(o => o.id === s.supervisorId && o.role === 'OFFICER');
          return officer ? staff.find(e => e.id === officer.supervisorId && e.role === 'ENGINEER') : null;
        }
        return null;
      };
      
      const engineer = findEngineer(creator) || findEngineer(assigner) || findEngineer(assignee);
      const engineerName = engineer?.name || 'N/A';
      
      const findOfficer = (s: User | undefined) => {
        if (!s) return null;
        if (s.role === 'OFFICER') return s;
        if (s.role === 'TECHNICIAN') return staff.find(o => o.id === s.supervisorId && o.role === 'OFFICER');
        return null;
      };
      
      const officer = findOfficer(creator) || findOfficer(assigner) || findOfficer(assignee);
      const officerName = officer?.name || 'N/A';
      
      const technician = [creator, assigner, assignee].find(s => s?.role === 'TECHNICIAN');
      const technicianName = technician?.name || 'N/A';

      const history = (t.logs || []).map(l => `[${new Date(l.timestamp).toLocaleString()}] ${l.action} by ${l.user}`).join('\n');

      if (role === 'ENGINEER') {
        row.push(officerName, t.status, new Date(t.deadline).toLocaleString(), t.completedAt ? new Date(t.completedAt).toLocaleString() : 'N/A', calculateDuration(t.startedAt, t.completedAt), history);
      } else if (role === 'OFFICER') {
        row.push(engineerName, technicianName, t.status, new Date(t.deadline).toLocaleString(), t.completedAt ? new Date(t.completedAt).toLocaleString() : 'N/A', calculateDuration(t.startedAt, t.completedAt), history);
      } else {
        row.push(engineerName, officerName, technicianName, t.status, new Date(t.deadline).toLocaleString(), t.completedAt ? new Date(t.completedAt).toLocaleString() : 'N/A', calculateDuration(t.startedAt, t.completedAt), history);
      }
      return row;
    });

    return { headers, rows };
  };

  const getFilteredTasks = () => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    if (reportType === 'DAILY') {
      start.setHours(0, 0, 0, 0);
    } else if (reportType === 'WEEKLY') {
      start.setDate(now.getDate() - 7);
    } else if (reportType === 'MONTHLY') {
      start.setMonth(now.getMonth() - 1);
    } else if (reportType === 'CUSTOM') {
      start = new Date(startDate);
      end = new Date(endDate);
    }

    return tasks.filter(t => {
      if (user?.role === 'TECHNICIAN') {
        return t.assignedTo.toLowerCase().trim() === user.name.toLowerCase().trim();
      }
      
      const taskDate = new Date(t.createdAt);
      
      // Date filtering
      let dateMatch = false;
      if (reportType === 'CUSTOM') {
        dateMatch = taskDate >= start && taskDate <= end;
      } else {
        dateMatch = taskDate >= start;
      }
      if (!dateMatch) return false;

      const creator = staff.find(s => s.employeeId === t.createdBy);
      const assigner = staff.find(s => s.employeeId === t.assignedBy);
      const assignee = staff.find(s => s.name.toLowerCase().trim() === t.assignedTo.toLowerCase().trim());

      const creatorEngId = getResponsibleEngineerId(creator);
      const assignerEngId = getResponsibleEngineerId(assigner);
      const assigneeEngId = getResponsibleEngineerId(assignee);

      // Role-based scope filtering
      if (user?.role === 'MODEL_MANAGER') {
        const model = t.model;
        const myEmpId = user.employeeId;
        let isModelMatch = false;
        
        if (model === 'General Work') {
          isModelMatch = myEmpId === '41053';
        } else if (myEmpId === '38056') {
          isModelMatch = ['12K', '9K', 'Portable'].includes(model);
        } else if (myEmpId === '37091') {
          isModelMatch = ['18K'].includes(model);
        } else if (myEmpId === '41053') {
          isModelMatch = ['24K', '30K', '36K'].includes(model);
        }
        
        // Check engineer scope for Model Manager
        const assignedEngs = user.assignedEngineers || [];
        const isCreatorInScope = creatorEngId && assignedEngs.includes(creatorEngId);
        const isAssignerInScope = assignerEngId && assignedEngs.includes(assignerEngId);
        const isAssigneeInScope = assigneeEngId && assignedEngs.includes(assigneeEngId);
        const isCreatedByMe = t.createdBy === user.employeeId;
        const isAssignedByMe = t.assignedBy === user.employeeId;

        const isInScope = isCreatorInScope || isAssignerInScope || isAssigneeInScope || isCreatedByMe || isAssignedByMe;
        
        // Show if it's in scope OR matches the model
        if (!(isInScope || isModelMatch)) return false;
      }

      if (user?.role === 'IN_CHARGE') {
        // In-Charge: Must be within engineer scope (including officers and technicians under them)
        const assignedEngs = user.assignedEngineers || [];
        const isCreatorInScope = creatorEngId && assignedEngs.includes(creatorEngId);
        const isAssignerInScope = assignerEngId && assignedEngs.includes(assignerEngId);
        const isAssigneeInScope = assigneeEngId && assignedEngs.includes(assigneeEngId);
        const isCreatedByMe = t.createdBy === user.employeeId;
        const isAssignedByMe = t.assignedBy === user.employeeId;

        if (!(isCreatorInScope || isAssignerInScope || isAssigneeInScope || isCreatedByMe || isAssignedByMe)) return false;
      }

      if (user?.role === 'ENGINEER') {
        // Engineer: Only see tasks where they are the responsible engineer
        if (![creatorEngId, assignerEngId, assigneeEngId].includes(user.employeeId)) return false;
      }

      if (user?.role === 'OFFICER') {
        // Officer: Only see tasks they created, assigned, or are assigned to them/their technicians
        const isCreatorMe = t.createdBy === user.employeeId;
        const isAssignerMe = t.assignedBy === user.employeeId;
        const isAssigneeMe = assignee?.employeeId === user.employeeId;
        const isAssigneeMyTech = assignee?.role === 'TECHNICIAN' && assignee.supervisorId === user.id;
        
        if (!(isCreatorMe || isAssignerMe || isAssigneeMe || isAssigneeMyTech)) return false;
      }

      // Engineer filtering (if a specific engineer is selected)
      if (selectedEngineer !== 'ALL') {
        const isInvolved = [creatorEngId, assignerEngId, assigneeEngId].includes(selectedEngineer);
        return isInvolved;
      }

      return true;
    });
  };

  const scopedEngineers = staff.filter(s => {
    if (s.role !== 'ENGINEER') return false;
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'HOD') return true;
    if (user?.role === 'ENGINEER' && s.employeeId === user.employeeId) return true;
    if (user?.assignedEngineers && user.assignedEngineers.length > 0) {
      return user.assignedEngineers.includes(s.employeeId);
    }
    return false;
  });

  const generatePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const filteredTasks = getFilteredTasks();
    const { headers, rows } = getReportData(filteredTasks);
    
    doc.setFontSize(20);
    doc.text(`Task Report - ${reportType}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Generated by: ${user?.name} (${user?.role})`, 14, 38);
    if (selectedEngineer !== 'ALL') {
      const eng = staff.find(s => s.employeeId === selectedEngineer);
      doc.text(`Engineer: ${eng?.name || 'Unknown'} (${selectedEngineer})`, 14, 46);
    }
    if (reportType === 'CUSTOM') {
      doc.text(`Range: ${startDate} to ${endDate}`, 14, selectedEngineer !== 'ALL' ? 54 : 46);
    }

    autoTable(doc, {
      startY: reportType === 'CUSTOM' || selectedEngineer !== 'ALL' ? 60 : 45,
      head: [headers],
      body: rows,
      didDrawPage: (data) => {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          "Software development by Jahid Hasan (38250) RAC R&I",
          pageSize.width / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    doc.save(`Task_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateExcel = () => {
    const filteredTasks = getFilteredTasks();
    const { headers, rows } = getReportData(filteredTasks);
    
    // Convert rows to objects for Excel
    const data = rows.map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add footer row
    const footerRow = [['Software development by Jahid Hasan (38250) RAC R&I']];
    XLSX.utils.sheet_add_aoa(ws, footerRow, { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, `Task_Report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filtered = getFilteredTasks();
  const stats = {
    total: filtered.length,
    completed: filtered.filter(t => t.status === 'COMPLETED').length,
    running: filtered.filter(t => t.status === 'RUNNING').length,
    pending: filtered.filter(t => t.status === 'PENDING').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            {(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                  reportType === type ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
            <Users size={16} className="text-gray-400 ml-2" />
            <select 
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none min-w-[150px]"
            >
              <option value="ALL" className="bg-[#0f0f12]">All Assigned Engineers</option>
              {scopedEngineers.map(eng => (
                <option key={eng.id} value={eng.employeeId} className="bg-[#0f0f12]">
                  {eng.name} ({eng.employeeId})
                </option>
              ))}
            </select>
          </div>

          {reportType === 'CUSTOM' && (
            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
              <input 
                type="datetime-local" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none"
              />
              <span className="text-gray-500 text-xs">to</span>
              <input 
                type="datetime-local" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none"
              />
            </div>
          )}
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-xl font-bold border border-red-500/20 transition-all"
          >
            <FileText size={20} />
            Export PDF
          </button>
          <button 
            onClick={generateExcel}
            className="flex items-center gap-2 px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-xl font-bold border border-green-500/20 transition-all"
          >
            <FileSpreadsheet size={20} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Total Tasks</p>
          <h4 className="text-3xl font-bold mt-2">{stats.total}</h4>
        </div>
        <div className="bg-green-500/10 p-6 rounded-2xl border border-green-500/20">
          <p className="text-green-500 text-xs uppercase tracking-widest font-bold">Completed</p>
          <h4 className="text-3xl font-bold mt-2 text-green-500">{stats.completed}</h4>
        </div>
        <div className="bg-amber-500/10 p-6 rounded-2xl border border-amber-500/20">
          <p className="text-amber-500 text-xs uppercase tracking-widest font-bold">Running</p>
          <h4 className="text-3xl font-bold mt-2 text-amber-500">{stats.running}</h4>
        </div>
        <div className="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20">
          <p className="text-blue-500 text-xs uppercase tracking-widest font-bold">Pending</p>
          <h4 className="text-3xl font-bold mt-2 text-blue-500">{stats.pending}</h4>
        </div>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Report Preview</h3>
          <span className="text-xs text-gray-500">Showing {filtered.length} tasks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Task ID</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned To</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                  <td className="py-4 px-4 text-sm font-mono text-gray-400">{t.taskId}</td>
                  <td className="py-4 px-4 text-sm font-bold">{t.title}</td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {(() => {
                      const assignee = staff.find(s => s.id === t.assignedTo || s.name.toLowerCase().trim() === t.assignedTo.toLowerCase().trim());
                      if (assignee?.role === 'TECHNICIAN') {
                        const officer = staff.find(o => o.id === assignee.supervisorId);
                        return officer?.name || 'Officer';
                      }
                      return assignee?.name || t.assignedTo;
                    })()}
                  </td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                      t.status === 'COMPLETED' ? "bg-green-500/20 text-green-500" :
                      t.status === 'RUNNING' ? "bg-amber-500/20 text-amber-500" :
                      "bg-blue-500/20 text-blue-500"
                    )}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-bold">{t.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('attendance');
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [showDistributeModal, setShowDistributeModal] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [showQualityModal, setShowQualityModal] = useState<string | null>(null);
  const [taskQuality, setTaskQuality] = useState(5);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginData, setLoginData] = useState({ employeeId: '', password: '' });
  const [loginColors, setLoginColors] = useState({ id: '#3b82f6', pw: '#3b82f6' });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [resetPasswordData, setResetPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTaskId, setRejectTaskId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Track if any modal is open to prevent interruptions
  const isAnyModalOpen = isTaskModalOpen || isStaffModalOpen || isTaskDetailsModalOpen || isStatusUpdateModalOpen || isChangePasswordModalOpen || isResetPasswordModalOpen || isRejectModalOpen;

  const getRandomColor = () => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, employeeId: e.target.value });
    setLoginColors({ ...loginColors, id: getRandomColor() });
  };

  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, password: e.target.value });
    setLoginColors({ ...loginColors, pw: getRandomColor() });
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<{urgency?: string, reason?: string, delayPrediction?: any} | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiCache = useRef<Record<string, any>>({});

  // Helper for safe JSON fetching
  const fetchJson = async (url: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(url, options);
      
      // Handle 204 No Content success
      if (res.status === 204) {
        return null;
      }

      const contentType = res.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`Non-JSON response from ${url} (Status ${res.status}):`, text.slice(0, 500));
        throw new Error(`Server returned an unexpected response format (HTML instead of JSON). Status: ${res.status}`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error(`Fetch error for ${url}:`, err);
      throw err;
    }
  };

  // Helper functions for hierarchy
  const getResponsibleEngineerId = (u: User | undefined): string | null => {
    if (!u) return null;
    if (u.role === 'ENGINEER') return u.employeeId;
    
    // Get live data for the user to ensure we have the latest assignedEngineers
    const liveUser = staffList.find(s => s.id === u.id) || u;
    
    if (liveUser.role === 'OFFICER') {
      // For Officers, the responsible engineer is the first one in their assignedEngineers list
      const assignedEngs = liveUser.assignedEngineers || [];
      return assignedEngs.length > 0 ? assignedEngs[0] : null;
    }
    
    if (liveUser.role === 'TECHNICIAN') {
      const supervisor = staffList.find(sup => sup.id === liveUser.supervisorId);
      if (supervisor?.role === 'OFFICER') {
        const assignedEngs = supervisor.assignedEngineers || [];
        return assignedEngs.length > 0 ? assignedEngs[0] : null;
      }
      if (supervisor?.role === 'ENGINEER') {
        return supervisor.employeeId;
      }
    }
    return null;
  };

  const isStaffInScope = (staff: User): boolean => {
    if (!user) return false;
    
    // Get current user's live data for real-time sync
    const currentUserData = staffList.find(u => u.id === user.id) || user;
    const myEmpId = currentUserData.employeeId;
    
    if (currentUserData.role === 'SUPER_ADMIN' || currentUserData.role === 'HOD') return true;
    
    if (currentUserData.role === 'IN_CHARGE' || currentUserData.role === 'MODEL_MANAGER') {
      const myAssignedEngs = currentUserData.assignedEngineers || [];
      
      // If it's an engineer, check if they are assigned to me
      if (staff.role === 'ENGINEER') return myAssignedEngs.includes(staff.employeeId);
      
      // If it's an officer, check if any of their assigned engineers are assigned to me
      if (staff.role === 'OFFICER') {
        const officerEngs = staff.assignedEngineers || [];
        return officerEngs.some(engId => myAssignedEngs.includes(engId));
      }
      
      // If it's a technician, check their officer's assigned engineers
      if (staff.role === 'TECHNICIAN') {
        const officer = staffList.find(s => s.id === staff.supervisorId);
        if (officer?.role === 'OFFICER') {
          const officerEngs = officer.assignedEngineers || [];
          return officerEngs.some(engId => myAssignedEngs.includes(engId));
        }
        if (officer?.role === 'ENGINEER') {
          return myAssignedEngs.includes(officer.employeeId);
        }
      }
      return false;
    }
    
    if (currentUserData.role === 'OFFICER') {
      // Officer can see their Technicians
      if (staff.role === 'TECHNICIAN') return staff.supervisorId === currentUserData.id;
      // Officer can see Engineers/Authorities assigned to them
      const myAssignedEngs = currentUserData.assignedEngineers || [];
      return myAssignedEngs.includes(staff.employeeId);
    }
    
    if (currentUserData.role === 'ENGINEER') {
      // Engineer can see Officers who have them in assignedEngineers
      if (staff.role === 'OFFICER') {
        return (staff.assignedEngineers || []).includes(myEmpId);
      }
      // Engineer can see Technicians whose Officer is assigned to them
      if (staff.role === 'TECHNICIAN') {
        const supervisor = staffList.find(s => s.id === staff.supervisorId);
        return supervisor?.role === 'OFFICER' && (supervisor.assignedEngineers || []).includes(myEmpId);
      }
      return false;
    }
    
    return staff.id === currentUserData.id;
  };

  const fetchNotifications = async (token: string) => {
    try {
      const data = await fetchJson('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(data);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  };

  const markNotificationRead = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetchJson(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNotifications(token!);
    } catch (err) {
      console.error('Mark notification read error:', err);
    }
  };

  const clearNotifications = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetchJson('/api/notifications', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications([]);
    } catch (err) {
      console.error('Clear notifications error:', err);
    }
  };

  const calculatePerformance = (staff: User) => {
    if (staff.role === 'OFFICER') {
      const myPoints = pointTransactions.filter(pt => pt.officerId === staff.id);
      const totalPoints = myPoints.reduce((acc, pt) => acc + (pt.pointValue || 0), 0);
      
      // Task Performance (60 marks) - Max 60 marks
      const taskScore = Math.min(60, totalPoints);
      
      // Attendance (10 marks)
      const myAttendance = attendance.filter(a => a.technicianId === staff.employeeId);
      const presentDays = myAttendance.filter(a => a.status === 'PRESENT').length;
      const attendanceScore = myAttendance.length > 0 ? (presentDays / myAttendance.length) * 10 : 10;
      
      // Efficiency (30 marks) - Based on on-time completion of tasks they assigned
      const myAssignedTasks = tasks.filter(t => t.assignedBy === staff.employeeId && t.status === 'COMPLETED');
      const onTimeTasks = myAssignedTasks.filter(t => {
        if (!t.completedAt || !t.deadline) return true;
        return new Date(t.completedAt) <= new Date(t.deadline);
      }).length;
      const efficiencyScore = myAssignedTasks.length > 0 ? (onTimeTasks / myAssignedTasks.length) * 30 : 30;

      return {
        taskScore: Math.round(taskScore * 10) / 10,
        attendanceScore: Math.round(attendanceScore * 10) / 10,
        efficiencyScore: Math.round(efficiencyScore * 10) / 10,
        total: Math.round((taskScore + attendanceScore + efficiencyScore) * 10) / 10
      };
    }

    if (staff.role === 'TECHNICIAN') {
      const myPerf = technicianPerformance.filter(tp => tp.technicianId === staff.employeeId);
      if (myPerf.length === 0) return { taskScore: 0, attendanceScore: 10, efficiencyScore: 30, total: 40 };

      const avgEfficiency = myPerf.reduce((acc, tp) => acc + (tp.efficiencyScore || 0), 0) / myPerf.length;
      const avgSpeed = myPerf.reduce((acc, tp) => acc + (tp.completionSpeedScore || 0), 0) / myPerf.length;
      
      // Attendance (10 marks)
      const myAttendance = attendance.filter(a => a.technicianId === staff.employeeId);
      const presentDays = myAttendance.filter(a => a.status === 'PRESENT').length;
      const attendanceScore = myAttendance.length > 0 ? (presentDays / myAttendance.length) * 10 : 10;

      return {
        taskScore: Math.round(avgSpeed * 10) / 10,
        attendanceScore: Math.round(attendanceScore * 10) / 10,
        efficiencyScore: Math.round(avgEfficiency * 10) / 10,
        total: Math.round((avgSpeed + attendanceScore + avgEfficiency) * 10) / 10
      };
    }

    // Default for other roles
    return { taskScore: 0, attendanceScore: 10, efficiencyScore: 30, total: 40 };
  };

  const filteredTasks = useMemo(() => {
    if (!user) return [];
    if (user.role === 'SUPER_ADMIN' || user.role === 'HOD') return tasks;
    
    // Get current user's live data for real-time sync
    const currentUserData = staffList.find(u => u.id === user.id) || user;
    const myName = currentUserData.name.toLowerCase();
    const myEmpId = currentUserData.employeeId;
    const myAssignedEngs = currentUserData.assignedEngineers || [];

    return tasks.filter(t => {
      // For Model Manager: Strict model-wise isolation AND assigned engineer scope
      if (currentUserData.role === 'MODEL_MANAGER') {
        const model = t.model;
        let isModelMatch = false;
        
        if (model === 'General Work') {
          isModelMatch = myEmpId === '41053';
        } else if (myEmpId === '38056') {
          isModelMatch = ['12K', '9K', 'Portable'].includes(model);
        } else if (myEmpId === '37091') {
          isModelMatch = ['18K'].includes(model);
        } else if (myEmpId === '41053') {
          isModelMatch = ['24K', '30K', '36K'].includes(model);
        }
        
        // Check engineer scope for Model Manager
        const creator = staffList.find(s => s.employeeId === t.createdBy);
        const assigner = staffList.find(s => s.employeeId === t.assignedBy);
        const assignee = staffList.find(s => s.name.toLowerCase().trim() === t.assignedTo.toLowerCase().trim());

        const creatorEngId = getResponsibleEngineerId(creator);
        const assignerEngId = getResponsibleEngineerId(assigner);
        const assigneeEngId = getResponsibleEngineerId(assignee);

        const isCreatorInScope = creatorEngId && myAssignedEngs.includes(creatorEngId);
        const isAssignerInScope = assignerEngId && myAssignedEngs.includes(assignerEngId);
        const isAssigneeInScope = assigneeEngId && myAssignedEngs.includes(assigneeEngId);
        const isCreatedByMe = t.createdBy === myEmpId;
        const isAssignedByMe = t.assignedBy === myEmpId;

        const isInScope = isCreatorInScope || isAssignerInScope || isAssigneeInScope || isCreatedByMe || isAssignedByMe;

        // Show if it's in scope OR matches the model
        return isInScope || isModelMatch;
      }

      // For In-Charge: Only see tasks of assigned engineers, or tasks they created/assigned
      if (currentUserData.role === 'IN_CHARGE') {
        const creator = staffList.find(s => s.employeeId === t.createdBy);
        const assigner = staffList.find(s => s.employeeId === t.assignedBy);
        const assignee = staffList.find(s => s.name.toLowerCase().trim() === t.assignedTo.toLowerCase().trim());
        
        const creatorEngId = getResponsibleEngineerId(creator);
        const assignerEngId = getResponsibleEngineerId(assigner);
        const assigneeEngId = getResponsibleEngineerId(assignee);
        
        const isCreatorInScope = creatorEngId && myAssignedEngs.includes(creatorEngId);
        const isAssignerInScope = assignerEngId && myAssignedEngs.includes(assignerEngId);
        const isAssigneeInScope = assigneeEngId && myAssignedEngs.includes(assigneeEngId);
        
        const isCreatedByMe = t.createdBy === myEmpId;
        const isAssignedByMe = t.assignedBy === myEmpId;
        
        return isCreatorInScope || isAssignerInScope || isAssigneeInScope || isCreatedByMe || isAssignedByMe;
      }

      const assignedTo = t.assignedTo.toLowerCase();
      const isAssignedToMe = assignedTo === myName;
      const isCreatedByMe = t.createdBy === myEmpId;
      const isAssignedByMe = t.assignedBy === myEmpId;
      
      // Check if assigned to a subordinate (one-to-many)
      const subordinates = staffList.filter(s => s.supervisorId === currentUserData.id).map(s => s.name.toLowerCase());
      const isAssignedToSubordinate = subordinates.includes(assignedTo);
      
      // Check if assigned to someone who has this user mapped (many-to-many)
      const assignee = staffList.find(s => s.name.toLowerCase() === assignedTo);
      const isAssignedToMappedUser = assignee?.assignedEngineers?.includes(myEmpId);
      
      // Check if I have this user mapped (many-to-many)
      const isMappedToMe = assignee && myAssignedEngs.includes(assignee.employeeId);
      
      return isAssignedToMe || isAssignedToSubordinate || isCreatedByMe || isAssignedByMe || isAssignedToMappedUser || isMappedToMe;
    });
  }, [tasks, user, staffList]);

  const dashboardTasks = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return filteredTasks.filter(t => {
      const taskDate = new Date(t.createdAt);
      return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear;
    });
  }, [filteredTasks]);

  const [isProcessingEmployees, setIsProcessingEmployees] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [viewingStaff, setViewingStaff] = useState<User | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({
    employeeId: '',
    name: '',
    role: 'TECHNICIAN' as Role,
    password: '',
    avatar: '',
    supervisorId: '',
    assignedEngineers: [] as string[],
    phone: '',
    designation: '',
    email: '',
    department: 'RAC R&I'
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsLoggedIn(true);
        fetchTasks(token);
        const userObj = JSON.parse(savedUser);
        if (userObj.role === 'SUPER_ADMIN') {
          // Auto-process employees on load for Super Admin
          handleProcessEmployees(true);
        }
        if (['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(userObj.role)) {
          fetchStaff(token);
          fetchAttendance(token);
        }
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      if (activeTab === 'reports') {
        fetchTasks(token, true);
      } else {
        fetchTasks(token, false);
      }
    }
  }, [activeTab]);

  const fetchStaff = async (token: string, skipUserUpdate = false) => {
    try {
      const data = await fetchJson('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (Array.isArray(data)) {
        setStaffList(data);
        // Update current user state if found in the list to reflect live mapping changes
        // But skip it if a modal is open to avoid a full-app re-render that might disrupt typing
        if (user && !skipUserUpdate) {
          const updatedMe = data.find(u => u.id === user.id);
          if (updatedMe && JSON.stringify(updatedMe) !== JSON.stringify(user)) {
            setUser(updatedMe);
            localStorage.setItem('user', JSON.stringify(updatedMe));
          }
        }
      }
    } catch (err) {
      console.error('Fetch staff error:', err);
    }
  };

  const fetchAttendance = async (token: string) => {
    try {
      const data = await fetchJson('/api/attendance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAttendance(data);
    } catch (err) {
      console.error('Fetch attendance error:', err);
    }
  };

  const handleUpdateAttendance = async (technicianId: string, status: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetchJson('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ technicianId, status })
      });
      fetchAttendance(token!);
    } catch (err) {
      console.error('Update attendance error:', err);
    }
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9)); // High quality JPEG
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Increased to 5MB for better source quality
        toast.error("File is too large. Please choose an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setNewStaff({ ...newStaff, avatar: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingStaff ? `/api/users/${editingStaff.id}` : '/api/users';
      const method = editingStaff ? 'PUT' : 'POST';
      
      let staffData = { ...newStaff };
      if (staffData.phone && !staffData.phone.startsWith('0') && /^\d+$/.test(staffData.phone)) {
        staffData.phone = '0' + staffData.phone;
      }

      const data = await fetchJson(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(staffData)
      });
      
      setIsStaffModalOpen(false);
      setEditingStaff(null);
      setNewStaff({ employeeId: '', name: '', role: 'TECHNICIAN', password: '', avatar: '', supervisorId: '', assignedEngineers: [], phone: '', designation: '', email: '', department: 'RAC R&I' });
      fetchStaff(token!);
    } catch (err) {
      console.error('Staff submit error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetchJson('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          currentPassword: passwordData.currentPassword, 
          newPassword: passwordData.newPassword 
        })
      });
      toast.success("Password changed successfully");
      setIsChangePasswordModalOpen(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetchJson(`/api/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: resetPasswordData.newPassword })
      });
      toast.success(`Password for ${resetPasswordUser.name} reset successfully`);
      setIsResetPasswordModalOpen(false);
      setResetPasswordUser(null);
      setResetPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetchJson(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setStaffToDelete(null);
      fetchStaff(token!);
      toast.success('Staff member deleted successfully');
    } catch (err: any) {
      console.error('Delete staff error:', err);
      toast.error(err.message || 'An unexpected error occurred');
    }
  };

  const handleBackup = async () => {
    try {
      console.log('Initiating backup...');
      const token = localStorage.getItem('token');
      const data = await fetchJson('/api/system/backup', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Backup data received:', data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily_work_update_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      console.log('Backup download triggered');
    } catch (err) {
      console.error('Backup error:', err);
      toast.error('Failed to download backup');
    }
  };

  const handlePanelBackup = async (type: 'tasks' | 'full', format: 'json' | 'excel') => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/backup/${user?.role}/${type}?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Backup failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'json' ? 'json' : 'xlsx';
      a.download = `backup_${user?.role?.toLowerCase()}_${type}_${new Date().toISOString().slice(0,10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Panel backup error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to download backup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculatePoints = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const data = await fetchJson('/api/system/recalculate-points', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(data.message);
      fetchPoints(token);
    } catch (err) {
      console.error('Recalculate points error:', err);
      toast.error('Failed to recalculate points');
    }
  };

  const handlePanelRestore = async (file: File) => {
    if (!window.confirm(`Are you sure you want to restore data from ${file.name}? This will overwrite current data in your scope.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('backup', file);

      const response = await fetch(`/api/restore/${user?.role}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Restore failed');
      }

      toast.success(result.message || 'Restore successful');
      if (token) {
        await fetchTasks(token);
        await fetchStaff(token);
        await fetchAttendance(token);
      }
    } catch (err) {
      console.error('Panel restore error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to restore data');
    } finally {
      setIsLoading(false);
      if (panelRestoreInputRef.current) panelRestoreInputRef.current.value = '';
    }
  };

  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  const handleRestoreClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingRestoreFile(file);
    setIsRestoreConfirmOpen(true);
  };

  const executeRestore = async () => {
    if (!pendingRestoreFile) return;
    setIsRestoreConfirmOpen(false);
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const backupData = JSON.parse(content);
          
          if (!backupData.users || !Array.isArray(backupData.users)) {
            throw new Error('Invalid backup file: users array is missing or invalid');
          }

          const token = localStorage.getItem('token');
          if (!token) throw new Error('No authentication token found. Please log in again.');
          
          const data = await fetchJson('/api/system/restore', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(backupData)
          });

          toast.success(`${data.message}. Restored ${data.userCount} users and ${data.taskCount} tasks. The application will now reload.`);
          window.location.reload();
        } catch (err) {
          console.error('Restore processing error:', err);
          toast.error('Failed to restore: ' + (err instanceof Error ? err.message : 'Invalid backup file format'));
          setIsLoading(false);
        }
      };
      reader.readAsText(pendingRestoreFile);
    } catch (err) {
      console.error('Restore setup error:', err);
      toast.error('An error occurred during restoration setup');
      setIsLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPendingRestoreFile(null);
    }
  };

  const handleProcessEmployees = async (silent = false) => {
    console.log('handleProcessEmployees called, silent:', silent);
    if (!silent) setIsProcessingEmployees(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const data = await fetchJson('/api/system/process-employees', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!silent) {
        toast.success(`${data.message}\nCreated: ${data.createdCount}\nUpdated: ${data.updatedCount}`);
      } else {
        console.log('Auto-processed employees:', data);
      }
      fetchStaff(token);
    } catch (err) {
      console.error('Process employees error:', err);
      if (!silent) toast.error(err instanceof Error ? err.message : 'Failed to process employee data');
    } finally {
      if (!silent) setIsProcessingEmployees(false);
    }
  };

  const fetchAiInsights = async (tasks: Task[]) => {
    if (tasks.length === 0) return;
    
    // Simple cache key based on task IDs and statuses
    const cacheKey = tasks.map(t => `${t.id}-${t.status}`).sort().join('|');
    if (aiCache.current[cacheKey]) {
      setAiInsights(aiCache.current[cacheKey]);
      return;
    }

    setIsAiLoading(true);
    
    const callAi = async (retryCount = 0): Promise<any> => {
      try {
        if (!process.env.GEMINI_API_KEY) {
          return {
            urgency: 'REGULAR',
            reason: 'Based on current workload, tasks are moving at a standard pace. No critical bottlenecks detected.',
            delayPrediction: { isLikelyDelayed: false, probability: 15 }
          };
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Analyze these daily work tasks and provide insights on overall urgency, reason for that urgency, and a delay prediction. 
        Tasks: ${JSON.stringify(tasks.map(t => ({ title: t.title, status: t.status, urgency: t.urgency, deadline: t.deadline })))}
        
        Return ONLY a JSON object with this structure:
        {
          "urgency": "REGULAR" | "URGENT" | "CRITICAL",
          "reason": "string explaining the insight",
          "delayPrediction": { "isLikelyDelayed": boolean, "probability": number (0-100) }
        }`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                urgency: { 
                  type: Type.STRING,
                  enum: ['REGULAR', 'URGENT', 'CRITICAL']
                },
                reason: { type: Type.STRING },
                delayPrediction: {
                  type: Type.OBJECT,
                  properties: {
                    isLikelyDelayed: { type: Type.BOOLEAN },
                    probability: { type: Type.NUMBER }
                  },
                  required: ['isLikelyDelayed', 'probability']
                }
              },
              required: ['urgency', 'reason', 'delayPrediction']
            }
          }
        });

        if (response.text) {
          return JSON.parse(response.text);
        }
        throw new Error('Empty response from AI');
      } catch (err: any) {
        // Handle 429 Quota Exceeded
        const errStr = JSON.stringify(err);
        if (errStr.includes('429') || err.status === 429 || err.code === 429 || err.message?.includes('429')) {
          if (retryCount < 2) {
            const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            return callAi(retryCount + 1);
          }
          return {
            urgency: 'REGULAR',
            reason: 'AI Insights are currently unavailable due to high demand. Please check back later.',
            delayPrediction: { isLikelyDelayed: false, probability: 0 }
          };
        }
        throw err;
      }
    };

    try {
      const data = await callAi();
      setAiInsights(data);
      aiCache.current[cacheKey] = data;
    } catch (err) {
      console.error('AI Insights error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      const timer = setTimeout(() => {
        fetchAiInsights(tasks);
      }, 3000); // 3 second debounce
      return () => clearTimeout(timer);
    }
  }, [tasks]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && (activeTab === 'staff' || activeTab === 'analytics' || activeTab === 'attendance' || activeTab === 'technician_monitoring')) {
      fetchStaff(token, isAnyModalOpen);
      if (activeTab === 'attendance' || activeTab === 'technician_monitoring') {
        fetchAttendance(token);
      }
    }
  }, [activeTab, isAnyModalOpen]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !isLoggedIn) return;

    // Initial fetch
    fetchTasks(token);
    fetchNotifications(token);
    fetchPoints(token);
    fetchPerformance(token);
    if (['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(user?.role || '')) {
      fetchStaff(token);
      fetchAttendance(token);
    }

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(() => {
      console.log('Auto-refreshing data (Smart Polling)...');
      fetchTasks(token);
      fetchNotifications(token);
      fetchPoints(token);
      fetchPerformance(token);
      if (['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(user?.role || '')) {
        // Background fetch staff but skip full user state update if modal is open
        fetchStaff(token, isAnyModalOpen);
        fetchAttendance(token);
      }
    }, 10000);

    // Refresh on window focus
    const handleFocus = () => {
      console.log('Window focused, refreshing data...');
      fetchTasks(token);
      fetchNotifications(token);
      fetchPoints(token);
      fetchPerformance(token);
      if (['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(user?.role || '')) {
        fetchStaff(token, isAnyModalOpen);
        fetchAttendance(token);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoggedIn, user, isAnyModalOpen, activeTab]);

  // Login Handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
    setTasks([]);
    setStaffList([]);
  };

  const [showPassword, setShowPassword] = useState(false);

  const [pointTransactions, setPointTransactions] = useState<PointTransaction[]>([]);
  const [technicianPerformance, setTechnicianPerformance] = useState<TechnicianPerformance[]>([]);

  const fetchPoints = async (token: string) => {
    try {
      const data = await fetchJson('/api/points', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPointTransactions(data);
    } catch (err) {
      console.error('Fetch points error:', err);
    }
  };

  const fetchPerformance = async (token: string) => {
    try {
      const data = await fetchJson('/api/performance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTechnicianPerformance(data);
    } catch (err) {
      console.error('Fetch performance error:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      console.log('Attempting login with:', loginData.employeeId);
      const data = await fetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setIsLoggedIn(true);
        fetchTasks(data.token);
        fetchPoints(data.token);
        fetchPerformance(data.token);
        if (data.user.role === 'SUPER_ADMIN') {
          // Auto-process employees on login for Super Admin
          handleProcessEmployees(true);
        }
        if (['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(data.user.role)) {
          fetchStaff(data.token);
          fetchAttendance(data.token);
        }
      } else {
        toast.error(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const [notifications, setNotifications] = useState<{id: string, message: string, read: boolean, timestamp: string}[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const fetchTasks = async (token: string, all = false) => {
    try {
      const url = all ? '/api/tasks?all=true' : `/api/tasks?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`;
      const data = await fetchJson(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTasks(data);
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  };

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [statusUpdateTask, setStatusUpdateTask] = useState<Task | null>(null);
  const [statusUpdateData, setStatusUpdateData] = useState({ progress: 0, status: 'RUNNING' as TaskStatus, remarks: '', actualCompletionTime: '' });
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [taskRemarks, setTaskRemarks] = useState('');
  const [assignToTech, setAssignToTech] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRestoreInputRef = useRef<HTMLInputElement>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    model: 'Portable',
    details: '',
    urgency: 'REGULAR',
    assignedTo: '',
    deadline: '',
    points: 1,
    customStartTime: '',
    estimatedDuration: '',
    workType: 'SINGLE' as 'SINGLE' | 'TEAM',
    assignedTechnicians: [] as any[]
  });
  const [techSearch, setTechSearch] = useState('');
  const [selectedTechs, setSelectedTechs] = useState<any[]>([]);

  const exportToWhatsApp = (technician: User) => {
    const today = new Date().toISOString().split('T')[0];
    const techTasks = tasks.filter(t => t.assignedTo === technician.name && t.status !== 'COMPLETED' && t.deadline.startsWith(today));
    
    if (techTasks.length === 0) {
      toast.info('No pending tasks for today to share.');
      return;
    }

    let message = `*Daily Task List - ${new Date().toLocaleDateString()}*\n\n`;
    
    techTasks.forEach((t, i) => {
      message += `*Technician:* ${technician.name}\n`;
      message += `*Task:* ${t.title}\n`;
      message += `*Model:* ${t.model}\n`;
      message += `*Deadline:* ${new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\n`;
    });
    
    const encodedMessage = encodeURIComponent(message);
    // WhatsApp needs country code without leading zero for the link
    let phone = technician.phone || '';
    if (phone.startsWith('0')) {
      phone = '88' + phone;
    } else if (phone && !phone.startsWith('88')) {
      phone = '880' + phone;
    }
    
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  const handleApproveRequest = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Task request approved successfully');
        fetchTasks(token!);
      } else {
        toast.error('Failed to approve request');
      }
    } catch (error) {
      toast.error('Error approving request');
    }
  };

  const handleRejectRequest = async (taskId: string, remarks: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ remarks })
      });
      if (response.ok) {
        toast.success('Task request rejected');
        fetchTasks(token!);
      } else {
        toast.error('Failed to reject request');
      }
    } catch (error) {
      toast.error('Error rejecting request');
    }
  };

  const handleThemeChange = async (themeId: string, removeBg = false) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user/theme`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ theme: themeId, removeBg })
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        toast.success('Theme updated successfully');
      }
    } catch (error) {
      toast.error('Error updating theme');
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('background', file);

    try {
      const response = await fetch(`/api/user/theme`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        toast.success('Background uploaded successfully');
      }
    } catch (error) {
      toast.error('Error uploading background');
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusUpdateTask) return;
    
    if (!statusUpdateData.remarks.trim()) {
      toast.error('Remarks are mandatory for every update');
      return;
    }

    if (statusUpdateData.progress === 100 && !statusUpdateData.actualCompletionTime) {
      toast.error('Please provide the actual completion time');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const data = await fetchJson(`/api/tasks/${statusUpdateTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: statusUpdateData.status,
          progress: statusUpdateData.progress,
          remarks: statusUpdateData.remarks,
          actualCompletionTime: statusUpdateData.actualCompletionTime,
          logs: [
            ...(statusUpdateTask.logs || []),
            {
              id: Date.now().toString(),
              action: `Status updated to ${statusUpdateData.status} (${statusUpdateData.progress}%)`,
              timestamp: new Date().toISOString(),
              user: user?.name || 'System'
            }
          ]
        })
      });
      
      const token2 = localStorage.getItem('token');
      if (token2) await fetchTasks(token2);
      setIsStatusUpdateModalOpen(false);
      setStatusUpdateTask(null);
      setStatusUpdateData({ progress: 0, status: 'RUNNING', remarks: '', actualCompletionTime: '' });
    } catch (err) {
      console.error('Status update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateForInput = (dateStr: string | undefined, type: 'date' | 'datetime-local') => {
    if (!dateStr) return '';
    if (type === 'date') return dateStr.split('T')[0];
    if (type === 'datetime-local') {
      if (dateStr.includes('T')) return dateStr.slice(0, 16);
      return `${dateStr}T00:00`;
    }
    return dateStr;
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'TECHNICIAN') {
      toast.error('Technicians are not authorized to create or edit tasks.');
      return;
    }

    if (!editingTask && user?.role === 'OFFICER' && newTask.workType === 'SINGLE' && !newTask.assignedTo) {
      toast.error('Please assign the task to someone.');
      return;
    }

    if (['HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(user?.role || '') && !editingTask) {
      // Strict Assignment Rule Validation for all hierarchical roles
      const assignedStaff = staffList.find(s => s.name === newTask.assignedTo);
      if (assignedStaff) {
        const currentUserData = staffList.find(u => u.id === user?.id) || user;
        const myEmpId = currentUserData?.employeeId;
        const myAssignedEngs = currentUserData?.assignedEngineers || [];

        if (currentUserData?.role === 'OFFICER') {
          // Officer can only assign to Technicians or assigned Authorities
          if (assignedStaff.role !== 'TECHNICIAN' && !myAssignedEngs.includes(assignedStaff.employeeId)) {
            toast.error("Access Denied: Officers can only assign tasks to Technicians or their assigned Authorities.");
            return;
          }
        } else if (currentUserData?.role === 'ENGINEER') {
          // Engineer can ONLY assign to Officers who have them in assignedEngineers
          if (assignedStaff.role !== 'OFFICER' || !(assignedStaff.assignedEngineers || []).includes(myEmpId || '')) {
            toast.error("Access Denied: Engineers can only assign tasks to Officers who are mapped to them.");
            return;
          }
        } else if (['HOD', 'IN_CHARGE', 'MODEL_MANAGER'].includes(currentUserData?.role || '')) {
          // Hierarchical roles check
          if (assignedStaff.role === 'OFFICER') {
            if (!(assignedStaff.assignedEngineers || []).includes(myEmpId || '')) {
              toast.error("Access Denied: You are not authorized to assign tasks to this Officer. (Mapping required)");
              return;
            }
          } else if (assignedStaff.role === 'ENGINEER') {
            if (!myAssignedEngs.includes(assignedStaff.employeeId)) {
              toast.error("Access Denied: You are not authorized to assign tasks to this Engineer.");
              return;
            }
          }
        }
      }
    }

    if (newTask.workType === 'TEAM' && selectedTechs.length < 2) {
      toast.error('Team work requires at least 2 technicians.');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PUT' : 'POST';
      
      const finalAssignedTo = editingTask ? newTask.assignedTo : (
        user?.role === 'ENGINEER' ? (staffList.find(s => s.role === 'OFFICER' && (s.assignedEngineers || []).some(id => id.toString().trim() === user.employeeId))?.name || '') : newTask.assignedTo
      );

      const finalWorkType = user?.role === 'ENGINEER' ? 'SINGLE' : newTask.workType;

      const hasOtherTeamTech = finalWorkType === 'TEAM' && selectedTechs.some((at: any) => {
        const tech = staffList.find(s => s.employeeId === at.employeeId);
        return tech && tech.supervisorId !== user?.id;
      });

      const isAuthorizedOfficer = user?.role === 'OFFICER' && user?.employeeId === '42949';
      const isEngineer = user?.role === 'ENGINEER';

      const payload = editingTask ? {
        ...newTask,
        workType: finalWorkType,
        assignedBy: user?.employeeId,
        assignedTechnicians: finalWorkType === 'TEAM' ? selectedTechs : undefined,
        status: (user?.role === 'OFFICER' && !isAuthorizedOfficer && (finalWorkType === 'TEAM' || newTask.assignedTo)) ? (hasOtherTeamTech ? 'REQUESTED' : 'RUNNING') : (editingTask.status || 'PENDING'),
        requestStatus: (user?.role === 'OFFICER' && !isAuthorizedOfficer && hasOtherTeamTech) ? 'PENDING' : undefined,
        startedAt: (user?.role === 'OFFICER' && !isAuthorizedOfficer && (finalWorkType === 'TEAM' || newTask.assignedTo) && !hasOtherTeamTech) ? new Date().toISOString() : (editingTask.startedAt || '')
      } : {
        ...newTask,
        workType: finalWorkType,
        assignedTo: finalAssignedTo,
        createdBy: user?.employeeId,
        assignedBy: user?.employeeId,
        assignedTechnicians: finalWorkType === 'TEAM' ? selectedTechs : undefined,
        status: finalWorkType === 'TEAM' ? (hasOtherTeamTech ? 'REQUESTED' : 'RUNNING') : (staffList.find(s => s.name === finalAssignedTo)?.supervisorId !== user?.id && user?.role === 'OFFICER' && !isAuthorizedOfficer ? 'REQUESTED' : 'PENDING'),
        requestStatus: (hasOtherTeamTech || (staffList.find(s => s.name === finalAssignedTo)?.supervisorId !== user?.id && user?.role === 'OFFICER' && !isAuthorizedOfficer)) ? 'PENDING' : undefined
      };

      console.log('Submitting task payload:', payload);

      await fetchJson(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      fetchTasks(token!);
      setIsTaskModalOpen(false);
      setEditingTask(null);
      setNewTask({ title: '', model: 'Portable', details: '', urgency: 'REGULAR', assignedTo: '', deadline: '', points: 1, customStartTime: '', estimatedDuration: '', workType: 'SINGLE', assignedTechnicians: [] });
      setSelectedTechs([]);
    } catch (err) {
      console.error('Task submit error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    console.log('Attempting to delete task:', taskId);
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication token missing. Please log in again.');
        return;
      }
      await fetchJson(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Task deleted successfully');
      setTaskToDelete(null);
      fetchTasks(token);
    } catch (err) {
      console.error('Delete task error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred while deleting the task');
    } finally {
      setIsLoading(false);
    }
  };

  const [activeTaskTab, setActiveTaskTab] = useState<'ALL' | 'PENDING' | 'RUNNING' | 'COMPLETED'>('ALL');

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A';
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isDelayed = (deadline: string, completedAt?: string) => {
    if (!completedAt) return new Date() > new Date(deadline);
    return new Date(completedAt) > new Date(deadline);
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return '';
    const trimmed = phone.trim();
    if (trimmed && !trimmed.startsWith('0') && /^\d+$/.test(trimmed)) {
      return '0' + trimmed;
    }
    return trimmed;
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    // Mandatory remarks check (except for specific system updates)
    if (!updates.remarks && user?.role !== 'SUPER_ADMIN' && !updates.assignedTo && !updates.title && !updates.assignedTechnicians) {
      toast.error('Remarks are mandatory for every update');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const newLog: TaskLog = {
        id: Date.now().toString(),
        action: updates.status ? `Status changed to ${updates.status}` : 
                updates.assignedTo ? `Assigned to ${staffList.find(s => s.id === updates.assignedTo)?.name || updates.assignedTo}` :
                updates.assignedTechnicians ? `Team assignment updated` :
                updates.remarks ? `Remarks updated` : `Task updated`,
        timestamp: new Date().toISOString(),
        user: user?.name || 'Unknown'
      };

      const finalUpdates: any = {
        ...updates,
        assignedBy: updates.assignedTo ? user?.employeeId : currentTask.assignedBy,
        logs: [...(currentTask.logs || []), newLog]
      };

      // Handle Team Progress
      if (currentTask.workType === 'TEAM' && updates.assignedTechnicians) {
        const totalProgress = updates.assignedTechnicians.reduce((sum, t) => sum + (t.progress || 0), 0);
        finalUpdates.totalTeamProgress = Math.round(totalProgress / updates.assignedTechnicians.length);
        finalUpdates.progress = finalUpdates.totalTeamProgress;
        
        if (updates.assignedTechnicians.every(t => t.status === 'COMPLETED')) {
          finalUpdates.status = 'COMPLETED';
          finalUpdates.completedAt = new Date().toISOString();
        }
      }

      // Handle cross-team request for Officers
      if (updates.assignedTo && user?.role === 'OFFICER' && currentTask.workType !== 'TEAM') {
        const assignee = staffList.find(s => s.name === updates.assignedTo);
        if (assignee && assignee.supervisorId !== user.id && assignee.role === 'TECHNICIAN') {
          finalUpdates.status = 'REQUESTED';
          finalUpdates.requestStatus = 'PENDING';
        }
      }

      if (updates.status === 'RUNNING' && !currentTask.startedAt) {
        finalUpdates.startedAt = new Date().toISOString();
      }

      await fetchJson(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(finalUpdates)
      });
      
      await fetchTasks(token!);
      
      // Update selected task if it's the one being viewed
      if (selectedTask?.id === taskId) {
        const updatedTasks = await fetchJson('/api/tasks', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const updatedTask = updatedTasks.find((t: any) => t.id === taskId);
        if (updatedTask) setSelectedTask(updatedTask);
      }
      
      toast.success('Task updated successfully');
    } catch (err) {
      console.error('Update task error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const roles: Role[] = ['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER', 'TECHNICIAN'];

  if (!isLoggedIn) {
    const titleText = "Daily Work Update";
    const subtitleText = "(RAC R&I)";

    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Full Screen Research/Official Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=1920&auto=format&fit=crop" 
            alt="Research & Engineering Background" 
            className="w-full h-full object-cover brightness-[0.25] scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-transparent to-black/80" />
          
          {/* Animated Tech Grid Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          
          {/* Floating Particles */}
          {[...Array(25)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/20 rounded-full"
              initial={{ 
                x: Math.random() * 1920, 
                y: Math.random() * 1080 
              }}
              animate={{ 
                y: [null, Math.random() * -150],
                opacity: [0, 0.6, 0],
                scale: [0, 1.5, 0]
              }}
              transition={{ 
                duration: Math.random() * 7 + 5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          <GlassCard className="p-10 border-white/10 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] backdrop-blur-3xl bg-black/40">
            <div className="text-center mb-10">
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                whileHover={{ scale: 1.1, rotate: 10 }}
                className="w-24 h-24 bg-gradient-to-br from-blue-600/20 to-cyan-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_-5px_rgba(59,130,246,0.5)] border border-white/10 relative group"
              >
                <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <AirVent size={48} className="text-blue-400 relative z-10 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" />
              </motion.div>
              
              <h1 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
                {titleText.split("").map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: 0.5 + (index * 0.05),
                      duration: 0.2,
                      ease: "easeOut"
                    }}
                    className="inline-block hover:text-blue-400 transition-colors duration-300"
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
                <br/>
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (titleText.length * 0.05) + 0.3, duration: 0.5 }}
                  className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-bold text-2xl"
                >
                  {subtitleText}
                </motion.span>
              </h1>
              <p className="text-gray-500 mt-4 text-xs font-bold uppercase tracking-[0.3em] opacity-60">Secure Research Access</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">HRMS ID</label>
                <div className="relative group">
                  <motion.input 
                    animate={{ 
                      scale: loginData.employeeId.length > 0 ? [1, 1.01, 1] : 1,
                      borderColor: loginColors.id,
                      color: loginColors.id
                    }}
                    transition={{ duration: 0.1 }}
                    type="text" 
                    value={loginData.employeeId}
                    onChange={handleIdChange}
                    className="w-full bg-white/[0.03] border rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-700"
                    placeholder="Enter HRMS ID / Email"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Security Key</label>
                <div className="relative group">
                  <motion.input 
                    animate={{ 
                      scale: loginData.password.length > 0 ? [1, 1.01, 1] : 1,
                      borderColor: loginColors.pw,
                      color: loginColors.pw
                    }}
                    transition={{ duration: 0.1 }}
                    type={showPassword ? "text" : "password"} 
                    value={loginData.password}
                    onChange={handlePwChange}
                    className="w-full bg-white/[0.03] border rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-700 pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 mt-8"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>ACCESS DASHBOARD</span>
                    <ChevronRight size={20} />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center justify-center gap-1 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="text-[10px] font-bold text-gray-400 tracking-tight">Software Development by Jahid RAC R&I (38250)</div>
              <div className="text-[9px] text-gray-500 uppercase tracking-widest">Version Release : 1.1.24</div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  const models = ['Portable', '9K', '12K', '18K', '24K', '30K', '36K', 'Chemical & Polymer', 'Store Related Work', 'Cleaning Work', 'General Work'];
  const urgencies = ['REGULAR', 'URGENT', 'MOST_URGENT'];

  const getAnalyticsData = () => {
    // Last 7 days trend
    const trend = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const dayTasks = filteredTasks.filter(t => {
        const taskDate = new Date(t.completedAt || t.createdAt);
        return taskDate.toDateString() === date.toDateString();
      });

      return {
        name: dateStr,
        completed: dayTasks.filter(t => t.status === 'COMPLETED').length,
        pending: dayTasks.filter(t => t.status !== 'COMPLETED').length
      };
    });

    const performance = staffList
      .filter(s => {
        if (user.role === 'IN_CHARGE') return s.role === 'ENGINEER';
        return s.role === 'TECHNICIAN' || s.role === 'OFFICER';
      })
      .map(s => ({
        name: s.name.split(' ')[0],
        tasks: filteredTasks.filter(t => t.assignedTo.toLowerCase() === s.name.toLowerCase() && t.status === 'COMPLETED').length
      }))
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 5);

    const modelDistribution = models.map(m => ({
      name: m,
      value: filteredTasks.filter(t => t.model === m).length
    })).filter(m => m.value > 0);

    return { trend, performance, modelDistribution };
  };

  const { trend, performance, modelDistribution } = getAnalyticsData();
  

  const getTechnicianStatus = (techId: string) => {
    const techName = staffList.find(s => s.employeeId === techId)?.name.toLowerCase();
    const techTasks = tasks.filter(t => {
      if (!techName) return false;
      if (t.assignedTo.toLowerCase() === techName) return true;
      if (t.workType === 'TEAM' && t.assignedTechnicians) {
        return t.assignedTechnicians.some(at => at.employeeId === techId);
      }
      return false;
    });
    const activeTask = techTasks.find(t => t.status === 'RUNNING');
    const assignedTask = techTasks.find(t => t.status === 'PENDING');
    
    if (activeTask) return { status: 'Active', color: 'text-green-400', bg: 'bg-green-400/10', task: activeTask };
    if (assignedTask) return { status: 'Assigned', color: 'text-blue-400', bg: 'bg-blue-400/10', task: assignedTask };
    return { status: 'Idle', color: 'text-gray-400', bg: 'bg-gray-400/10', task: null };
  };

  const getThemeStyles = () => {
    switch (user?.theme) {
      case 'light': return 'bg-[#f8fafc] text-slate-900';
      case 'blue': return 'bg-[#0f172a] text-white';
      case 'purple': return 'bg-[#1e1b4b] text-white';
      case 'green': return 'bg-[#064e3b] text-white';
      case 'red': return 'bg-[#450a0a] text-white';
      case 'gold': return 'bg-[#451a03] text-white';
      default: return 'bg-[#0a0a0c] text-white';
    }
  };

  const renderTechnicianCard = (tech: User) => {
    const statusInfo = getTechnicianStatus(tech.employeeId);
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.find(a => a.technicianId === tech.employeeId && a.date === today);
    const isPresent = todayAttendance?.status === 'PRESENT';

    return (
      <GlassCard key={tech.id} className={cn("relative overflow-hidden group", !isPresent && "opacity-60")}>
        {!isPresent && (
          <div className="absolute top-0 right-0 px-3 py-1 bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
            Absent Today
          </div>
        )}
        
        <div className="flex items-start gap-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-white/5 flex items-center justify-center text-xl font-bold">
            {tech.avatar ? (
              <img src={tech.avatar} alt={tech.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              tech.name[0]
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg">{tech.name}</h3>
            <p className="text-xs text-gray-500">{tech.employeeId}</p>
            <div className="mt-2">
              <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", statusInfo.bg, statusInfo.color)}>
                <Activity size={10} />
                {statusInfo.status}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Current Assignment</h4>
              {statusInfo.task && (
                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                  {statusInfo.task.progress || 0}%
                </span>
              )}
            </div>
            {statusInfo.task ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-white line-clamp-1">{statusInfo.task.title}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><Clock size={10} /> {statusInfo.task.model}</span>
                    <span className="flex items-center gap-1"><TrendingUp size={10} /> {statusInfo.task.urgency}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-gray-500 uppercase tracking-tighter">
                    <span>Progress</span>
                    <span>{statusInfo.task.progress || 0}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${statusInfo.task.progress || 0}%` }}
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic">No active tasks assigned</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            {tech.phone ? (
              <a 
                href={`tel:${formatPhone(tech.phone)}`}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all"
              >
                <Phone size={14} className="text-blue-400" />
                Contact
              </a>
            ) : (
              <div className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold opacity-50 cursor-not-allowed">
                <Phone size={14} className="text-gray-500" />
                No Number
              </div>
            )}
            {user?.role === 'OFFICER' && user?.employeeId === '42949' && (
              <button 
                onClick={() => {
                  setNewTask({ ...newTask, assignedTo: tech.name, workType: 'SINGLE', assignedTechnicians: [] });
                  setSelectedTechs([]);
                  setIsTaskModalOpen(true);
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus size={14} />
                Assign Task
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    );
  };

  return (
    <ThemeContext.Provider value={user?.theme || 'dark'}>
    <div 
      className={cn(
        "min-h-screen font-sans flex overflow-hidden transition-all duration-500",
        getThemeStyles(),
        user?.theme === 'light' ? "selection:bg-blue-100" : "selection:bg-blue-500/30"
      )}
      style={user?.customBackground ? {
        backgroundImage: `url(${user.customBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {user?.customBackground && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-0 pointer-events-none" />
      )}
      <div className="relative z-10 flex w-full overflow-hidden">
          {/* Quality Rating Modal */}
          <AnimatePresence>
            {showQualityModal && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full max-w-sm"
                >
                  <GlassCard className="p-8 text-center">
                    <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Rate Work Quality</h3>
                    <p className="text-gray-400 text-sm mb-8">Please rate the quality of this task (1-5) to complete it.</p>
                    
                    <div className="flex justify-center gap-4 mb-8">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setTaskQuality(star)}
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all",
                            taskQuality >= star ? "bg-amber-500 text-white" : "bg-white/5 text-gray-500"
                          )}
                        >
                          {star}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowQualityModal(null)}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={async () => {
                          await handleUpdateTask(showQualityModal, { 
                            status: 'COMPLETED', 
                            progress: 100, 
                            completedAt: new Date().toISOString(),
                            quality: taskQuality
                          });
                          setShowQualityModal(null);
                          setTaskQuality(5);
                        }}
                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition-all"
                      >
                        Complete
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Distribute Task Modal */}
          <AnimatePresence>
            {showDistributeModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-md bg-[#1a1a1f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-white/10 flex items-center justify-between bg-blue-600/10">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Wrench className="text-blue-400" /> Distribute Task
                    </h2>
                    <button onClick={() => setShowDistributeModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-400">Select a technician to assign this task. The task will automatically start (RUNNING status) once assigned.</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Select Technician</label>
                      <select 
                        value={selectedTechnician}
                        onChange={(e) => setSelectedTechnician(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="" className="bg-[#0f0f12]">Select Staff</option>
                        {staffList.filter(s => s.role === 'TECHNICIAN').map(s => (
                          <option key={s.id} value={s.employeeId} className="bg-[#0f0f12]">
                            {s.name} ({s.employeeId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!selectedTechnician) return;
                        const tech = staffList.find(s => s.employeeId === selectedTechnician);
                        if (!tech) return;
                        await handleUpdateTask(showDistributeModal, { 
                          assignedTo: tech.name,
                          status: 'RUNNING',
                          startedAt: new Date().toISOString()
                        });
                        setShowDistributeModal(null);
                        setSelectedTechnician('');
                      }}
                      disabled={!selectedTechnician || isLoading}
                      className="w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

      {/* Task Deletion Confirmation Modal */}
      <AnimatePresence>
        {taskToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm"
            >
              <GlassCard className="p-8 text-center border-red-500/30">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Delete Task?</h3>
                <p className="text-gray-400 text-sm mb-8">Are you sure you want to delete this task? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setTaskToDelete(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDeleteTask(taskToDelete)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all"
                  >
                    Delete
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {staffToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm"
            >
              <GlassCard className="p-8 text-center border-red-500/30">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Confirm Deletion</h3>
                <p className="text-gray-400 text-sm mb-8">Are you sure you want to remove this staff member? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStaffToDelete(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDeleteStaff(staffToDelete)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all"
                  >
                    Delete
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile View Modal */}
      <AnimatePresence>
        {viewingStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-8">
                <div className="flex justify-end mb-4">
                  <button onClick={() => setViewingStaff(null)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <X size={24} />
                  </button>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-600/30 mb-6 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold">
                    {viewingStaff.avatar ? (
                      <img src={viewingStaff.avatar} alt={viewingStaff.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      viewingStaff.name[0]
                    )}
                  </div>
                  <h2 className="text-3xl font-bold">{viewingStaff.name}</h2>
                  <p className="text-blue-400 font-mono mt-1">{viewingStaff.employeeId}</p>
                  <div className="mt-2 px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-full uppercase tracking-widest">
                    {viewingStaff.role.replace('_', ' ')}
                  </div>
                  {viewingStaff.designation && (
                    <p className="text-gray-400 mt-2 italic">{viewingStaff.designation}</p>
                  )}
                  
                  <div className="w-full space-y-3 mt-8">
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                        <Phone size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Mobile Number</p>
                        <p className="text-sm font-medium">{formatPhone(viewingStaff.phone) || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
                        <FileText size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                        <p className="text-sm font-medium">{viewingStaff.email || 'N/A'}</p>
                      </div>
                    </div>

                    {viewingStaff.role === 'OFFICER' && viewingStaff.assignedEngineers && viewingStaff.assignedEngineers.length > 0 && (
                      <div className="flex flex-col gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-600/20 rounded-lg text-green-400">
                            <Users size={18} />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Assigned Engineers</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {viewingStaff.assignedEngineers.map(engId => {
                                const eng = staffList.find(s => s.employeeId === engId);
                                return (
                                  <span key={engId} className="px-2 py-0.5 bg-green-600/20 text-green-400 text-[10px] font-bold rounded-full border border-green-600/30">
                                    {eng ? eng.name : engId}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Department</p>
                      <p className="font-bold">{viewingStaff.department || 'RAC R&I'}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                      <p className="font-bold text-green-400">Active</p>
                    </div>
                  </div>

                  {viewingStaff.role === 'OFFICER' && (
                    <div className="w-full mt-6 space-y-4">
                      <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl text-center">
                        <p className="text-xs text-blue-400 uppercase tracking-widest mb-2 font-bold">Total Performance Points</p>
                        <p className="text-5xl font-black text-white tracking-tighter">
                          {pointTransactions
                            .filter(pt => pt.officerId === viewingStaff.id)
                            .reduce((sum, pt) => sum + pt.pointValue, 0)}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="bg-white/5 p-2 rounded-xl">
                            <p className="text-[10px] text-gray-500 uppercase">This Month</p>
                            <p className="text-lg font-bold">
                              {pointTransactions
                                .filter(pt => pt.officerId === viewingStaff.id && new Date(pt.completedAt).getMonth() === new Date().getMonth())
                                .reduce((sum, pt) => sum + pt.pointValue, 0)}
                            </p>
                          </div>
                          <div className="bg-white/5 p-2 rounded-xl">
                            <p className="text-[10px] text-gray-500 uppercase">Tasks Done</p>
                            <p className="text-lg font-bold">
                              {pointTransactions.filter(pt => pt.officerId === viewingStaff.id).length}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold px-2">Recent Point History</p>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {pointTransactions
                            .filter(pt => pt.officerId === viewingStaff.id)
                            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                            .slice(0, 10)
                            .map(pt => {
                              const task = tasks.find(t => t.id === pt.taskId);
                              return (
                                <div key={pt.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                  <div className="text-left">
                                    <p className="text-xs font-bold truncate max-w-[150px]">{task?.title || 'Unknown Task'}</p>
                                    <p className="text-[10px] text-gray-500">{new Date(pt.completedAt).toLocaleDateString()}</p>
                                  </div>
                                  <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg">
                                    +{pt.pointValue}
                                  </div>
                                </div>
                              );
                            })}
                          {pointTransactions.filter(pt => pt.officerId === viewingStaff.id).length === 0 && (
                            <p className="text-xs text-gray-500 italic text-center py-4">No point history available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setViewingStaff(null)}
                    className="w-full mt-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/30"
                  >
                    Close Profile
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Staff Modal */}
      <AnimatePresence>
        {isStaffModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">{editingStaff ? 'Edit Staff' : 'Add New Staff'}</h2>
                  <button onClick={() => { setIsStaffModalOpen(false); setEditingStaff(null); }} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleStaffSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Employee ID</label>
                    <input 
                      type="text" 
                      value={newStaff.employeeId}
                      onChange={(e) => setNewStaff({...newStaff, employeeId: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. TECH005"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Full Name</label>
                    <input 
                      type="text" 
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-xl font-bold">
                        {newStaff.avatar ? (
                          <img src={newStaff.avatar} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserCircle size={32} className="text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold transition-all inline-block">
                          Choose File
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-gray-500 mt-1">JPG, PNG or GIF. Max 1MB.</p>
                      </div>
                      {newStaff.avatar && (
                        <button 
                          type="button"
                          onClick={() => setNewStaff({...newStaff, avatar: ''})}
                          className="text-red-500 text-xs hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Designation (Optional)</label>
                    <input 
                      type="text" 
                      value={newStaff.designation}
                      onChange={(e) => setNewStaff({...newStaff, designation: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. Senior Technician"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Email (Optional)</label>
                    <input 
                      type="email" 
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Contact Number (Optional)</label>
                    <input 
                      type="tel" 
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. +88017..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Department</label>
                    <input 
                      type="text" 
                      value={newStaff.department}
                      onChange={(e) => setNewStaff({...newStaff, department: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. RAC R&I"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Role</label>
                    <select 
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({...newStaff, role: e.target.value as Role, supervisorId: ''})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {roles.map(r => <option key={r} value={r} className="bg-[#0f0f12]">{r.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  
                  {['ENGINEER', 'OFFICER', 'TECHNICIAN'].includes(newStaff.role) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Supervisor (Display Only for {newStaff.role === 'ENGINEER' ? 'In-Charge' : newStaff.role === 'OFFICER' ? 'HOD/In-Charge/Model Manager/Engineer' : 'Officer'})
                      </label>
                      <select 
                        value={newStaff.supervisorId}
                        onChange={(e) => setNewStaff({...newStaff, supervisorId: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        required={newStaff.role === 'TECHNICIAN'}
                      >
                        <option value="" className="bg-[#0f0f12]">Select Supervisor</option>
                        {staffList.filter(s => {
                          if (newStaff.role === 'ENGINEER') return s.role === 'IN_CHARGE' || s.role === 'HOD' || s.role === 'MODEL_MANAGER' || s.role === 'SUPER_ADMIN';
                          if (newStaff.role === 'OFFICER') return ['ENGINEER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'SUPER_ADMIN'].includes(s.role);
                          if (newStaff.role === 'TECHNICIAN') return s.role === 'OFFICER' || s.role === 'ENGINEER' || s.role === 'IN_CHARGE' || s.role === 'HOD' || s.role === 'MODEL_MANAGER';
                          return false;
                        }).map(s => (
                          <option key={s.id} value={s.id} className="bg-[#0f0f12]">{s.name} ({s.employeeId})</option>
                        ))}
                      </select>
                      {['ENGINEER', 'OFFICER'].includes(newStaff.role) && (
                        <p className="text-[10px] text-amber-500 mt-1 italic">Note: This field is for display only. Task assignment is controlled by "Assign Engineers" mapping.</p>
                      )}
                    </div>
                  )}

                  {['OFFICER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER'].includes(newStaff.role) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        {newStaff.role === 'OFFICER' ? 'Assign Engineers (Multi-select)' : 'Assign Authorities (Multi-select)'}
                      </label>
                      <div className="max-h-40 overflow-y-auto bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                        {staffList.filter(s => {
                          if (newStaff.role === 'OFFICER') return ['ENGINEER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'SUPER_ADMIN'].includes(s.role);
                          if (newStaff.role === 'IN_CHARGE' || newStaff.role === 'MODEL_MANAGER') return s.role === 'ENGINEER' || s.role === 'HOD' || s.role === 'IN_CHARGE' || s.role === 'MODEL_MANAGER';
                          // For HOD/Super Admin, they can assign any authority
                          return ['ENGINEER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'SUPER_ADMIN'].includes(s.role);
                        }).map(eng => (
                          <label key={eng.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all">
                            <input 
                              type="checkbox"
                              checked={newStaff.assignedEngineers?.includes(eng.employeeId)}
                              onChange={(e) => {
                                const current = newStaff.assignedEngineers || [];
                                if (e.target.checked) {
                                  setNewStaff({ ...newStaff, assignedEngineers: [...current, eng.employeeId] });
                                } else {
                                  setNewStaff({ ...newStaff, assignedEngineers: current.filter(id => id !== eng.employeeId) });
                                }
                              }}
                              className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-600 focus:ring-blue-500/50"
                            />
                            <span className="text-sm text-white">{eng.name} ({eng.employeeId}) - {eng.role.replace('_', ' ')}</span>
                          </label>
                        ))}
                        {staffList.filter(s => {
                          if (newStaff.role === 'OFFICER') return ['ENGINEER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'SUPER_ADMIN'].includes(s.role);
                          if (newStaff.role === 'IN_CHARGE' || newStaff.role === 'MODEL_MANAGER') return s.role === 'ENGINEER' || s.role === 'HOD' || s.role === 'IN_CHARGE' || s.role === 'MODEL_MANAGER';
                          return ['ENGINEER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'SUPER_ADMIN'].includes(s.role);
                        }).length === 0 && (
                          <p className="text-xs text-gray-500 italic">No Authorities available</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      {editingStaff ? 'New Password (leave blank to keep current)' : 'Login Password'}
                    </label>
                    <input 
                      type="password" 
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder={editingStaff ? "••••••••" : "Set password"}
                      required={!editingStaff}
                    />
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/30"
                    >
                      {isLoading ? "Saving..." : editingStaff ? "Update Staff" : "Add Staff"}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl"
            >
              <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
                  <button onClick={() => setIsTaskModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleTaskSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {user?.role === 'OFFICER' && !editingTask && (
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-4 mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                        <label className="text-sm font-medium text-gray-400">Work Type:</label>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => setNewTask({...newTask, workType: 'SINGLE'})}
                            className={cn(
                              "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                              newTask.workType === 'SINGLE' ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                            )}
                          >
                            Single Work
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewTask({...newTask, workType: 'TEAM'})}
                            className={cn(
                              "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                              newTask.workType === 'TEAM' ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                            )}
                          >
                            Team Work
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Task Title</label>
                    <input 
                      type="text" 
                      value={newTask.title}
                      onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. Server Room AC Maintenance"
                      required
                      disabled={user?.role === 'OFFICER' && user?.employeeId !== '42949' && !editingTask}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Model</label>
                    <select 
                      value={newTask.model}
                      onChange={(e) => setNewTask({...newTask, model: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      disabled={user?.role === 'OFFICER' && user?.employeeId !== '42949' && !editingTask}
                    >
                      {models.filter(m => {
                        if (user?.role === 'MODEL_MANAGER') {
                          const myEmpId = user.employeeId;
                          if (myEmpId === '38056') return ['12K', '9K', 'Portable'].includes(m);
                          if (myEmpId === '37091') return ['18K'].includes(m);
                          if (myEmpId === '41053') return ['24K', '30K', '36K'].includes(m);
                          return false;
                        }
                        if (m === 'General Work') return user?.role === 'HOD' || user?.role === 'SUPER_ADMIN';
                        return true;
                      }).map(m => <option key={m} value={m} className="bg-[#0f0f12]">{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Urgency</label>
                    <select 
                      value={newTask.urgency}
                      onChange={(e) => {
                        const newUrgency = e.target.value as any;
                        let newPoints = newTask.points;
                        if (newUrgency === 'REGULAR') newPoints = 1;
                        else if (newUrgency === 'URGENT') newPoints = 2;
                        else if (newUrgency === 'MOST_URGENT') newPoints = 3;
                        setNewTask({...newTask, urgency: newUrgency, points: newPoints});
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      disabled={user?.role === 'OFFICER' && user?.employeeId !== '42949' && !editingTask}
                    >
                      {urgencies.filter(u => {
                        if (u === 'MOST_URGENT') {
                          return user?.role === 'ENGINEER' || user?.role === 'SUPER_ADMIN' || user?.role === 'HOD';
                        }
                        return true;
                      }).map(u => <option key={u} value={u} className="bg-[#0f0f12]">{u}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Task Details</label>
                    <textarea 
                      value={newTask.details}
                      onChange={(e) => setNewTask({...newTask, details: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-32"
                      placeholder="Describe the task requirements..."
                      required
                      disabled={user?.role === 'OFFICER' && user?.employeeId !== '42949' && !editingTask}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Deadline (Date Only)</label>
                    <input 
                      type="date" 
                      value={newTask.deadline}
                      onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                      disabled={user?.role === 'OFFICER' && user?.employeeId !== '42949' && !editingTask}
                    />
                  </div>

                  {user?.role !== 'OFFICER' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Task Point</label>
                      <input 
                        type="number" 
                        value={newTask.points}
                        onChange={(e) => setNewTask({...newTask, points: parseInt(e.target.value) || 1})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        min="1"
                        max="3"
                        required
                        disabled={!editingTask}
                      />
                    </div>
                  )}

                  {user?.role === 'OFFICER' && (
                    <div className="md:col-span-2">
                      {newTask.workType === 'SINGLE' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">Assign To</label>
                          <select 
                            value={newTask.assignedTo}
                            onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            required
                          >
                            <option value="" className="bg-[#0f0f12]">Select Staff</option>
                            {(() => {
                              const currentUserData = staffList.find(u => u.id === user?.id) || user;
                              const myAssignedEngs = currentUserData?.assignedEngineers || [];
                              const myEmpId = currentUserData?.employeeId?.toString().trim();

                              const filteredStaff = staffList.filter(s => {
                                if (currentUserData?.role === 'SUPER_ADMIN') return true;
                                if (['HOD', 'IN_CHARGE', 'MODEL_MANAGER'].includes(currentUserData?.role || '')) {
                                  const isMyOfficer = s.role === 'OFFICER' && (s.assignedEngineers || []).some(id => id.toString().trim() === myEmpId);
                                  const isMyEngineer = s.role === 'ENGINEER' && myAssignedEngs.includes(s.employeeId);
                                  return isMyOfficer || isMyEngineer;
                                }
                                if (currentUserData?.role === 'ENGINEER') {
                                  return s.role === 'OFFICER' && (s.assignedEngineers || []).some(id => id.toString().trim() === myEmpId);
                                }
                                if (currentUserData?.role === 'OFFICER') {
                                  const isTechnician = s.role === 'TECHNICIAN';
                                  const isAssignedAuthority = ['ENGINEER', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER'].includes(s.role) && myAssignedEngs.includes(s.employeeId);
                                  return isTechnician || isAssignedAuthority;
                                }
                                return false;
                              });

                              return filteredStaff.map(s => (
                                <option key={s.id} value={s.name} className="bg-[#0f0f12]">{s.name} ({s.employeeId})</option>
                              ));
                            })()}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <label className="block text-sm font-medium text-gray-400 mb-2">Assign Team (Multiple Technicians)</label>
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                              type="text"
                              value={techSearch}
                              onChange={(e) => setTechSearch(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              placeholder="Search by ID or Name..."
                            />
                          </div>
                          
                          {techSearch && (
                            <div className="max-h-40 overflow-y-auto bg-[#0f0f12] border border-white/10 rounded-xl p-2 space-y-1 custom-scrollbar">
                              {staffList
                                .filter(s => s.role === 'TECHNICIAN')
                                .filter(s => 
                                  s.name.toLowerCase().includes(techSearch.toLowerCase()) || 
                                  s.employeeId.toString().includes(techSearch)
                                )
                                .filter(s => !selectedTechs.some(st => st.employeeId === s.employeeId))
                                .map(s => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedTechs([...selectedTechs, { employeeId: s.employeeId, name: s.name }]);
                                      setTechSearch('');
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-lg text-sm transition-colors"
                                  >
                                    {s.name} ({s.employeeId})
                                  </button>
                                ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {selectedTechs.map(t => (
                              <div key={t.employeeId} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                                <span className="text-xs text-blue-400 font-medium">{t.name} ({t.employeeId})</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTechs(selectedTechs.filter(st => st.employeeId !== t.employeeId))}
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="md:col-span-2 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-blue-400">Custom Time Control (Back-Time)</label>
                      <Info size={16} className="text-blue-400/50" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase mb-1">Custom Start Time</label>
                        <input 
                          type="datetime-local"
                          value={newTask.customStartTime}
                          onChange={(e) => setNewTask({...newTask, customStartTime: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase mb-1">Estimated Duration (e.g. 2h 30m)</label>
                        <input 
                          type="text"
                          value={newTask.estimatedDuration}
                          onChange={(e) => setNewTask({...newTask, estimatedDuration: e.target.value})}
                          placeholder="e.g. 1h 45m"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-4">
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/30"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                      ) : (
                        <>
                          {editingTask ? 'Update Task' : (
                            user?.role === 'OFFICER' && staffList.find(s => s.name === newTask.assignedTo)?.supervisorId !== user?.id && staffList.find(s => s.name === newTask.assignedTo)?.role === 'TECHNICIAN'
                              ? 'Request to His Supervisor'
                              : 'Create Task'
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {isStatusUpdateModalOpen && statusUpdateTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Update Task Status</h2>
                  <button onClick={() => setIsStatusUpdateModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Progress: {statusUpdateData.progress}%</p>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      value={statusUpdateData.progress}
                      onChange={(e) => {
                        const p = parseInt(e.target.value);
                        setStatusUpdateData({ 
                          ...statusUpdateData, 
                          progress: p, 
                          status: p === 100 ? 'COMPLETED' : 'RUNNING' 
                        });
                      }}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-bold">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {statusUpdateData.progress === 100 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <label className="text-xs text-gray-400 uppercase tracking-widest">Actual Completion Time (Manual)</label>
                      <input 
                        type="datetime-local"
                        value={statusUpdateData.actualCompletionTime}
                        onChange={(e) => setStatusUpdateData({ ...statusUpdateData, actualCompletionTime: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase tracking-widest">Remarks (Mandatory)</label>
                    <textarea
                      value={statusUpdateData.remarks}
                      onChange={(e) => setStatusUpdateData({ ...statusUpdateData, remarks: e.target.value })}
                      placeholder="Enter update remarks..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 min-h-[80px]"
                      required
                    />
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <button
                      onClick={() => setStatusUpdateData({ ...statusUpdateData, status: 'HOLD', progress: 0 })}
                      className={cn(
                        "w-full py-4 rounded-xl font-bold transition-all border flex items-center justify-center gap-2",
                        statusUpdateData.status === 'HOLD'
                          ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20"
                          : "bg-white/5 border-white/10 text-red-400 hover:bg-red-500/10"
                      )}
                    >
                      <Pause size={20} />
                      Temporary Hold
                    </button>
                  </div>

                  {statusUpdateData.status === 'HOLD' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="text-xs text-gray-400 uppercase tracking-widest">Hold Remarks (Required)</label>
                      <textarea
                        value={statusUpdateData.remarks}
                        onChange={(e) => setStatusUpdateData({ ...statusUpdateData, remarks: e.target.value })}
                        placeholder="Explain why this task is on hold (max 100 words)..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
                        maxLength={500}
                      />
                    </motion.div>
                  )}

                  <button
                    onClick={handleStatusUpdate}
                    disabled={isLoading || (statusUpdateData.status === 'HOLD' && !statusUpdateData.remarks.trim())}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 mt-4"
                  >
                    {isLoading ? "Updating..." : "Confirm Update"}
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isChangePasswordModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">Change Password</h2>
                  <button onClick={() => setIsChangePasswordModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Current Password</label>
                    <input 
                      type="password" 
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
                    <input 
                      type="password" 
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/30"
                    >
                      {isLoading ? "Updating..." : "Change Password"}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal (Super Admin) */}
      <AnimatePresence>
        {isResetPasswordModalOpen && resetPasswordUser && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">Reset Password</h2>
                  <button onClick={() => setIsResetPasswordModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-blue-600/10 rounded-xl border border-blue-600/20">
                  <p className="text-sm text-blue-400">Resetting password for:</p>
                  <p className="text-lg font-bold">{resetPasswordUser.name} ({resetPasswordUser.employeeId})</p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">New Password</label>
                    <input 
                      type="password" 
                      value={resetPasswordData.newPassword}
                      onChange={(e) => setResetPasswordData({...resetPasswordData, newPassword: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={resetPasswordData.confirmPassword}
                      onChange={(e) => setResetPasswordData({...resetPasswordData, confirmPassword: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-amber-500/30"
                    >
                      {isLoading ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="h-screen bg-[#0f0f12] border-r border-white/5 flex flex-col relative z-30"
      >
        <div className="p-6 flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <AirVent size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">Daily Work Update</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {/* 1. Attendance */}
          {['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'OFFICER', 'ENGINEER', 'TECHNICIAN'].includes(user?.role || '') && (
            <SidebarItem 
              icon={CheckCircle2} 
              label="Attendance" 
              active={activeTab === 'attendance'} 
              onClick={() => setActiveTab('attendance')} 
              color="text-green-500"
            />
          )}

          {/* 2. Dashboard */}
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            color="text-blue-500"
          />

          {/* 3. Task Management */}
          <SidebarItem 
            icon={ClipboardList} 
            label="Task Management" 
            active={activeTab === 'tasks' || activeTab === 'officer_tasks' || activeTab === 'mywork'} 
            onClick={() => {
              if (user?.role === 'TECHNICIAN') setActiveTab('mywork');
              else setActiveTab('tasks');
            }} 
            color="text-purple-500"
          />

          {/* 4. Daily Task */}
          <SidebarItem 
            icon={Calendar} 
            label="Daily Task" 
            active={activeTab === 'daily_task'} 
            onClick={() => setActiveTab('daily_task')} 
            color="text-orange-500"
          />

          {/* 5. Team Performance */}
          <SidebarItem 
            icon={TrendingUp} 
            label="Team Performance" 
            active={activeTab === 'performance'} 
            onClick={() => setActiveTab('performance')} 
            color="text-blue-400"
          />

          {/* 6. Report Management */}
          <SidebarItem 
            icon={FileText} 
            label="Report Management" 
            active={activeTab === 'reports' || activeTab === 'officer_reports'} 
            onClick={() => setActiveTab('reports')} 
            color="text-indigo-500"
          />

          {/* 7. Analytics */}
          <SidebarItem 
            icon={BarChart3} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
            color="text-cyan-500"
          />

          {/* 8. Technician Monitoring */}
          {['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'OFFICER', 'ENGINEER'].includes(user?.role || '') && (
            <SidebarItem 
              icon={Activity} 
              label="Technician Monitoring" 
              active={activeTab === 'technician_monitoring'} 
              onClick={() => setActiveTab('technician_monitoring')} 
              color="text-red-500"
            />
          )}

          {/* 9. Section/Model/Dept Overview */}
          {['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER'].includes(user?.role || '') && (
            <SidebarItem 
              icon={Layers} 
              label={
                user?.role === 'HOD' || user?.role === 'SUPER_ADMIN' ? "Department Overview" :
                user?.role === 'IN_CHARGE' ? "Section Overview" : "Model Wise Work"
              } 
              active={activeTab === 'section' || activeTab === 'models'} 
              onClick={() => {
                if (user?.role === 'MODEL_MANAGER') setActiveTab('models');
                else setActiveTab('section');
              }} 
              color="text-emerald-500"
            />
          )}

          {/* 10. Staff Management */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'HOD') && (
            <SidebarItem 
              icon={Users} 
              label="Staff Management" 
              active={activeTab === 'staff'} 
              onClick={() => setActiveTab('staff')} 
              color="text-blue-600"
            />
          )}

          {/* 11. My Profile */}
          <SidebarItem 
            icon={UserCircle} 
            label="My Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
            color="text-gray-400"
          />

          {/* 12. Themes */}
          <SidebarItem 
            icon={Palette} 
            label="Themes" 
            active={activeTab === 'theme'} 
            onClick={() => setActiveTab('theme')} 
            color="text-pink-500"
          />

          {/* 13. Change Password */}
          <SidebarItem 
            icon={Lock} 
            label="Change Password" 
            active={isChangePasswordModalOpen} 
            onClick={() => setIsChangePasswordModalOpen(true)} 
            color="text-amber-500"
          />

          {/* 14. Backup & Restore */}
          {['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'OFFICER', 'ENGINEER'].includes(user?.role || '') && (
            <SidebarItem 
              icon={Database} 
              label="Backup & Restore" 
              active={activeTab === 'backup_restore'} 
              onClick={() => setActiveTab('backup_restore')} 
              color="text-slate-500"
            />
          )}

          {/* Other Team Requests (Supervisor Approval) */}
          {['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'].includes(user?.role || '') && (
            <SidebarItem 
              icon={Bell} 
              label="Team Requests" 
              active={activeTab === 'other_team_requests'} 
              onClick={() => setActiveTab('other_team_requests')} 
              color="text-yellow-500"
              count={tasks.filter(t => t.status === 'REQUESTED' && staffList.find(s => s.name === t.assignedTo || s.employeeId === t.assignedTo)?.supervisorId === user?.id).length}
            />
          )}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold">
              {user?.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{user?.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto relative">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-xl border-bottom border-white/5 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-xl font-bold capitalize">
              {activeTab === 'dashboard' ? 'Dashboard' :
               activeTab === 'tasks' || activeTab === 'officer_tasks' || activeTab === 'mywork' ? 'Task Management' :
               activeTab === 'attendance' ? 'Attendance' :
               activeTab === 'daily_task' ? 'Daily Task' :
               activeTab === 'performance' ? 'Team Performance' :
               activeTab === 'reports' ? 'Report Management' :
               activeTab === 'analytics' ? 'Analytics' :
               activeTab === 'technician_monitoring' ? 'Technician Monitoring' :
               activeTab === 'section' || activeTab === 'models' ? (
                 user?.role === 'HOD' || user?.role === 'SUPER_ADMIN' ? "Department Overview" :
                 user?.role === 'IN_CHARGE' ? "Section Overview" : "Model Wise Work"
               ) :
               activeTab === 'staff' ? 'Staff Management' :
               activeTab === 'profile' ? 'My Profile' :
               activeTab === 'theme' ? 'Themes' :
               activeTab === 'backup_restore' ? 'Backup & Restore' :
               activeTab === 'other_team_requests' ? 'Team Requests' :
               activeTab.replace('_', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Search tasks, staff..." 
                className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-64"
              />
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 hover:bg-white/5 rounded-full text-gray-400"
              >
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0a0a0c]" />
                )}
              </button>
              
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#1a1a1e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    <button 
                      onClick={clearNotifications}
                      className="text-[10px] text-gray-500 hover:text-white uppercase tracking-widest"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-xs italic">
                        No notifications
                      </div>
                    ) : (
                      notifications.slice().reverse().map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => markNotificationRead(n.id)}
                          className={cn(
                            "p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors",
                            !n.read && "bg-blue-500/5"
                          )}
                        >
                          <p className={cn("text-xs mb-1", !n.read ? "text-white font-medium" : "text-gray-400")}>
                            {n.message}
                          </p>
                          <p className="text-[10px] text-gray-600">
                            {new Date(n.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer">
              <UserCircle size={24} className="text-gray-400" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {activeTab === 'dashboard' && (
            <>
              {/* Welcome Section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">Welcome back, {user?.name.split(' ')[0]}! 👋</h1>
                  <p className="text-gray-400 mt-1">Here's what's happening in your department today.</p>
                </div>
                {(!['TECHNICIAN', 'OFFICER'].includes(user?.role || '') || (user?.role === 'OFFICER' && user?.employeeId === '42949')) && (
                  <button 
                    onClick={() => {
                      setEditingTask(null);
                      setNewTask({ 
                        title: '', 
                        model: 'Portable', 
                        details: '', 
                        urgency: 'REGULAR', 
                        assignedTo: '', 
                        deadline: '', 
                        points: 1, 
                        customStartTime: '', 
                        estimatedDuration: '',
                        workType: 'SINGLE',
                        assignedTechnicians: []
                      });
                      setSelectedTechs([]);
                      setIsTaskModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all"
                  >
                    <Plus size={20} />
                    New Task
                  </button>
                )}
              </div>

              {/* Stats Grid */}
              <div className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-6",
                user?.role === 'OFFICER' ? "lg:grid-cols-5" : "lg:grid-cols-4"
              )}>
                <StatCard label="Total Tasks" value={dashboardTasks.length} icon={ClipboardList} color="bg-blue-500" trend="+12% from last week" />
                <StatCard label="Running" value={dashboardTasks.filter(t => t.status === 'RUNNING').length} icon={Clock} color="bg-amber-500" />
                <StatCard label="Completed" value={dashboardTasks.filter(t => t.status === 'COMPLETED').length} icon={CheckCircle2} color="bg-green-500" trend="+5% from yesterday" />
                <StatCard label="Delayed" value={dashboardTasks.filter(t => t.status === 'DELAYED').length} icon={AlertCircle} color="bg-red-500" />
                {user?.role === 'OFFICER' && (
                  <StatCard 
                    label="Total Points" 
                    value={pointTransactions.filter(pt => pt.officerId === user.id).reduce((acc, pt) => acc + (pt.pointValue || 0), 0)} 
                    icon={BarChart3} 
                    color="bg-purple-500" 
                    trend={`+${pointTransactions.filter(pt => pt.officerId === user.id && new Date(pt.completedAt).getMonth() === new Date().getMonth()).reduce((acc, pt) => acc + (pt.pointValue || 0), 0)} this month`}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Tasks */}
                <GlassCard className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Recent Tasks</h3>
                    <button 
                      onClick={() => setActiveTab('tasks')}
                      className="text-blue-400 text-sm font-medium hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-4">
                    {dashboardTasks.length > 0 ? dashboardTasks.slice(0, 5).map((task, i) => (
                      <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                            task.urgency === 'MOST_URGENT' ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                          )}>
                            <ClipboardList size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">{task.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">{task.taskId} • {task.model}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 justify-between sm:justify-end">
                          <div className="text-right shrink-0">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                              task.status === 'RUNNING' ? "bg-amber-500/20 text-amber-500" : 
                              task.status === 'COMPLETED' ? "bg-green-500/20 text-green-500" :
                              task.status === 'HOLD' ? "bg-red-500/20 text-red-500" :
                              "bg-blue-500/20 text-blue-500"
                            )}>
                              {task.status}
                            </span>
                            {task.status === 'HOLD' ? (
                              <p className="text-[10px] text-gray-500 mt-2">Paused</p>
                            ) : (
                              <p className="text-xs text-gray-500 mt-2">{task.progress}% Complete</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ClipboardList size={24} className="text-gray-600" />
                        </div>
                        <p className="text-gray-500">No tasks found. Create one to get started.</p>
                      </div>
                    )}
                  </div>
                </GlassCard>

                {/* AI Insights */}
                <GlassCard className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-indigo-500/30">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-500 rounded-lg">
                        <BarChart3 size={18} />
                      </div>
                      <h3 className="text-lg font-bold">AI Smart Insights</h3>
                    </div>
                    {isAiLoading && (
                      <div className="flex items-center gap-2 text-xs text-indigo-300">
                        <div className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                        <span>Analyzing...</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest mb-2">Priority Detection</p>
                      <p className="text-sm text-gray-300">
                        {isAiLoading ? "Analyzing task patterns for priority optimization..." : (aiInsights?.reason || "No insights available yet.")}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-purple-300 font-bold uppercase tracking-widest mb-2">Delay Prediction</p>
                      <p className="text-sm text-gray-300">
                        {isAiLoading ? "Monitoring deadlines for potential bottlenecks..." : (
                          aiInsights?.delayPrediction 
                            ? `Overall workload has a ${Math.round(aiInsights.delayPrediction.probability)}% probability of delay.` 
                            : "Monitoring deadlines for potential bottlenecks..."
                        )}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-green-300 font-bold uppercase tracking-widest mb-2">Efficiency Tip</p>
                      <p className="text-sm text-gray-300">
                        {isAiLoading ? "Calculating optimal assignments..." : "Technician Mike is currently free and has the best completion rate for 12K models."}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Task Dashboard</h1>
                <div className="flex gap-3">
                  {user?.role === 'SUPER_ADMIN' && (
                    <>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/10"
                      >
                        <Upload size={20} />
                        Restore System
                      </button>
                      <button 
                        onClick={handleBackup}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/10"
                      >
                        <Download size={20} />
                        Backup System
                      </button>
                    </>
                  )}
                  <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all">
                    <Filter size={20} />
                  </button>
                  {user?.role !== 'TECHNICIAN' && (user?.role !== 'OFFICER' || user?.employeeId === '42949') && (
                    <>
                      <button 
                        onClick={() => {
                          setEditingTask(null);
                          setNewTask({ 
                            title: '', 
                            model: 'Portable', 
                            details: '', 
                            urgency: 'REGULAR', 
                            assignedTo: '', 
                            deadline: '', 
                            points: 1, 
                            customStartTime: '', 
                            estimatedDuration: '',
                            workType: 'SINGLE',
                            assignedTechnicians: []
                          });
                          setSelectedTechs([]);
                          setIsTaskModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Plus size={20} />
                        Quick Add Task
                      </button>
                      <button 
                        onClick={() => {
                          setEditingTask(null);
                          setNewTask({ 
                            title: '', 
                            model: 'Portable', 
                            details: '', 
                            urgency: 'REGULAR', 
                            assignedTo: '', 
                            deadline: '', 
                            points: 1, 
                            customStartTime: '', 
                            estimatedDuration: '',
                            workType: 'SINGLE',
                            assignedTechnicians: []
                          });
                          setSelectedTechs([]);
                          setIsTaskModalOpen(true);
                        }}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/10"
                      >
                        <Plus size={20} />
                        Create Task
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-4 border-b border-white/10 pb-4">
                {(['ALL', 'PENDING', 'RUNNING', 'COMPLETED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setActiveTaskTab(status)}
                    className={cn(
                      "px-6 py-2 rounded-xl text-sm font-bold transition-all relative",
                      activeTaskTab === status ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    {status}
                    {activeTaskTab === status && (
                      <motion.div layoutId="activeTaskTab" className="absolute bottom-[-17px] left-0 right-0 h-1 bg-blue-500 rounded-full" />
                    )}
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-white/5 text-[10px]">
                      {status === 'ALL' ? filteredTasks.length : filteredTasks.filter(t => t.status === status).length}
                    </span>
                  </button>
                ))}
              </div>

              <GlassCard>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-widest">
                        <th className="px-4 py-4 font-medium">Task ID</th>
                        <th className="px-4 py-4 font-medium">Title & Assigned</th>
                        <th className="px-4 py-4 font-medium">Officer</th>
                        <th className="px-4 py-4 font-medium">Model</th>
                        <th className="px-4 py-4 font-medium">Urgency</th>
                        <th className="px-4 py-4 font-medium">Points</th>
                        <th className="px-4 py-4 font-medium">Status</th>
                        <th className="px-4 py-4 font-medium">Progress</th>
                        <th className="px-4 py-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredTasks.filter(t => activeTaskTab === 'ALL' || t.status === activeTaskTab).map(task => (
                        <tr key={task.id} className="hover:bg-white/5 transition-all group">
                          <td className="px-4 py-4 text-sm font-mono text-blue-400">{task.taskId}</td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-bold">{task.title}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                            Assigned to: {
                              (() => {
                                const assignee = staffList.find(s => s.name.toLowerCase() === task.assignedTo.toLowerCase());
                                if (assignee) {
                                  return `${assignee.name} (${assignee.employeeId})`;
                                }
                                return task.assignedTo;
                              })()
                            }
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            {(() => {
                              const assignee = staffList.find(s => s.name.toLowerCase() === task.assignedTo.toLowerCase());
                              if (assignee?.role === 'TECHNICIAN') {
                                const officer = staffList.find(s => s.id === assignee.supervisorId);
                                return <span className="text-sm text-blue-400 font-medium">{officer?.name || 'N/A'}</span>;
                              } else if (assignee?.role === 'OFFICER') {
                                return <span className="text-sm text-blue-400 font-medium">{assignee.name}</span>;
                              }
                              return <span className="text-sm text-gray-500">N/A</span>;
                            })()}
                          </td>
                          <td className="px-4 py-4 text-sm">{task.model}</td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full",
                              task.urgency === 'MOST_URGENT' ? "bg-red-500/20 text-red-500" : 
                              task.urgency === 'URGENT' ? "bg-amber-500/20 text-amber-500" : "bg-blue-500/20 text-blue-500"
                            )}>
                              {task.urgency}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm font-bold text-blue-400">{task.points || 0}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full font-bold",
                              task.status === 'RUNNING' ? "bg-amber-500/20 text-amber-500" : 
                              task.status === 'COMPLETED' ? "bg-green-500/20 text-green-500" :
                              task.status === 'HOLD' ? "bg-red-500/20 text-red-500" :
                              "bg-blue-500/20 text-blue-500"
                            )}>
                              {task.status}
                            </span>
                            {task.status === 'HOLD' && task.remarks && (
                              <p className="text-[10px] text-red-400 mt-1 italic max-w-[150px] truncate" title={task.remarks}>
                                Reason: {task.remarks}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {task.status === 'HOLD' ? (
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Paused</span>
                            ) : (
                              <div className="w-24 bg-white/10 h-1.5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${task.progress}%` }}
                                  className="h-full bg-blue-500"
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {['OFFICER', 'ENGINEER', 'IN_CHARGE', 'MODEL_MANAGER'].includes(user?.role || '') && task.status !== 'COMPLETED' && (
                                <button 
                                  onClick={() => {
                                    setStatusUpdateTask(task);
                                    setStatusUpdateData({ progress: task.progress, status: task.status, remarks: task.remarks || '', actualCompletionTime: '' });
                                    setIsStatusUpdateModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                                >
                                  Update Status
                                </button>
                              )}
                              {(['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER'].includes(user?.role || '') || (user?.role === 'OFFICER' && user?.employeeId === '42949')) && (
                                <>
                                  <button 
                                    onClick={() => {
                                      setEditingTask(task);
                                      setNewTask({
                                        title: task.title,
                                        model: task.model,
                                        details: task.details,
                                        urgency: task.urgency,
                                        assignedTo: task.assignedTo,
                                        deadline: task.deadline,
                                        points: task.points || 10,
                                        customStartTime: task.customStartTime || '',
                                        estimatedDuration: task.estimatedDuration || '',
                                        workType: task.workType || 'SINGLE',
                                        assignedTechnicians: task.assignedTechnicians || []
                                      });
                                      setSelectedTechs(task.assignedTechnicians || []);
                                      setIsTaskModalOpen(true);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-blue-400 transition-all"
                                    title="Update Task"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  {user?.role === 'SUPER_ADMIN' && (
                                    <button 
                                      onClick={() => setTaskToDelete(task.id)}
                                      className="p-2 hover:bg-white/10 rounded-lg text-red-400 transition-all"
                                      title="Delete Task"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </>
                              )}
                              <button 
                                onClick={() => {
                                  setSelectedTask(task);
                                  setTaskRemarks(task.remarks || '');
                                  setAssignToTech('');
                                  setIsTaskDetailsModalOpen(true);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-all flex items-center gap-2"
                              >
                                <span className="text-[10px] font-bold uppercase tracking-wider">View Task</span>
                                <ChevronRight size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold">Reporting Panel</h1>
              <ReportingPanel tasks={filteredTasks} staff={staffList} user={user} />
            </div>
          )}

          {activeTab === 'daily_task' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Daily Task List</h1>
                  <p className="text-gray-500 text-sm mt-1">Today's work plan for all assigned technicians</p>
                </div>
                <div className="flex gap-4">
                  <GlassCard className="px-6 py-3 flex items-center gap-3">
                    <Calendar className="text-blue-400 w-6 h-6" />
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Today's Date</p>
                      <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                    </div>
                  </GlassCard>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {staffList
                  .filter(s => s.role === 'TECHNICIAN' && isStaffInScope(s))
                  .map(tech => {
                    const today = new Date().toISOString().split('T')[0];
                    const techTasks = tasks.filter(t => {
                      const isAssigned = t.assignedTo === tech.name || 
                        (t.workType === 'TEAM' && t.assignedTechnicians?.some(at => at.employeeId === tech.employeeId));
                      return isAssigned && t.status !== 'COMPLETED' && t.deadline.startsWith(today);
                    });

                    if (techTasks.length === 0) return null;

                    return (
                      <div key={tech.id} className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100">
                        <div className="bg-blue-600 p-6 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-white text-xl">
                              {tech.name[0]}
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-white">{tech.name}</h3>
                              <p className="text-blue-100 text-sm font-bold tracking-widest uppercase">{tech.employeeId} • {tech.phone || 'No Number'}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => exportToWhatsApp(tech)}
                            className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 rounded-xl flex items-center gap-2 text-sm font-black transition-all shadow-xl"
                          >
                            <Share2 size={18} />
                            Share to WhatsApp
                          </button>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50">
                          {techTasks.map(task => (
                            <div key={task.id} className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
                              <div className="flex justify-between items-start">
                                <h4 className="text-xl font-black text-gray-900 leading-tight">{task.title}</h4>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  task.urgency === 'MOST_URGENT' ? 'bg-red-100 text-red-600' :
                                  task.urgency === 'URGENT' ? 'bg-amber-100 text-amber-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>
                                  {task.urgency}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Model</p>
                                  <p className="text-sm font-bold text-gray-700">{task.model}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Deadline</p>
                                  <p className="text-sm font-bold text-gray-700">{new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Location/Details</p>
                                  <p className="text-sm font-medium text-gray-600 line-clamp-2">{task.details}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                
                {staffList.filter(s => s.role === 'TECHNICIAN' && isStaffInScope(s)).every(tech => {
                  const today = new Date().toISOString().split('T')[0];
                  return tasks.filter(t => t.assignedTo === tech.name && t.status !== 'COMPLETED' && t.deadline.startsWith(today)).length === 0;
                }) && (
                  <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <ClipboardList className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400">No tasks assigned for today</h3>
                    <p className="text-gray-500 mt-2">All technicians are currently free or tasks are completed.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'other_team_requests' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold mb-2">Other Team Requests</h1>
                  <p className="text-gray-400">Approve or reject technician requests from other teams</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {tasks.filter(t => t.status === 'REQUESTED' && staffList.find(s => s.name === t.assignedTo || s.employeeId === t.assignedTo)?.supervisorId === user?.id).length === 0 ? (
                  <GlassCard className="p-12 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bell size={40} className="text-gray-600" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No Pending Requests</h3>
                    <p className="text-gray-400">You don't have any technician requests from other teams at the moment.</p>
                  </GlassCard>
                ) : (
                  tasks.filter(t => t.status === 'REQUESTED' && staffList.find(s => s.name === t.assignedTo || s.employeeId === t.assignedTo)?.supervisorId === user?.id).map((task, idx) => {
                    const requester = staffList.find(s => s.employeeId === task.createdBy);
                    return (
                      <GlassCard key={task.id} delay={idx * 0.1} className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider">
                                {task.model}
                              </span>
                              <span className="text-gray-500 text-xs">{new Date(task.createdAt).toLocaleString()}</span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                task.urgency === 'MOST_URGENT' ? "bg-red-500/20 text-red-500" :
                                task.urgency === 'URGENT' ? "bg-amber-500/20 text-amber-500" :
                                "bg-blue-500/20 text-blue-500"
                              )}>
                                {task.urgency}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold mb-2">{task.title}</h3>
                            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{task.details}</p>
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2 text-gray-400">
                                <UserCircle size={16} />
                                <span>Requested By: <span className="text-white font-medium">{requester?.name || task.createdBy}</span></span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <Wrench size={16} />
                                <span>Technician: <span className="text-white font-medium">{task.assignedTo}</span></span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <Calendar size={16} />
                                <span>Deadline: <span className="text-white font-medium">{new Date(task.deadline).toLocaleString()}</span></span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400">
                                <Star size={16} />
                                <span>Points: <span className="text-white font-medium">{task.points || 0}</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                setSelectedTask(task);
                                setIsTaskDetailsModalOpen(true);
                              }}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all flex items-center gap-2 border border-white/10"
                            >
                              <Eye size={18} />
                              View
                            </button>
                            <button 
                              onClick={() => handleApproveRequest(task.id)}
                              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                            >
                              <CheckCircle2 size={18} />
                              Approve
                            </button>
                            <button 
                              onClick={() => {
                                setRejectTaskId(task.id);
                                setRejectRemarks('');
                                setIsRejectModalOpen(true);
                              }}
                              className="px-6 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-xl border border-red-600/30 transition-all flex items-center gap-2"
                            >
                              <X size={18} />
                              Reject
                            </button>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-4xl font-bold mb-2">Theme Settings</h1>
                <p className="text-gray-400">Customize your workspace appearance</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Settings className="text-blue-400" />
                    Select Theme
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { id: 'dark', name: 'Deep Dark', color: '#0f0f12' },
                      { id: 'light', name: 'Clean Light', color: '#f8fafc' },
                      { id: 'blue', name: 'Ocean Blue', color: '#1e3a8a' },
                      { id: 'purple', name: 'Royal Purple', color: '#4c1d95' },
                      { id: 'green', name: 'Forest Green', color: '#064e3b' },
                      { id: 'red', name: 'Crimson Red', color: '#7f1d1d' },
                      { id: 'gold', name: 'Luxury Gold', color: '#78350f' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
                          user?.theme === t.id ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/20 bg-white/5"
                        )}
                      >
                        <div className="w-10 h-10 rounded-full shadow-inner" style={{ backgroundColor: t.color }} />
                        <span className="text-xs font-medium">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Upload className="text-blue-400" />
                    Custom Background
                  </h3>
                  <div className="space-y-6">
                    <div 
                      className="aspect-video rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-all cursor-pointer relative overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {user?.customBackground ? (
                        <img src={user.customBackground} alt="Custom Background" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                            <Plus className="text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-400">Click to upload background image</p>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                    />
                    {user?.customBackground && (
                      <button 
                        onClick={() => handleThemeChange(user?.theme || 'dark', true)}
                        className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-xl border border-red-600/30 transition-all"
                      >
                        Remove Custom Background
                      </button>
                    )}
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto">
              <GlassCard className="p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-600/30 mb-6 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      user?.name[0]
                    )}
                  </div>
                  <h2 className="text-3xl font-bold">{user?.name}</h2>
                  <p className="text-blue-400 font-mono mt-1">{user?.employeeId}</p>
                  <div className="mt-2 px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-full uppercase tracking-widest">
                    {user?.role.replace('_', ' ')}
                  </div>
                  {user?.designation && (
                    <p className="text-gray-400 mt-2 italic">{user.designation}</p>
                  )}

                  {user?.role === 'OFFICER' && (
                    <div className="w-full grid grid-cols-2 gap-4 mt-6">
                      <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-600/20">
                        <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Total Points</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {pointTransactions.filter(pt => pt.officerId === user.id).reduce((acc, pt) => acc + (pt.pointValue || 0), 0)}
                        </p>
                      </div>
                      <div className="bg-purple-600/10 p-4 rounded-2xl border border-purple-600/20">
                        <p className="text-xs text-purple-400 uppercase tracking-wider mb-1">Monthly Points</p>
                        <p className="text-2xl font-bold text-purple-400">
                          {pointTransactions
                            .filter(pt => pt.officerId === user.id && new Date(pt.completedAt).getMonth() === new Date().getMonth())
                            .reduce((acc, pt) => acc + (pt.pointValue || 0), 0)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="w-full space-y-3 mt-8">
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                      <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                        <Phone size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Mobile Number</p>
                        <p className="text-lg font-bold">{formatPhone(user?.phone) || 'Not Provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                      <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
                        <FileText size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email Address</p>
                        <p className="text-lg font-bold">{user?.email || 'Not Provided'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Department</p>
                      <p className="font-bold">{user?.department || 'RAC R&I'}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                      <p className="font-bold text-green-400">Active</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Staff Management</h1>
                <div className="flex gap-3">
                  {user?.role === 'SUPER_ADMIN' && (
                    <>
                      <button 
                        onClick={() => handleProcessEmployees()}
                        disabled={isProcessingEmployees}
                        className={cn(
                          "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-blue-600/20",
                          isProcessingEmployees && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <FileSpreadsheet size={20} className={isProcessingEmployees ? "animate-pulse" : ""} />
                        {isProcessingEmployees ? "Processing..." : "Process Employee Data"}
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/10"
                      >
                        <Upload size={20} />
                        Restore System
                      </button>
                      <button 
                        onClick={handleBackup}
                        className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-white/10"
                      >
                        <Download size={20} />
                        Backup System
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => {
                      setEditingStaff(null);
                      setNewStaff({ employeeId: '', name: '', role: 'TECHNICIAN', password: '', avatar: '', supervisorId: '', assignedEngineers: [], phone: '', designation: '', email: '', department: 'RAC R&I' });
                      setIsStaffModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                  >
                    <Plus size={20} />
                    Add Staff
                  </button>
                </div>
              </div>

              {user?.role === 'OFFICER' && (
                <div className="mb-4">
                  <div className="mb-12">
                    <h2 className="text-xl font-bold mb-4 text-purple-400">Assigned Authorities</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {staffList.filter(s => user.assignedEngineers?.includes(s.employeeId)).map((auth, i) => (
                        <GlassCard key={auth.id} className="flex flex-col items-center text-center p-4">
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 mb-3 bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xl font-bold">
                            {auth.avatar ? (
                              <img src={auth.avatar} alt={auth.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              auth.name[0]
                            )}
                          </div>
                          <h3 className="font-bold text-white">{auth.name}</h3>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{auth.role.replace('_', ' ')}</p>
                          <p className="text-[10px] text-blue-400 font-mono mt-1">{auth.employeeId}</p>
                          {auth.phone && (
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-2">
                              <Phone size={10} />
                              {auth.phone}
                            </div>
                          )}
                        </GlassCard>
                      ))}
                      {(!user.assignedEngineers || user.assignedEngineers.length === 0) && (
                        <div className="col-span-full py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                          <p className="text-gray-500 text-sm italic">No authorities assigned yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <h2 className="text-xl font-bold mb-4 text-blue-400">My Team Technicians</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staffList.filter(s => s.supervisorId === user.id).map((staff, i) => {
                      const isWorking = tasks.some(t => t.assignedTo === staff.name && (t.status === 'PENDING' || t.status === 'RUNNING'));
                      return (
                        <GlassCard key={staff.id} className="flex flex-col items-center text-center relative group transition-all duration-300 hover:bg-white/10">
                          <div className="absolute top-4 left-4">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full",
                              isWorking ? "bg-amber-500/20 text-amber-500" : "bg-green-500/20 text-green-500"
                            )}>
                              {isWorking ? 'BUSY' : 'IDLE'}
                            </span>
                          </div>
                          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                            {staff.avatar ? (
                              <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              staff.name[0]
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-white">{staff.name}</h3>
                          <p className="text-xs text-gray-400 mb-1">{staff.role}</p>
                          <p className="text-[10px] text-blue-400 font-mono mb-4">{staff.employeeId}</p>
                          
                          <div className="w-full pt-3 border-t border-white/5 space-y-2">
                            <div className="flex flex-col items-center">
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Status: <span className={isWorking ? "text-amber-500" : "text-green-500"}>{isWorking ? 'BUSY' : 'IDLE'}</span></p>
                            </div>
                            
                            {!isWorking && (
                              <div className="flex flex-col items-center">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Contact:</p>
                                <p className="text-sm font-mono text-blue-400">{formatPhone(staff.phone) || '01XXXXXXXXX'}</p>
                              </div>
                            )}
                          </div>
                        </GlassCard>
                      );
                    })}
                  </div>
                  
                  <h2 className="text-xl font-bold mt-12 mb-4 text-gray-400">Other Team Technicians</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staffList.filter(s => s.role === 'TECHNICIAN' && s.supervisorId !== user.id).map((staff, i) => {
                      const isWorking = tasks.some(t => t.assignedTo === staff.name && (t.status === 'PENDING' || t.status === 'RUNNING'));
                      return (
                        <GlassCard key={staff.id} className="flex flex-col items-center text-center relative group opacity-70 hover:opacity-100 transition-all duration-300 hover:bg-white/10">
                          <div className="absolute top-4 left-4">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full",
                              isWorking ? "bg-amber-500/20 text-amber-500" : "bg-green-500/20 text-green-500"
                            )}>
                              {isWorking ? 'BUSY' : 'IDLE'}
                            </span>
                          </div>
                          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 mb-4 bg-gray-700 flex items-center justify-center text-3xl font-bold">
                            {staff.avatar ? (
                              <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                            ) : (
                              staff.name[0]
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-white">{staff.name}</h3>
                          <p className="text-xs text-gray-400 mb-1">{staff.role}</p>
                          <p className="text-[10px] text-blue-400 font-mono mb-4">{staff.employeeId}</p>

                          <div className="w-full pt-3 border-t border-white/5 space-y-2">
                            <div className="flex flex-col items-center">
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Status: <span className={isWorking ? "text-amber-500" : "text-green-500"}>{isWorking ? 'BUSY' : 'IDLE'}</span></p>
                            </div>
                            
                            {!isWorking && (
                              <div className="flex flex-col items-center">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Contact:</p>
                                <p className="text-sm font-mono text-blue-400">{formatPhone(staff.phone) || '01XXXXXXXXX'}</p>
                              </div>
                            )}
                          </div>
                        </GlassCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {user?.role !== 'OFFICER' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {staffList.filter(s => {
                    if (user?.role === 'SUPER_ADMIN' || user?.role === 'HOD') return true;
                    if (user?.role === 'IN_CHARGE' || user?.role === 'MODEL_MANAGER') {
                      return s.role === 'ENGINEER' && (user.assignedEngineers || []).includes(s.employeeId);
                    }
                    return false;
                  }).map((staff, i) => (
                    <GlassCard key={staff.id} className="flex flex-col items-center text-center relative group">
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingStaff(staff);
                            setNewStaff({ 
                              employeeId: staff.employeeId, 
                              name: staff.name, 
                              role: staff.role,
                              password: '',
                              avatar: staff.avatar || '',
                              supervisorId: staff.supervisorId || '',
                              assignedEngineers: staff.assignedEngineers || [],
                              phone: staff.phone || '',
                              designation: staff.designation || '',
                              email: staff.email || '',
                              department: staff.department || 'RAC R&I'
                            });
                            setIsStaffModalOpen(true);
                          }}
                          className="p-2 bg-white/10 hover:bg-blue-600 rounded-lg transition-all text-white"
                          title="Edit Staff"
                        >
                          <Settings size={14} />
                        </button>
                        {user?.role === 'SUPER_ADMIN' && (
                          <button 
                            onClick={() => {
                              setResetPasswordUser(staff);
                              setIsResetPasswordModalOpen(true);
                            }}
                            className="p-2 bg-white/10 hover:bg-amber-600 rounded-lg transition-all text-white"
                            title="Reset Password"
                          >
                            <Lock size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => setStaffToDelete(staff.id)}
                          className="p-2 bg-white/10 hover:bg-red-600 rounded-lg transition-all text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-white/10 mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold">
                        {staff.avatar ? (
                          <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          staff.name[0]
                        )}
                      </div>
                      <h3 className="text-xl font-bold">{staff.name}</h3>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{staff.role.replace('_', ' ')}</p>
                      <p className="text-xs text-gray-400 mt-1">{staff.employeeId}</p>
                      <p className="text-blue-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">{staff.department || 'RAC R&I'}</p>
                      {staff.phone && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-2">
                          <Phone size={10} />
                          {staff.phone}
                        </div>
                      )}
                      
                      {staff.supervisorId && (
                        <p className="text-[10px] text-blue-400 mt-2">
                          Under: {staffList.find(s => s.id === staff.supervisorId)?.name || 'Unknown'}
                        </p>
                      )}
                      
                      <div className="w-full mt-8">
                        <div className="bg-white/5 p-3 rounded-xl text-center">
                          <p className="text-xs text-gray-400">Status</p>
                          <p className="text-sm font-bold text-green-400">Active</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setViewingStaff(staff)}
                        className="w-full mt-6 py-3 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/5 transition-all"
                      >
                        View Profile
                      </button>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'backup_restore' && (
            <div className="space-y-8 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h1 className="text-3xl font-bold">Backup & Restore</h1>
                <p className="text-gray-500 mt-2">Manage your panel-specific data backups and restoration.</p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                    <ClipboardList size={32} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Task Backup</h2>
                  <p className="text-gray-400 text-sm mb-8">Backup all tasks, status, timeline, and history under your panel scope.</p>
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => handlePanelBackup('tasks', 'json')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} /> JSON
                    </button>
                    <button 
                      onClick={() => handlePanelBackup('tasks', 'excel')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <FileSpreadsheet size={18} /> Excel
                    </button>
                  </div>
                </GlassCard>

                <GlassCard className="p-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-400 mb-6">
                    <Database size={32} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Full Panel Backup</h2>
                  <p className="text-gray-400 text-sm mb-8">Backup tasks, assigned users, mapping data, and performance data for your panel.</p>
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => handlePanelBackup('full', 'json')}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} /> JSON
                    </button>
                    <button 
                      onClick={() => handlePanelBackup('full', 'excel')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <FileSpreadsheet size={18} /> Excel
                    </button>
                  </div>
                </GlassCard>

                <GlassCard className="p-8 flex flex-col items-center text-center md:col-span-2">
                  <div className="w-16 h-16 bg-amber-600/20 rounded-2xl flex items-center justify-center text-amber-400 mb-6">
                    <Upload size={32} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Restore Data</h2>
                  <p className="text-gray-400 text-sm mb-8">Upload a previously saved backup file to restore your panel data. This will only affect data within your scope.</p>
                  <input 
                    type="file" 
                    accept=".json,.xlsx" 
                    className="hidden" 
                    ref={panelRestoreInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePanelRestore(file);
                    }}
                  />
                  <button 
                    onClick={() => panelRestoreInputRef.current?.click()}
                    className="w-full max-w-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Upload size={20} /> Upload & Restore
                  </button>
                  <p className="text-[10px] text-gray-500 mt-4 uppercase tracking-widest">Supports .json and .xlsx formats</p>
                </GlassCard>

                {user?.role === 'SUPER_ADMIN' && (
                  <GlassCard className="p-8 flex flex-col items-center text-center md:col-span-2 border-red-500/30">
                    <div className="w-16 h-16 bg-red-600/20 rounded-2xl flex items-center justify-center text-red-400 mb-6">
                      <BarChart3 size={32} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Recalculate Points</h2>
                    <p className="text-gray-400 text-sm mb-8">Scan all completed tasks and backfill missing points to officer profiles. This ensures historical tasks are correctly counted.</p>
                    <button 
                      onClick={handleRecalculatePoints}
                      className="w-full max-w-xs bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <BarChart3 size={20} /> Recalculate & Backfill
                    </button>
                    <p className="text-[10px] text-red-500 mt-4 uppercase tracking-widest font-bold">Admin Only: Fixes point mismatches</p>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {activeTab === 'officer_tasks' && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold">My Assigned Tasks</h1>
              <div className="grid grid-cols-1 gap-6">
                {tasks.filter(t => t.assignedTo === user?.name).map(task => (
                  <GlassCard key={task.id} className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-blue-400">{task.taskId}</span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                          task.urgency === 'MOST_URGENT' ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                        )}>
                          {task.urgency}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold">{task.title}</h3>
                      <p className="text-sm text-gray-400 mt-1">{task.details}</p>
                      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock size={12} /> Deadline: {new Date(task.deadline).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><UserCircle size={12} /> From: {task.assignedBy}</span>
                        <span className="flex items-center gap-1 font-bold text-blue-400">Points: {task.points || 10}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[150px]">
                      <div className="text-center mb-2">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Status</p>
                        <span className="text-sm font-bold text-amber-500">{task.status}</span>
                      </div>
                      <button 
                        onClick={() => setShowDistributeModal(task.id)}
                        className="w-full py-2 bg-blue-600 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                      >
                        Distribute to Tech
                      </button>
                    </div>
                  </GlassCard>
                ))}
                {tasks.filter(t => t.assignedTo === user?.name).length === 0 && (
                   <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                     <p className="text-gray-500">No tasks assigned to you yet.</p>
                   </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Technician Attendance</h1>
                  <p className="text-gray-500 text-sm mt-1">Daily attendance management for technicians</p>
                </div>
                <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
                  <Calendar size={14} className="text-blue-400" />
                  <span className="text-xs font-bold text-blue-400">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-400">Daily Reset System Active</p>
                  <p className="text-[10px] text-gray-500">All technicians are auto-set to "Present" at 00:00 every day. Officers can manually update status below.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffList
                  .filter(s => s.role === 'TECHNICIAN' && isStaffInScope(s))
                  .map((tech, i) => {
                    const techAttendance = attendance.find(a => a.technicianId === tech.employeeId);
                    return (
                      <GlassCard key={tech.id} className="flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-bold">
                            {tech.name[0]}
                          </div>
                          <div>
                            <h3 className="font-bold">{tech.name}</h3>
                            <p className="text-xs text-gray-500">{tech.employeeId}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'PRESENT', value: 'PRESENT' },
                            { label: 'ABSENT', value: 'ABSENT' },
                            { label: 'LEAVE', value: 'LEAVE' },
                            { label: 'SHORT-LEAVE', value: 'SHORT_LEAVE' }
                          ].map(opt => (
                            <button 
                              key={opt.value}
                              onClick={() => handleUpdateAttendance(tech.employeeId, opt.value)}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-bold transition-all",
                                techAttendance?.status === opt.value 
                                  ? "bg-blue-600 text-white" 
                                  : "bg-white/5 text-gray-500 hover:bg-white/10"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </GlassCard>
                    );
                  })}
                {staffList.filter(s => s.role === 'TECHNICIAN' && (user?.role === 'SUPER_ADMIN' || user?.role === 'HOD' || s.supervisorId === user?.id)).length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <p className="text-gray-500">No technicians found in the system.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Employee Performance</h1>
                  <p className="text-gray-500 text-sm mt-1">Real-time performance metrics and leaderboard</p>
                </div>
                <div className="flex gap-4">
                  <GlassCard className="px-6 py-3 flex items-center gap-3">
                    <Award className="text-amber-400 w-6 h-6" />
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Top Performer</p>
                      <p className="text-sm font-bold">
                        {staffList
                          .map(s => ({ name: s.name, total: calculatePerformance(s).total }))
                          .sort((a, b) => b.total - a.total)[0]?.name || 'N/A'}
                      </p>
                    </div>
                  </GlassCard>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <TrendingUp className="text-blue-400" /> Performance Leaderboard
                    </h2>
                    <div className="space-y-4">
                      {staffList
                        .filter(s => {
                          if (user?.role === 'SUPER_ADMIN' || user?.role === 'HOD' || user?.role === 'IN_CHARGE' || user?.role === 'MODEL_MANAGER') {
                            return s.role === 'TECHNICIAN' || s.role === 'OFFICER' || s.role === 'ENGINEER';
                          }
                          if (user?.role === 'OFFICER') {
                            return s.role === 'TECHNICIAN' && s.supervisorId === user.id;
                          }
                          return isStaffInScope(s) && (s.role === 'TECHNICIAN' || s.role === 'OFFICER' || s.role === 'ENGINEER');
                        })
                        .map(s => ({ ...s, perf: calculatePerformance(s) }))
                        .sort((a, b) => b.perf.total - a.perf.total)
                        .map((s, idx) => (
                          <GlassCard key={s.id} className="flex items-center gap-6 group hover:bg-white/10 transition-all">
                            <div className="w-10 h-10 flex items-center justify-center font-bold text-xl text-gray-500">
                              {idx + 1}
                            </div>
                            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-bold text-blue-400">
                              {s.name[0]}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg">{s.name}</h3>
                              <p className="text-xs text-gray-500 uppercase tracking-wider">{s.role.replace('_', ' ')} • {s.employeeId}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-8 text-center">
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase mb-1">Tasks</p>
                                <p className="font-bold text-blue-400">{s.perf.taskScore}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase mb-1">Attendance</p>
                                <p className="font-bold text-green-400">{s.perf.attendanceScore}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase mb-1">Efficiency</p>
                                <p className="font-bold text-purple-400">{s.perf.efficiencyScore}</p>
                              </div>
                            </div>
                            <div className="ml-6 px-4 py-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
                              <p className="text-[10px] text-blue-400 uppercase font-bold text-center">Total</p>
                              <p className="text-xl font-black text-white">{s.perf.total}</p>
                            </div>
                          </GlassCard>
                        ))}
                    </div>
                  </div>

                  {['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER'].includes(user?.role || '') && (
                    <div className="space-y-6">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Award className="text-purple-400" /> Officer Point Rankings
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {staffList
                          .filter(s => s.role === 'OFFICER')
                          .map(s => {
                            const points = pointTransactions
                              .filter(pt => pt.officerId === s.id)
                              .reduce((sum, pt) => sum + pt.pointValue, 0);
                            const thisMonthPoints = pointTransactions
                              .filter(pt => pt.officerId === s.id && new Date(pt.completedAt).getMonth() === new Date().getMonth())
                              .reduce((sum, pt) => sum + pt.pointValue, 0);
                            return { ...s, points, thisMonthPoints };
                          })
                          .sort((a, b) => b.points - a.points)
                          .map((s, idx) => (
                            <GlassCard key={s.id} className="flex items-center justify-between p-4 border-purple-500/20">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-600/20 text-purple-400 rounded-full flex items-center justify-center font-bold text-sm">
                                  {idx + 1}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{s.name}</p>
                                  <p className="text-[10px] text-gray-500">{s.employeeId}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-black text-white">{s.points}</p>
                                <p className="text-[10px] text-purple-400 font-bold">+{s.thisMonthPoints} this month</p>
                              </div>
                            </GlassCard>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BarChart3 className="text-amber-400" /> Scoring System
                  </h2>
                  <GlassCard className="p-6 space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">Task Performance</span>
                        <span className="text-xs text-blue-400 font-bold">60 Marks</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: '60%' }} />
                      </div>
                      <p className="text-[10px] text-gray-500">Based on total points earned from completed tasks. 100 points = 60 marks.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">Attendance</span>
                        <span className="text-xs text-green-400 font-bold">10 Marks</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: '10%' }} />
                      </div>
                      <p className="text-[10px] text-gray-500">Based on daily attendance percentage. (Present Days / Total Days) * 10.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">Efficiency</span>
                        <span className="text-xs text-purple-400 font-bold">30 Marks</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: '30%' }} />
                      </div>
                      <p className="text-[10px] text-gray-500">Based on work quality (15) and on-time completion rate (15).</p>
                    </div>
                  </GlassCard>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'technician_monitoring' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold mb-2">Technician Monitoring</h1>
                  <p className="text-gray-400">Real-time workforce management and utilization tracking</p>
                </div>
                <div className="flex gap-4">
                  <div className="px-4 py-2 bg-green-400/10 border border-green-400/20 rounded-xl flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-green-400">
                      {staffList.filter(s => {
                        if (s.role !== 'TECHNICIAN') return false;
                        if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                        const today = new Date().toISOString().split('T')[0];
                        const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                        return getTechnicianStatus(s.employeeId).status !== 'Idle' && todayAttendance?.status === 'PRESENT';
                      }).length} Working
                    </span>
                  </div>
                  <div className="px-4 py-2 bg-gray-400/10 border border-gray-400/20 rounded-xl flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    <span className="text-xs font-bold text-gray-400">
                      {staffList.filter(s => {
                        if (s.role !== 'TECHNICIAN') return false;
                        if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                        const today = new Date().toISOString().split('T')[0];
                        const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                        return getTechnicianStatus(s.employeeId).status === 'Idle' && todayAttendance?.status === 'PRESENT';
                      }).length} Free
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-12">
                {/* Working Technicians Section */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                    <h2 className="text-2xl font-bold text-white">Working Technicians</h2>
                    <span className="px-2.5 py-0.5 bg-green-500/10 text-green-500 text-xs font-bold rounded-full border border-green-500/20">
                      {staffList.filter(s => {
                        if (s.role !== 'TECHNICIAN') return false;
                        if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                        const today = new Date().toISOString().split('T')[0];
                        const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                        return getTechnicianStatus(s.employeeId).status !== 'Idle' && todayAttendance?.status === 'PRESENT';
                      }).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staffList
                      .filter(s => {
                        if (s.role !== 'TECHNICIAN') return false;
                        if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                        const today = new Date().toISOString().split('T')[0];
                        const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                        return getTechnicianStatus(s.employeeId).status !== 'Idle' && todayAttendance?.status === 'PRESENT';
                      })
                      .map((tech) => renderTechnicianCard(tech))}
                    {staffList.filter(s => {
                      if (s.role !== 'TECHNICIAN') return false;
                      if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                      const today = new Date().toISOString().split('T')[0];
                      const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                      return getTechnicianStatus(s.employeeId).status !== 'Idle' && todayAttendance?.status === 'PRESENT';
                    }).length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <p className="text-gray-500">No technicians are currently working on tasks.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Free Technicians Section */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-gray-500 rounded-full" />
                    <h2 className="text-2xl font-bold text-white">Free Technicians</h2>
                    <span className="px-2.5 py-0.5 bg-gray-500/10 text-gray-500 text-xs font-bold rounded-full border border-gray-500/20">
                      {staffList.filter(s => {
                        if (s.role !== 'TECHNICIAN') return false;
                        if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                        const today = new Date().toISOString().split('T')[0];
                        const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                        return getTechnicianStatus(s.employeeId).status === 'Idle' && todayAttendance?.status === 'PRESENT';
                      }).length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staffList
                      .filter(s => {
                        if (s.role !== 'TECHNICIAN') return false;
                        if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                        const today = new Date().toISOString().split('T')[0];
                        const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                        return getTechnicianStatus(s.employeeId).status === 'Idle' && todayAttendance?.status === 'PRESENT';
                      })
                      .map((tech) => renderTechnicianCard(tech))}
                    {staffList.filter(s => {
                      if (s.role !== 'TECHNICIAN') return false;
                      if (user?.role !== 'OFFICER' && !isStaffInScope(s)) return false;
                      const today = new Date().toISOString().split('T')[0];
                      const todayAttendance = attendance.find(a => a.technicianId === s.employeeId && a.date === today);
                      return getTechnicianStatus(s.employeeId).status === 'Idle' && todayAttendance?.status === 'PRESENT';
                    }).length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <p className="text-gray-500">No free technicians available at the moment.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Model Distribution</h1>
                  <p className="text-gray-400 mt-1">Monitoring tasks for your assigned models.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Manager ID</p>
                  <p className="text-blue-400 font-mono font-bold">{user?.employeeId}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(() => {
                  const myModels = user?.employeeId === '38056' ? ['12K', '9K', 'Portable'] :
                                   user?.employeeId === '37091' ? ['18K'] :
                                   user?.employeeId === '41053' ? ['24K', '30K', '36K'] :
                                   user?.employeeId === '54589' ? ['Chemical & Polymer'] : [];
                  
                  return myModels.map(m => {
                    const modelTasks = filteredTasks.filter(t => t.model === m);
                    const activeCount = modelTasks.filter(t => t.status === 'RUNNING').length;
                    const pendingCount = modelTasks.filter(t => t.status === 'PENDING').length;
                    const completedCount = modelTasks.filter(t => t.status === 'COMPLETED').length;
                    
                    return (
                      <GlassCard key={m} className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="text-xl font-bold">{m} Series</h3>
                            <p className="text-xs text-gray-500 mt-1">Model-wise Distribution</p>
                          </div>
                          <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg">
                            <AirVent size={20} />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mb-6">
                          <div className="text-center p-2 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-[10px] text-gray-500 uppercase">Pending</p>
                            <p className="text-lg font-bold text-amber-500">{pendingCount}</p>
                          </div>
                          <div className="text-center p-2 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-[10px] text-gray-500 uppercase">Running</p>
                            <p className="text-lg font-bold text-blue-500">{activeCount}</p>
                          </div>
                          <div className="text-center p-2 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-[10px] text-gray-500 uppercase">Compl.</p>
                            <p className="text-lg font-bold text-green-500">{completedCount}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Tasks</p>
                           {modelTasks.slice(0, 3).map(t => (
                             <div key={t.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center hover:bg-white/10 transition-all cursor-pointer" onClick={() => { setSelectedTask(t); setIsTaskDetailsModalOpen(true); }}>
                               <div className="min-w-0">
                                 <p className="text-xs font-bold truncate">{t.title}</p>
                                 <p className="text-[9px] text-gray-500">{t.taskId}</p>
                               </div>
                               <span className={cn(
                                 "text-[8px] font-bold px-1.5 py-0.5 rounded",
                                 t.status === 'RUNNING' ? "bg-blue-500/20 text-blue-500" :
                                 t.status === 'PENDING' ? "bg-amber-500/20 text-amber-500" :
                                 "bg-green-500/20 text-green-500"
                               )}>
                                 {t.status}
                               </span>
                             </div>
                           ))}
                           {modelTasks.length === 0 && (
                             <p className="text-[10px] text-gray-600 italic">No tasks for this model</p>
                           )}
                        </div>
                      </GlassCard>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {activeTab === 'section' && (
            <div className="space-y-8 pb-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">{user?.role === 'IN_CHARGE' ? "Section Monitoring Dashboard" : "Department Monitoring Dashboard"}</h1>
                  <p className="text-gray-400 mt-1">Real-time monitoring of Engineer activities and task progress.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={14} />
                  <span>Last updated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Section Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(() => {
                  const myEngineers = staffList.filter(s => {
                    if (s.role !== 'ENGINEER') return false;
                    if (user.role === 'SUPER_ADMIN' || user.role === 'HOD') return true;
                    return user.assignedEngineers?.includes(s.employeeId);
                  });
                  
                  const myTasks = filteredTasks; // Use the already scoped filteredTasks

                  return (
                    <>
                      <StatCard 
                        label="Total Engineers" 
                        value={myEngineers.length} 
                        icon={Users} 
                        color="bg-purple-500" 
                      />
                      <StatCard 
                        label="Active Tasks" 
                        value={myTasks.filter(t => t.status === 'RUNNING').length} 
                        icon={Activity} 
                        color="bg-blue-500" 
                      />
                      <StatCard 
                        label="Pending Tasks" 
                        value={myTasks.filter(t => t.status === 'PENDING').length} 
                        icon={Clock} 
                        color="bg-amber-500" 
                      />
                      <StatCard 
                        label="Delayed Tasks" 
                        value={myTasks.filter(t => t.status === 'DELAYED' || (t.status !== 'COMPLETED' && new Date(t.deadline) < new Date())).length} 
                        icon={AlertCircle} 
                        color="bg-red-500" 
                      />
                    </>
                  );
                })()}
              </div>

              {/* Engineer Monitoring List */}
              <div className="space-y-8">
                {staffList.filter(s => {
                  if (s.role !== 'ENGINEER') return false;
                  
                  // Super Admin and HOD see everyone
                  if (user.role === 'SUPER_ADMIN' || user.role === 'HOD') return true;
                  
                  // In-Charge ONLY sees assigned engineers
                  if (user.role === 'IN_CHARGE') {
                    return user.assignedEngineers?.includes(s.employeeId);
                  }
                  
                  return false;
                }).map((engineer) => {
                  const engineerTasks = tasks.filter(t => {
                    const creator = staffList.find(s => s.employeeId === t.createdBy);
                    const assignee = staffList.find(s => s.name.toLowerCase().trim() === t.assignedTo.toLowerCase().trim());
                    
                    const isCreatedByEngineer = t.createdBy === engineer.employeeId;
                    const isAssignedByEngineer = t.assignedBy === engineer.employeeId;
                    const isAssignedToEngineer = t.assignedTo.toLowerCase().trim() === engineer.name.toLowerCase().trim();
                    
                    // Check if creator is subordinate of this engineer
                    const isCreatorSubordinate = creator && (
                      (creator.role === 'OFFICER' && creator.supervisorId === engineer.id) ||
                      (creator.role === 'TECHNICIAN' && (
                        staffList.find(s => s.id === creator.supervisorId && s.role === 'OFFICER' && s.supervisorId === engineer.id) ||
                        creator.supervisorId === engineer.id
                      ))
                    );

                    // Check if assignee is subordinate of this engineer
                    const isAssigneeSubordinate = assignee && (
                      (assignee.role === 'OFFICER' && assignee.supervisorId === engineer.id) ||
                      (assignee.role === 'TECHNICIAN' && (
                        staffList.find(s => s.id === assignee.supervisorId && s.role === 'OFFICER' && s.supervisorId === engineer.id) ||
                        assignee.supervisorId === engineer.id
                      ))
                    );

                    return isCreatedByEngineer || isAssignedByEngineer || isAssignedToEngineer || isCreatorSubordinate || isAssigneeSubordinate;
                  });

                  return (
                    <GlassCard key={engineer.id} className="overflow-hidden border-white/10">
                      <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">
                            {engineer.name[0]}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">{engineer.name}</h3>
                            <p className="text-xs text-blue-400 font-mono">{engineer.employeeId}</p>
                          </div>
                        </div>
                        <div className="flex gap-6">
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Pending</p>
                            <p className="text-lg font-bold text-amber-500">{engineerTasks.filter(t => t.status === 'PENDING').length}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Running</p>
                            <p className="text-lg font-bold text-blue-500">{engineerTasks.filter(t => t.status === 'RUNNING').length}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Completed</p>
                            <p className="text-lg font-bold text-green-500">{engineerTasks.filter(t => t.status === 'COMPLETED').length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Pending Tasks */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={14} />
                            Pending Tasks
                          </h4>
                          <div className="space-y-3">
                            {engineerTasks.filter(t => t.status === 'PENDING').map(task => (
                              <div key={task.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer group" onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}>
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-bold truncate pr-2">{task.title}</h5>
                                  <Info size={14} className="text-gray-500 group-hover:text-blue-400" />
                                </div>
                                <p className="text-[10px] text-gray-500 line-clamp-1">{task.details}</p>
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-gray-400">{task.taskId}</span>
                                    {(() => {
                                      const assignee = staffList.find(s => s.name.toLowerCase() === task.assignedTo.toLowerCase());
                                      if (assignee?.role === 'TECHNICIAN') {
                                        const officer = staffList.find(s => s.id === assignee.supervisorId);
                                        return (
                                          <div className="flex flex-col mt-1">
                                            <span className="text-[8px] text-blue-400 font-bold">Officer: {officer?.name || 'N/A'}</span>
                                            <span className="text-[8px] text-gray-500">Tech: {assignee.name}</span>
                                          </div>
                                        );
                                      } else if (assignee?.role === 'OFFICER') {
                                        return <span className="text-[8px] text-blue-400 font-bold mt-1">Officer: {assignee.name}</span>;
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <span className="text-[9px] text-red-400 font-bold">Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                            {engineerTasks.filter(t => t.status === 'PENDING').length === 0 && (
                              <p className="text-[10px] text-gray-600 italic">No pending tasks</p>
                            )}
                          </div>
                        </div>

                        {/* Running Tasks */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={14} />
                            Running Tasks
                          </h4>
                          <div className="space-y-3">
                            {engineerTasks.filter(t => t.status === 'RUNNING').map(task => (
                              <div key={task.id} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/20 transition-all cursor-pointer group" onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}>
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-bold truncate pr-2">{task.title}</h5>
                                  <Info size={14} className="text-blue-400" />
                                </div>
                                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mb-2">
                                  <div className="bg-blue-500 h-full" style={{ width: `${task.progress}%` }} />
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-blue-400 font-bold">{task.progress}% Complete</span>
                                    {(() => {
                                      const assignee = staffList.find(s => s.name.toLowerCase() === task.assignedTo.toLowerCase());
                                      if (assignee?.role === 'TECHNICIAN') {
                                        const officer = staffList.find(s => s.id === assignee.supervisorId);
                                        return (
                                          <div className="flex flex-col mt-1">
                                            <span className="text-[8px] text-blue-400 font-bold">Officer: {officer?.name || 'N/A'}</span>
                                            <span className="text-[8px] text-gray-500">Tech: {assignee.name}</span>
                                          </div>
                                        );
                                      } else if (assignee?.role === 'OFFICER') {
                                        return <span className="text-[8px] text-blue-400 font-bold mt-1">Officer: {assignee.name}</span>;
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <span className="text-[9px] text-gray-400">Started: {task.startedAt ? new Date(task.startedAt).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              </div>
                            ))}
                            {engineerTasks.filter(t => t.status === 'RUNNING').length === 0 && (
                              <p className="text-[10px] text-gray-600 italic">No running tasks</p>
                            )}
                          </div>
                        </div>

                        {/* Completed Tasks */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-green-500 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={14} />
                            Completed Tasks
                          </h4>
                          <div className="space-y-3">
                            {engineerTasks.filter(t => t.status === 'COMPLETED').map(task => (
                              <div key={task.id} className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 hover:border-green-500/20 transition-all cursor-pointer group" onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}>
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-bold truncate pr-2">{task.title}</h5>
                                  <CheckCircle size={14} className="text-green-500" />
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-green-400 font-bold">Done</span>
                                    {(() => {
                                      const assignee = staffList.find(s => s.name.toLowerCase() === task.assignedTo.toLowerCase());
                                      if (assignee?.role === 'TECHNICIAN') {
                                        const officer = staffList.find(s => s.id === assignee.supervisorId);
                                        return (
                                          <div className="flex flex-col mt-1">
                                            <span className="text-[8px] text-blue-400 font-bold">Officer: {officer?.name || 'N/A'}</span>
                                            <span className="text-[8px] text-gray-500">Tech: {assignee.name}</span>
                                          </div>
                                        );
                                      } else if (assignee?.role === 'OFFICER') {
                                        return <span className="text-[8px] text-blue-400 font-bold mt-1">Officer: {assignee.name}</span>;
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <span className="text-[9px] text-gray-400">Finished: {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              </div>
                            ))}
                            {engineerTasks.filter(t => t.status === 'COMPLETED').length === 0 && (
                              <p className="text-[10px] text-gray-600 italic">No completed tasks</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}

                {staffList.filter(s => {
                  if (s.role !== 'ENGINEER') return false;
                  if (user.assignedEngineers && user.assignedEngineers.length > 0) {
                    return user.assignedEngineers.includes(s.employeeId);
                  }
                  return true;
                }).length === 0 && (
                  <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <p className="text-gray-500">No Engineers found in your assigned scope.</p>
                  </div>
                )}
              </div>

              {/* General Work Section (HOD Only) */}
              {(user?.role === 'HOD' || user?.role === 'SUPER_ADMIN') && (
                <div className="mt-12">
                  <h2 className="text-xl font-bold mb-6 text-blue-400 flex items-center gap-2">
                    <Wrench size={24} />
                    General Work Monitoring
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tasks.filter(t => t.model === 'General Work').map(task => (
                      <GlassCard key={task.id} className="p-4 border-blue-500/20">
                         <div className="flex justify-between items-start mb-3">
                           <h3 className="font-bold text-white">{task.title}</h3>
                           <span className={cn(
                             "text-[10px] font-bold px-2 py-1 rounded-full",
                             task.status === 'RUNNING' ? "bg-blue-500/20 text-blue-500" :
                             task.status === 'PENDING' ? "bg-amber-500/20 text-amber-500" :
                             "bg-green-500/20 text-green-500"
                           )}>
                             {task.status}
                           </span>
                         </div>
                         <p className="text-xs text-gray-500 line-clamp-2 mb-4">{task.details}</p>
                         <div className="flex items-center justify-between pt-3 border-t border-white/5">
                           <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold">
                               {task.assignedTo[0]}
                             </div>
                             <span className="text-[10px] text-gray-400">{task.assignedTo}</span>
                           </div>
                           <button 
                             onClick={() => { setSelectedTask(task); setIsTaskDetailsModalOpen(true); }}
                             className="text-[10px] text-blue-400 font-bold hover:underline"
                           >
                             View Details
                           </button>
                         </div>
                      </GlassCard>
                    ))}
                    {tasks.filter(t => t.model === 'General Work').length === 0 && (
                      <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                        <p className="text-gray-500 italic">No general work tasks found.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mywork' && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold">Technician Workspace</h1>
              <div className="grid grid-cols-1 gap-6">
                {tasks.filter(t => t.assignedTo.toLowerCase() === user?.name?.toLowerCase()).map(task => (
                  <GlassCard key={task.id} className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{task.title}</h3>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          task.status === 'PENDING' ? "bg-gray-500/20 text-gray-400" :
                          task.status === 'RUNNING' ? "bg-amber-500/20 text-amber-500" :
                          task.status === 'COMPLETED' ? "bg-green-500/20 text-green-500" :
                          task.status === 'HOLD' ? "bg-red-500/20 text-red-500" :
                          "bg-blue-500/20 text-blue-500"
                        )}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{task.details}</p>
                      {task.status === 'HOLD' && task.remarks && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                          <p className="text-[10px] text-red-400 uppercase font-bold mb-1">Hold Remarks:</p>
                          <p className="text-xs text-gray-300 italic">{task.remarks}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>Deadline: {new Date(task.deadline).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle size={14} />
                          <span className="capitalize">{task.urgency.toLowerCase()}</span>
                        </div>
                        {task.status !== 'HOLD' && (
                          <div className="flex items-center gap-1 font-bold text-blue-400">
                            <span>{task.progress}% Complete</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      {task.status === 'COMPLETED' ? (
                        <div className="flex items-center gap-2 text-green-500 font-bold">
                          <CheckCircle2 size={20} />
                          <span>Completed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-blue-400 font-bold italic text-sm">
                          <Info size={16} />
                          <span>View Only Mode</span>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))}
                {tasks.filter(t => t.assignedTo.toLowerCase() === user?.name?.toLowerCase()).length === 0 && (
                   <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                     <p className="text-gray-500">No tasks assigned to you yet.</p>
                   </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8 pb-12">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Department Analytics</h1>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={14} />
                  <span>Last updated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Task Completion Trend */}
                <GlassCard className="h-[450px] flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="text-blue-500" size={20} />
                    <h3 className="text-lg font-bold">Weekly Task Trend</h3>
                  </div>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#94a3b8" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Line 
                          type="monotone" 
                          dataKey="completed" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="pending" 
                          stroke="#3b82f6" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Staff Performance */}
                <GlassCard className="h-[450px] flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <Award className="text-amber-500" size={20} />
                    <h3 className="text-lg font-bold">Top Performing Staff</h3>
                  </div>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          stroke="#94a3b8" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          width={80}
                        />
                        <Tooltip 
                          cursor={{ fill: '#ffffff05' }}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="tasks" radius={[0, 8, 8, 0]}>
                          {performance.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#3b82f680'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Model Distribution */}
                <GlassCard className="h-[450px] flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <AirVent className="text-purple-500" size={20} />
                    <h3 className="text-lg font-bold">Model Distribution</h3>
                  </div>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modelDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {modelDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][index % 7]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend layout="vertical" align="right" verticalAlign="middle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Total Tasks</p>
                    <p className="text-4xl font-black">{filteredTasks.length}</p>
                  </GlassCard>
                  <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Completion Rate</p>
                    <p className="text-4xl font-black text-green-500">
                      {filteredTasks.length > 0 ? Math.round((filteredTasks.filter(t => t.status === 'COMPLETED').length / filteredTasks.length) * 100) : 0}%
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Avg. Progress</p>
                    <p className="text-4xl font-black text-blue-500">
                      {filteredTasks.length > 0 ? Math.round(filteredTasks.reduce((acc, t) => acc + t.progress, 0) / filteredTasks.length) : 0}%
                    </p>
                  </GlassCard>
                  <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Active Staff</p>
                    <p className="text-4xl font-black text-purple-500">
                      {user?.role === 'SUPER_ADMIN' || user?.role === 'HOD' 
                        ? staffList.length 
                        : staffList.filter(s => s.supervisorId === user?.id || s.id === user?.id).length}
                    </p>
                  </GlassCard>
                </div>
              </div>
            </div>
          )}
          {/* Reject Request Modal */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#1a1a1f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <X className="text-red-500" />
                  Reject Task Request
                </h3>
                <button onClick={() => setIsRejectModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-400 text-sm">Please provide a reason for rejecting this technician request. This is mandatory.</p>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rejection Remarks</label>
                  <textarea
                    value={rejectRemarks}
                    onChange={(e) => setRejectRemarks(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[120px]"
                  />
                </div>
              </div>
              <div className="p-6 bg-white/5 flex gap-3">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!rejectRemarks.trim()) {
                      toast.error('Rejection remarks are mandatory');
                      return;
                    }
                    handleRejectRequest(rejectTaskId!, rejectRemarks);
                    setIsRejectModalOpen(false);
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Details Modal */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleRestoreClick}
            className="hidden"
            accept=".json"
          />
          <AnimatePresence>
            {isRestoreConfirmOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full max-w-sm"
                >
                  <GlassCard className="p-8 text-center border-amber-500/30">
                    <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Confirm System Restore</h3>
                    <p className="text-gray-400 text-sm mb-8">
                      Are you sure you want to restore the system from "{pendingRestoreFile?.name}"? 
                      This will replace all current users and tasks.
                    </p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          setIsRestoreConfirmOpen(false);
                          setPendingRestoreFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={executeRestore}
                        className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-bold transition-all"
                      >
                        Restore
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isTaskDetailsModalOpen && selectedTask && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-2xl"
                >
                  <GlassCard className="p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold">Task Details</h2>
                      <button onClick={() => setIsTaskDetailsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Task ID</p>
                          <p className="text-blue-400 font-mono">{selectedTask.taskId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Status</p>
                          <div className="flex flex-col gap-1">
                            <p className={cn(
                              "text-sm font-bold",
                              selectedTask.status === 'HOLD' ? "text-red-400" : 
                              selectedTask.status === 'COMPLETED' ? "text-green-400" : "text-blue-400"
                            )}>
                              {selectedTask.status}
                            </p>
                            {selectedTask.status === 'HOLD' && selectedTask.remarks && (
                              <p className="text-[10px] text-red-400 italic bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                Remarks: {selectedTask.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Assignment Details</p>
                          {selectedTask.workType === 'TEAM' ? (
                            <p className="text-blue-400 font-bold">Team Work ({selectedTask.assignedTechnicians?.length} Technicians)</p>
                          ) : (
                            (() => {
                              const assignee = staffList.find(s => s.name.toLowerCase() === selectedTask.assignedTo.toLowerCase());
                              if (assignee?.role === 'TECHNICIAN') {
                                const officer = staffList.find(s => s.id === assignee.supervisorId);
                                return (
                                  <>
                                    <p className="text-white font-bold">Tech: {assignee.name} ({assignee.employeeId})</p>
                                    <p className="text-[10px] text-blue-400 mt-1">Officer: {officer?.name || 'N/A'}</p>
                                  </>
                                );
                              } else if (assignee?.role === 'OFFICER') {
                                return (
                                  <>
                                    <p className="text-white font-bold">Officer: {assignee.name} ({assignee.employeeId})</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Tech: Not assigned yet</p>
                                  </>
                                );
                              } else if (assignee?.role === 'ENGINEER') {
                                const officer = staffList.find(s => s.supervisorId === assignee.id && s.role === 'OFFICER');
                                return (
                                  <>
                                    <p className="text-white font-bold">Engr: {assignee.name} ({assignee.employeeId})</p>
                                    <p className="text-[10px] text-blue-400 mt-1">Officer: {officer?.name || 'N/A'}</p>
                                  </>
                                );
                              } else {
                                return <p className="text-white font-bold">{selectedTask.assignedTo}</p>;
                              }
                            })()
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Points</p>
                          <p className="text-blue-400 font-bold">{selectedTask.points || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Deadline</p>
                          <p className="text-white">
                            {user?.role === 'ENGINEER' 
                              ? new Date(selectedTask.deadline).toLocaleDateString() 
                              : new Date(selectedTask.deadline).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {selectedTask.workType === 'TEAM' && (
                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-blue-400">Team Progress Monitoring</h3>
                            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                              Total: {selectedTask.totalTeamProgress || 0}%
                            </span>
                          </div>
                          <div className="space-y-3">
                            {selectedTask.assignedTechnicians?.map((tech, idx) => (
                              <div key={tech.employeeId} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-300 font-medium">{tech.name} ({tech.employeeId})</span>
                                  <span className="text-xs text-blue-400">{tech.progress}%</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 transition-all duration-500"
                                      style={{ width: `${tech.progress}%` }}
                                    />
                                  </div>
                                  {user?.role === 'OFFICER' && (
                                    <input 
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={tech.progress}
                                      onChange={(e) => {
                                        const newProgress = parseInt(e.target.value);
                                        const newTechs = [...(selectedTask.assignedTechnicians || [])];
                                        newTechs[idx] = { 
                                          ...newTechs[idx], 
                                          progress: newProgress,
                                          status: newProgress === 100 ? 'COMPLETED' : 'RUNNING',
                                          completedAt: newProgress === 100 ? new Date().toISOString() : undefined
                                        };
                                        handleUpdateTask(selectedTask.id, { 
                                          assignedTechnicians: newTechs,
                                          remarks: `Updated progress for ${tech.name} to ${newProgress}%`
                                        });
                                      }}
                                      className="w-24 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Title</p>
                        <p className="text-lg font-bold text-white">{selectedTask.title}</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Details</p>
                        <p className="text-sm text-gray-300 bg-white/5 p-4 rounded-xl border border-white/10">{selectedTask.details}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Started At</p>
                          <p className="text-white text-sm">{selectedTask.startedAt ? new Date(selectedTask.startedAt).toLocaleString() : 'Not Started'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Completed At</p>
                          <p className="text-white text-sm">{selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleString() : 'In Progress'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Time Taken</p>
                          <p className="text-white text-sm">{calculateDuration(selectedTask.startedAt, selectedTask.completedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-widest">Performance</p>
                          <p className={cn(
                            "text-sm font-bold",
                            isDelayed(selectedTask.deadline, selectedTask.completedAt) ? "text-red-500" : "text-green-500"
                          )}>
                            {isDelayed(selectedTask.deadline, selectedTask.completedAt) ? "Delayed" : "On Time"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Activity Logs</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {selectedTask.logs?.map((log) => (
                            <div key={log.id} className="text-[10px] p-2 rounded-lg bg-white/5 border border-white/5">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-blue-400 font-bold">{log.user}</span>
                                <span className="text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="text-gray-300">{log.action}</p>
                            </div>
                          ))}
                          {(!selectedTask.logs || selectedTask.logs.length === 0) && (
                            <p className="text-xs text-gray-500 italic">No activity logs recorded yet.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Remarks</label>
                        <textarea 
                          value={taskRemarks}
                          onChange={(e) => setTaskRemarks(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-24"
                          placeholder="Add your remarks here..."
                        />
                      </div>

                      {user?.role === 'OFFICER' && selectedTask.status !== 'COMPLETED' && (
                        <div className="pt-4 border-t border-white/10">
                          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Assign to Technician</label>
                          <div className="flex gap-3">
                            <select 
                              value={assignToTech}
                              onChange={(e) => setAssignToTech(e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                              <option value="" className="bg-[#0f0f12]">Select Technician</option>
                              {staffList.filter(s => s.role === 'TECHNICIAN').map(s => (
                                <option key={s.id} value={s.name} className="bg-[#0f0f12]">
                                  {s.name} ({s.employeeId}) {s.supervisorId !== user.id ? '(Other Team)' : ''}
                                </option>
                              ))}
                            </select>
                            <button 
                              onClick={() => {
                                if (!assignToTech) return toast.error('Please select a technician');
                                handleUpdateTask(selectedTask.id, { assignedTo: assignToTech });
                              }}
                              disabled={isLoading || !assignToTech}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold px-6 py-3 rounded-xl transition-all"
                            >
                              Assign
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-4 pt-4">
                        <button 
                          onClick={() => handleUpdateTask(selectedTask.id, { remarks: taskRemarks })}
                          disabled={isLoading}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
                        >
                          Save Remarks
                        </button>
                        {user?.role === 'TECHNICIAN' && selectedTask.status !== 'COMPLETED' && (
                          <button 
                            onClick={() => handleUpdateTask(selectedTask.id, { 
                              status: selectedTask.status === 'PENDING' ? 'RUNNING' : 'COMPLETED',
                              progress: selectedTask.status === 'PENDING' ? 50 : 100,
                              completedAt: selectedTask.status === 'RUNNING' ? new Date().toISOString() : undefined
                            })}
                            disabled={isLoading}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all"
                          >
                            {selectedTask.status === 'PENDING' ? 'Start Task' : 'Complete Task'}
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
    </ThemeContext.Provider>
  );
}
