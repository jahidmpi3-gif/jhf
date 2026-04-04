export type Role = 
  | 'SUPER_ADMIN' 
  | 'HOD' 
  | 'IN_CHARGE' 
  | 'MODEL_MANAGER' 
  | 'ENGINEER' 
  | 'OFFICER' 
  | 'TECHNICIAN';

export type Urgency = 'REGULAR' | 'URGENT' | 'MOST_URGENT';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'DELAYED' | 'HOLD' | 'REQUESTED' | 'REJECTED';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
  department?: string;
  avatar?: string;
  supervisorId?: string;
  assignedEngineers?: string[]; // Array of Engineer employeeIds
  phone?: string;
  designation?: string;
  email?: string;
  theme?: string;
  customBackground?: string;
  status?: 'FREE' | 'WORKING';
}

export interface TaskLog {
  id: string;
  action: string;
  timestamp: string;
  user: string;
}

export interface AssignedTechnician {
  employeeId: string;
  name: string;
  progress: number;
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  taskId: string;
  title: string;
  model: string;
  details: string;
  urgency: Urgency;
  createdBy: string;
  assignedBy: string;
  assignedTo: string; // Officer or Technician (for Single Work)
  workType?: 'SINGLE' | 'TEAM';
  assignedTechnicians?: AssignedTechnician[];
  status: TaskStatus;
  progress: number;
  points?: number; // Performance points
  quality?: number; // 1-5 scale
  deadline: string;
  remarks?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  logs: TaskLog[];
  requestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECOMMENDED';
  requestRemarks?: string;
  customStartTime?: string;
  estimatedDuration?: string;
  actualCompletionTime?: string;
  taskTakenTime?: string;
  remainingTime?: string;
  overTime?: string;
  totalTeamProgress?: number;
  pointAdded?: boolean;
}

export interface Attendance {
  id: string;
  technicianId: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'SHORT_LEAVE';
  date: string;
}

export interface PointTransaction {
  id: string;
  taskId: string;
  officerId: string;
  engineerId: string;
  pointValue: number;
  taskPriority: Urgency;
  completedAt: string;
}

export interface TechnicianPerformance {
  id: string;
  technicianId: string;
  taskId: string;
  date: string;
  totalWorkMinutes: number;
  remainingMinutes: number;
  completionSpeedScore: number;
  attendanceScore: number;
  efficiencyScore: number;
  finalDailyScore: number;
}

export interface AssignmentRequest {
  id: string;
  taskId: string;
  requestingOfficerId: string;
  targetTechnicianId: string;
  supervisorId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  senderId?: string;
  taskId?: string;
  type?: string;
  message: string;
  read: boolean;
  timestamp: string;
}
