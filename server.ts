import express from "express";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import XLSX from "xlsx";
import multer from "multer";
import type { Role, User, Task, Attendance, TaskLog, TaskStatus } from './types.js';

const upload = multer({ dest: 'uploads/' });

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "enterprise-secret-key";

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --- Request Logging ---
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.originalUrl.startsWith('/api')) {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
      }
    });
    next();
  });

  // --- Data Persistence ---
  const DATA_FILE = path.join(process.cwd(), "data.json");

  async function loadData() {
    try {
      console.log(`Attempting to load data from: ${DATA_FILE}`);
      const content = await fs.readFile(DATA_FILE, "utf-8");
      return JSON.parse(content);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log("No data.json found, using defaults.");
      } else {
        console.error(`Error reading data.json at ${DATA_FILE}:`, err.message);
      }
      return { users: [], tasks: [], attendanceRecords: [], notifications: [], pointTransactions: [], technicianPerformance: [], assignmentRequests: [] };
    }
  }

  async function saveData(_data?: any) {
    try {
      const dataToSave = {
        users,
        tasks,
        attendanceRecords,
        notifications,
        pointTransactions,
        technicianPerformance,
        assignmentRequests
      };
      await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (err) {
      console.error("Error saving data:", err);
    }
  }

  const initialData = await loadData();
  if (!initialData.notifications) initialData.notifications = [];
  if (!initialData.pointTransactions) initialData.pointTransactions = [];
  if (!initialData.technicianPerformance) initialData.technicianPerformance = [];
  if (!initialData.assignmentRequests) initialData.assignmentRequests = [];
  
  // Initialize users with defaults if empty or missing default admins
  const defaultUsers = [
    { employeeId: "ADMIN001", name: "Super Admin", password: "admin123", role: "SUPER_ADMIN" },
    { employeeId: "jhfboss", name: "JHF Boss", password: "3624", role: "SUPER_ADMIN" },
    { employeeId: "jhfadmin@jhf.com", name: "JHF Admin", password: "3624", role: "SUPER_ADMIN" },
    { employeeId: "54589", name: "Md. Shofikul Islam", password: "3624", role: "IN_CHARGE", designation: "IN CHARGE", department: "Chemical & Polymer" },
    { employeeId: "58175", name: "Mohammad Alik Pramanik", password: "3624", role: "OFFICER", designation: "OFFICER" },
    { employeeId: "48566", name: "Mahmudul Hasan", password: "3624", role: "TECHNICIAN", designation: "TECHNICIAN" },
    { employeeId: "63195", name: "Bijoy Kumar Haolader", password: "3624", role: "TECHNICIAN", designation: "TECHNICIAN" }
  ];

  if (!initialData.users) initialData.users = [];
  
  let updated = false;
  for (const user of defaultUsers) {
    if (!initialData.users.find((u: any) => u.employeeId.toLowerCase() === user.employeeId.toLowerCase())) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      initialData.users.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        employeeId: user.employeeId,
        name: user.name,
        password: hashedPassword,
        role: user.role,
        designation: (user as any).designation || "",
        department: (user as any).department || "",
        supervisorId: "",
        assignedEngineers: []
      });
      updated = true;
    }
  }

  if (updated) {
    await saveData();
  }

  const users = initialData.users || [];
  const tasks = initialData.tasks || [];
  const attendanceRecords = initialData.attendanceRecords || initialData.assignments || [];
  const notifications = initialData.notifications || [];
  const pointTransactions = initialData.pointTransactions || [];
  const technicianPerformance = initialData.technicianPerformance || [];
  const assignmentRequests = initialData.assignmentRequests || [];

  async function backfillPoints() {
    let count = 0;
    tasks.forEach((task: any) => {
      if (task.status === 'COMPLETED' && !task.pointAdded) {
        let assignedOfficer = null;
        if (task.createdBy && users.find(u => u.employeeId === task.createdBy)?.role === 'ENGINEER') {
          assignedOfficer = users.find(u => (u.name === task.assignedTo || u.employeeId === task.assignedTo) && u.role === 'OFFICER');
        } 
        if (!assignedOfficer) {
          assignedOfficer = users.find(u => u.employeeId === task.assignedBy && u.role === 'OFFICER');
        }

        if (assignedOfficer) {
          const exists = pointTransactions.some((pt: any) => pt.taskId === task.id);
          if (!exists) {
            pointTransactions.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              taskId: task.id,
              officerId: assignedOfficer.id,
              engineerId: task.createdBy,
              pointValue: task.points || 1,
              taskPriority: task.urgency,
              completedAt: task.completedAt || new Date().toISOString()
            });
            count++;
          }
          task.pointAdded = true;
        }
      }
    });
    if (count > 0) {
      await saveData({ users, tasks, attendanceRecords, notifications, pointTransactions, technicianPerformance, assignmentRequests });
      console.log(`Backfilled ${count} task points.`);
    }
    return count;
  }

  await backfillPoints();

  // --- Auth Middleware ---
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    
    if (!token) {
      console.log(`Auth failed: No token provided for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log(`Auth success: User ${decoded.name} (${decoded.role}) accessed ${req.method} ${req.originalUrl}`);
      req.user = decoded;
      next();
    } catch (err) {
      console.log(`Auth failed: Invalid token for ${req.method} ${req.originalUrl}. Error: ${err.message}`);
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- API Routes ---
  app.get("/api/debug/users", (req, res) => {
    res.json(users.map(u => ({ employeeId: u.employeeId, passwordHash: u.password })));
  });

  app.get("/api/test", (req, res) => {
    res.json({ status: "ok", usersCount: users.length });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { employeeId, password } = req.body;
    const trimmedId = (employeeId || "").toString().trim();
    console.log(`Login attempt for: ${trimmedId}`);
    const user = users.find(u => u.employeeId.toLowerCase() === trimmedId.toLowerCase());
    if (user) {
      console.log(`User found: ${user.name}`);
      const isMatch = await bcrypt.compare(password, user.password);
      console.log(`Password match: ${isMatch}`);
      if (isMatch) {
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name, employeeId: user.employeeId }, JWT_SECRET);
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ token, user: userWithoutPassword });
      }
    } else {
      console.log(`User not found: ${trimmedId}`);
    }
    res.status(401).json({ error: "Invalid credentials" });
  });

  app.post("/api/auth/change-password", authenticate, async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid current password" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await saveData({ users, tasks, attendanceRecords });
    res.json({ message: "Password changed successfully" });
  });

  app.post("/api/users/:id/reset-password", authenticate, async (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { id } = req.params;
    const { newPassword } = req.body;
    const user = users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await saveData({ users, tasks, attendanceRecords });
    res.json({ message: "Password reset successfully" });
  });

  app.get("/api/users", authenticate, (req: Request, res: Response) => {
    const allowedRoles = ['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER', 'OFFICER'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(users.map(({ password, ...u }) => u));
  });

  app.post("/api/users", authenticate, async (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'HOD') {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { employeeId, name, role, password, avatar, supervisorId, phone, designation, email, department, assignedEngineers } = req.body;
    
    let formattedPhone = phone;
    if (formattedPhone && !formattedPhone.startsWith('0') && /^\d+$/.test(formattedPhone)) {
      formattedPhone = '0' + formattedPhone;
    }

    const newUser = {
      id: Date.now().toString(),
      employeeId,
      name,
      role,
      avatar,
      supervisorId,
      phone: formattedPhone,
      designation,
      email,
      department: department || "RAC R&I",
      assignedEngineers: assignedEngineers || [],
      password: await bcrypt.hash(password || "123456", 10)
    };
    users.push(newUser);
    await saveData({ users, tasks, attendanceRecords });
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  });

  app.put("/api/users/:id", authenticate, async (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'HOD') {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { id } = req.params;
    const { name, role, employeeId, password, avatar, supervisorId, phone, designation, email, department, assignedEngineers } = req.body;
    
    let formattedPhone = phone;
    if (formattedPhone && !formattedPhone.startsWith('0') && /^\d+$/.test(formattedPhone)) {
      formattedPhone = '0' + formattedPhone;
    }

    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      const updatedUser = { ...users[index], name, role, employeeId, avatar, supervisorId, phone: formattedPhone, designation, email, department: department || users[index].department || "RAC R&I", assignedEngineers: assignedEngineers || [] };
      if (password) {
        updatedUser.password = await bcrypt.hash(password, 10);
      }
      users[index] = updatedUser;
      await saveData({ users, tasks, attendanceRecords });
      const { password: _, ...userWithoutPassword } = users[index];
      res.json(userWithoutPassword);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.delete("/api/users/:id", authenticate, async (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'HOD') {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { id } = req.params;
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users.splice(index, 1);
      await saveData({ users, tasks, attendanceRecords });
      res.status(204).send();
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  // --- Notifications ---
  app.get("/api/notifications", authenticate, (req: Request, res: Response) => {
    const user = (req as any).user;
    const userNotifications = (notifications || []).filter((n: any) => n.userId === user.id);
    res.json(userNotifications);
  });

  app.put("/api/notifications/:id/read", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const index = (notifications || []).findIndex((n: any) => n.id === req.params.id && n.userId === user.id);
    if (index !== -1) {
      notifications[index].read = true;
      await saveData();
    }
    res.json({ success: true });
  });

  app.delete("/api/notifications", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const newNotifications = (notifications || []).filter((n: any) => n.userId !== user.id);
    notifications.length = 0;
    notifications.push(...newNotifications);
    await saveData({ users, tasks, attendanceRecords, notifications });
    res.json({ success: true });
  });

  app.get("/api/points", authenticate, (req: Request, res: Response) => {
    res.json(pointTransactions);
  });

  app.get("/api/performance", authenticate, (req: Request, res: Response) => {
    res.json(technicianPerformance);
  });

  app.get("/api/assignment-requests", authenticate, (req: Request, res: Response) => {
    const user = (req as any).user;
    // Supervisors see requests for their technicians
    // Officers see requests they made
    const filtered = assignmentRequests.filter((r: any) => 
      r.supervisorId === user.id || r.requestingOfficerId === user.id
    );
    res.json(filtered);
  });

  app.post("/api/assignment-requests", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { taskId, targetTechnicianId, supervisorId, reason } = req.body;
    
    const newRequest = {
      id: Date.now().toString(),
      taskId,
      requestingOfficerId: user.id,
      targetTechnicianId,
      supervisorId,
      status: 'PENDING',
      reason,
      createdAt: new Date().toISOString()
    };
    
    assignmentRequests.push(newRequest);
    
    // Notify supervisor
    notifications.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      userId: supervisorId,
      senderId: user.id,
      type: 'ASSIGNMENT_REQUEST',
      message: `Officer ${user.name} requested a technician for a task.`,
      read: false,
      timestamp: new Date().toISOString()
    });

    await saveData({ users, tasks, attendanceRecords, notifications, pointTransactions, technicianPerformance, assignmentRequests });
    res.status(201).json(newRequest);
  });

  app.get("/api/tasks", authenticate, (req: Request, res: Response) => {
    const { month, year, all } = req.query;
    
    if (all === 'true') {
      return res.json(tasks);
    }

    const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

    const filteredTasks = tasks.filter((t: any) => {
      const taskDate = new Date(t.createdAt);
      return taskDate.getMonth() + 1 === currentMonth && taskDate.getFullYear() === currentYear;
    });

    res.json(filteredTasks);
  });

  app.post("/api/system/process-employees", authenticate, async (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const filePath = path.join(__dirname, "employee data.xlsx");
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`Processing ${data.length} employees from Excel. First row keys:`, data.length > 0 ? Object.keys(data[0]) : 'None');

      let createdCount = 0;
      let updatedCount = 0;

      for (const row of data as any[]) {
        // Try multiple common column names for ID and Name
        const employeeId = (row.ID || row["Employee ID"] || row.employeeId || row["HRMS ID"] || "").toString().trim();
        const name = (row.Name || row["Employee Name"] || row.name || row["Name of Employee"] || "Unknown").toString().trim();
        const rawRole = (row.Role || row.role || row.Designation || row.designation || "TECHNICIAN").toString().trim().toUpperCase();
        
        // Extract additional fields
        let phone = (row.Phone || row["Phone Number"] || row.phone || row.Mobile || row.mobile || row["Mobile No"] || row["Mobile Number"] || row.Contact || row["Contact No"] || row["Phone No"] || row.Cell || row["Cell No"] || row["Cell Number"] || "").toString().trim();
        
        // Add leading zero if missing (common Excel issue)
        if (phone && !phone.startsWith('0') && /^\d+$/.test(phone)) {
          phone = '0' + phone;
        }

        const designation = (row.Designation || row.designation || row.Role || row.role || "").toString().trim();
        const email = (row.Email || row["Email Address"] || row.email || row["Email ID"] || row["E-mail"] || "").toString().trim();
        const department = (row.Department || row.department || row.Dept || row.dept || "RAC R&I").toString().trim();

        // Map common role names to system roles
        let role: string = "TECHNICIAN";
        const upperRole = rawRole.toUpperCase();
        
        if (upperRole.includes('SUPER ADMIN') || upperRole === 'ADMIN') role = 'SUPER_ADMIN';
        else if (upperRole.includes('HOD')) role = 'HOD';
        else if (upperRole.includes('INCHARGE') || upperRole.includes('IN-CHARGE') || upperRole === 'IN_CHARGE') role = 'IN_CHARGE';
        else if (upperRole.includes('MODEL MANAGER') || upperRole.includes('MODEL-MANAGER')) role = 'MODEL_MANAGER';
        else if (upperRole.includes('ENGINEER')) role = 'ENGINEER';
        else if (upperRole.includes('OFFICER')) role = 'OFFICER';
        else if (upperRole.includes('TECHNICIAN')) role = 'TECHNICIAN';
        else if (upperRole.includes('MANAGER')) role = 'MODEL_MANAGER';
        else if (upperRole.includes('SUPERVISOR')) role = 'IN_CHARGE';
        else {
          // Fallback mapping based on common titles if Role column is actually a Designation column
          if (upperRole.includes('MANAGER')) role = 'MODEL_MANAGER';
          else if (upperRole.includes('HOD')) role = 'HOD';
          else if (upperRole.includes('ENGINEER')) role = 'ENGINEER';
          else if (upperRole.includes('OFFICER')) role = 'OFFICER';
          else role = 'TECHNICIAN';
        }

        if (!employeeId) continue;

        const existingUser = users.find(u => u.employeeId.toString().toLowerCase() === employeeId.toLowerCase());
        const hashedPassword = await bcrypt.hash(employeeId, 10);

        if (existingUser) {
          // Update password to match ID as requested
          existingUser.password = hashedPassword;
          // Also update other fields
          existingUser.name = name;
          existingUser.role = role as any;
          existingUser.phone = phone;
          existingUser.designation = designation;
          existingUser.email = email;
          existingUser.department = department;
          updatedCount++;
        } else {
          users.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            employeeId,
            name,
            role: role as any,
            password: hashedPassword,
            supervisorId: "",
            assignedEngineers: [],
            phone,
            designation,
            email,
            department
          });
          createdCount++;
        }
      }

      await saveData({ users, tasks, attendanceRecords });
      res.json({ message: "Employee data processed successfully", createdCount, updatedCount });
    } catch (err) {
      console.error("Error processing employee data:", err);
      res.status(500).json({ error: "Failed to process employee data: " + err.message });
    }
  });

  app.post("/api/system/recalculate-points", authenticate, async (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Forbidden" });
    }
    const count = await backfillPoints();
    res.json({ message: `Recalculated points. Backfilled ${count} tasks.`, count });
  });

  app.get("/api/system/backup", authenticate, (req: Request, res: Response) => {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: "Forbidden" });
    }
    const backupData = {
      users: users, // Include everything for full restore
      tasks: tasks,
      attendanceRecords: attendanceRecords,
      timestamp: new Date().toISOString()
    };
    res.json(backupData);
  });

  app.post("/api/system/restore", authenticate, async (req: Request, res: Response) => {
    console.log(`Restore request received from user: ${req.user.name} (${req.user.role})`);
    if (req.user.role !== 'SUPER_ADMIN') {
      console.warn(`Unauthorized restore attempt by user: ${req.user.name}`);
      return res.status(403).json({ error: "Forbidden" });
    }
    const restoredUsers = req.body.users;
    const restoredTasks = req.body.tasks;
    const restoredAttendance = req.body.attendanceRecords;
    
    console.log(`Restoring ${restoredUsers?.length || 0} users, ${restoredTasks?.length || 0} tasks, and ${restoredAttendance?.length || 0} attendance records`);

    if (!Array.isArray(restoredUsers)) {
      console.error('Restore failed: users array missing or invalid');
      return res.status(400).json({ error: "Invalid backup format: users array missing" });
    }

    try {
      // Clear and replace
      users.length = 0;
      users.push(...restoredUsers);
      
      if (Array.isArray(restoredTasks)) {
        tasks.length = 0;
        tasks.push(...restoredTasks);
      } else {
        tasks.length = 0;
      }

      if (Array.isArray(restoredAttendance)) {
        attendanceRecords.length = 0;
        attendanceRecords.push(...restoredAttendance);
      } else {
        attendanceRecords.length = 0;
      }

      await saveData({ users, tasks, attendanceRecords });
      console.log('System restored successfully');
      res.json({ message: "System restored successfully", userCount: users.length, taskCount: tasks.length, attendanceCount: attendanceRecords.length });
    } catch (err) {
      console.error('Error during system restore:', err);
      res.status(500).json({ error: "Internal server error during restore" });
    }
  });

  app.post("/api/tasks", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    
    // Task Creation Restriction (STRICT RULE)
    const allowedCreators = ['SUPER_ADMIN', 'HOD', 'IN_CHARGE', 'MODEL_MANAGER', 'ENGINEER'];
    if (!allowedCreators.includes(user.role) && !(user.role === 'OFFICER' && user.employeeId === '42949')) {
      return res.status(403).json({ error: "Access Denied: Your role is not authorized to create tasks." });
    }

    // Strict Assignment Rule for Engineers
    let assignedToName = req.body.assignedTo;
    let workType = req.body.workType;

    if (user.role === 'ENGINEER') {
      workType = 'SINGLE'; // Engineer only creates single tasks
      if (!assignedToName) {
        // Try to auto-assign to the Officer who has this Engineer
        const myOfficer = users.find(u => u.role === 'OFFICER' && (u.assignedEngineers || []).some(id => id.toString().trim() === user.employeeId));
        if (myOfficer) {
          assignedToName = myOfficer.name;
        }
      }
    }

    if (user.role === 'ENGINEER') {
      if (!assignedToName) {
        return res.status(400).json({ error: "Task must be assigned to an Officer. Please ensure you are mapped to an Officer." });
      }
      const targetUser = users.find(u => u.name === assignedToName || u.employeeId === assignedToName);
      if (!targetUser || targetUser.role !== 'OFFICER') {
        return res.status(403).json({ error: "Access Denied: Engineers can only assign tasks to Officers." });
      }
      if (!(targetUser.assignedEngineers || []).includes(user.employeeId)) {
        return res.status(403).json({ error: "Access Denied: You are not authorized to assign tasks to this Officer. Please contact your HOD/Admin to be assigned to this Officer." });
      }
    }

    // Strict Assignment Rule for Officers
    if (user.role === 'OFFICER') {
      if (!assignedToName && req.body.workType !== 'TEAM') {
        return res.status(400).json({ error: "Task must be assigned to a Technician." });
      }
      if (assignedToName) {
        const targetUser = users.find(u => u.name === assignedToName || u.employeeId === assignedToName);
        if (!targetUser || targetUser.role !== 'TECHNICIAN') {
          return res.status(403).json({ error: "Access Denied: Officers can only assign tasks to Technicians." });
        }
      }
    }

    const { urgency, points, assignedTechnicians } = req.body;
    
    // Point Validation
    if (urgency === 'REGULAR' && points > 1) {
      return res.status(400).json({ error: "Regular work cannot exceed 1 point." });
    }
    if (urgency === 'URGENT' && points > 2) {
      return res.status(400).json({ error: "Urgent work cannot exceed 2 points." });
    }
    if (urgency === 'MOST_URGENT') {
      if (user.role !== 'ENGINEER' && user.role !== 'SUPER_ADMIN' && user.role !== 'HOD') {
        return res.status(403).json({ error: "Only Engineers or higher can assign Most Urgent tasks." });
      }
      if (points > 3) {
        return res.status(400).json({ error: "Most Urgent work cannot exceed 3 points." });
      }
    }

    const targetUser = users.find(u => u.name === assignedToName || u.employeeId === assignedToName);

    let status: TaskStatus = "PENDING";
    let requestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined = undefined;

    if (workType === 'TEAM') {
      if (!assignedTechnicians || assignedTechnicians.length < 2) {
        return res.status(400).json({ error: "Team work requires at least 2 technicians." });
      }
      if (user.role === 'OFFICER' || user.role === 'SUPER_ADMIN') {
        status = "RUNNING"; // Team tasks start instantly when assigned by Officer
      }
    } else if (user.role === 'OFFICER' && targetUser && targetUser.role === 'TECHNICIAN') {
      // Check if technician is in officer's team
      if (targetUser.supervisorId !== user.id) {
        status = "REQUESTED";
        requestStatus = "PENDING";
      } else {
        status = "RUNNING";
      }
    } else if (targetUser && targetUser.role === 'TECHNICIAN' && user.role !== 'ENGINEER') {
      status = "RUNNING";
    }

    const newTask: Task = {
      ...req.body,
      assignedTo: assignedToName,
      id: Date.now().toString(),
      taskId: `${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${new Date().getHours()}${new Date().getMinutes()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      createdBy: user.employeeId,
      assignedBy: user.employeeId,
      status: status,
      requestStatus: requestStatus,
      progress: req.body.progress || 0,
      points: req.body.points || 10,
      customStartTime: req.body.customStartTime || '',
      estimatedDuration: req.body.estimatedDuration || '',
      workType: workType || 'SINGLE',
      assignedTechnicians: workType === 'TEAM' ? assignedTechnicians.map((t: any) => ({
        ...t,
        progress: 0,
        status: 'RUNNING',
        startedAt: new Date().toISOString()
      })) : undefined,
      logs: [{
        id: Date.now().toString(),
        action: workType === 'TEAM' ? "Team Task Created & Started" : (status === "REQUESTED" ? "Task Requested (Cross-Team)" : "Task Created"),
        timestamp: new Date().toISOString(),
        user: user.name
      }]
    };

    if (status === "RUNNING") {
      newTask.startedAt = req.body.customStartTime || new Date().toISOString();
      if (workType !== 'TEAM') {
        newTask.logs.push({
          id: (Date.now() + 1).toString(),
          action: `Task assigned to ${targetUser?.name} - Started`,
          timestamp: new Date().toISOString(),
          user: "System"
        });
      }
    }

    tasks.push(newTask);
    
    // Update Technician Status to WORKING
    if (status === "RUNNING") {
      if (workType === 'TEAM' && Array.isArray(assignedTechnicians)) {
        assignedTechnicians.forEach((at: any) => {
          const tech = users.find(u => u.employeeId === at.employeeId);
          if (tech) tech.status = 'WORKING';
        });
      } else if (targetUser && targetUser.role === 'TECHNICIAN') {
        targetUser.status = 'WORKING';
      }
    }

    // Add notification for the assignee
    if (assignedToName) {
      const targetUser = users.find(u => u.name === assignedToName || u.employeeId === assignedToName);
      if (targetUser) {
        notifications.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          userId: targetUser.id,
          senderId: user.id,
          taskId: newTask.id,
          type: 'TASK_ASSIGNED',
          message: `${user.role} ${user.name} assigned you a task: ${req.body.title}`,
          read: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Add notification for team members
    if (workType === 'TEAM' && Array.isArray(assignedTechnicians)) {
      assignedTechnicians.forEach((at: any) => {
        const targetUser = users.find(u => u.employeeId === at.employeeId);
        if (targetUser) {
          notifications.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            userId: targetUser.id,
            senderId: user.id,
            taskId: newTask.id,
            type: 'TASK_ASSIGNED',
            message: `${user.role} ${user.name} assigned you a team task: ${req.body.title}`,
            read: false,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    await saveData({ users, tasks, attendanceRecords, notifications, pointTransactions, technicianPerformance, assignmentRequests });
    res.status(201).json(newTask);
  });

  app.post("/api/tasks/:id/approve", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    const taskIndex = tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) return res.status(404).json({ error: "Task not found" });
    const task = tasks[taskIndex];

    const targetTechnician = users.find(u => u.employeeId === task.assignedTo || u.name === task.assignedTo);
    const isTeamMemberSupervisor = task.workType === 'TEAM' && task.assignedTechnicians?.some((at: any) => {
      const tech = users.find(u => u.employeeId === at.employeeId);
      return tech && tech.supervisorId === user.id;
    });

    if ((!targetTechnician || targetTechnician.supervisorId !== user.id) && !isTeamMemberSupervisor) {
      return res.status(403).json({ error: "Only the technician's supervisor can approve this request" });
    }

    task.status = "RUNNING";
    task.requestStatus = "APPROVED";
    task.startedAt = new Date().toISOString();
    
    if (task.workType === 'TEAM' && task.assignedTechnicians) {
      task.assignedTechnicians = task.assignedTechnicians.map((at: any) => ({
        ...at,
        status: 'RUNNING',
        startedAt: new Date().toISOString()
      }));
    }

    task.logs.push({
      id: Date.now().toString(),
      action: `Request Approved by Supervisor ${user.name}`,
      timestamp: new Date().toISOString(),
      user: user.name
    });

    // Notify requester
    const requester = users.find(u => u.employeeId === task.assignedBy);
    if (requester) {
      notifications.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        userId: requester.id,
        message: `Your request for task "${task.title}" has been APPROVED by ${user.name}`,
        read: false,
        timestamp: new Date().toISOString()
      });
    }

    await saveData({ users, tasks, attendanceRecords, notifications });
    res.json(task);
  });

  app.post("/api/tasks/:id/reject", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { remarks } = req.body;

    if (!remarks) return res.status(400).json({ error: "Reject remarks are required" });

    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return res.status(404).json({ error: "Task not found" });
    const task = tasks[taskIndex];

    const targetTechnician = users.find(u => u.employeeId === task.assignedTo || u.name === task.assignedTo);
    const isTeamMemberSupervisor = task.workType === 'TEAM' && task.assignedTechnicians?.some((at: any) => {
      const tech = users.find(u => u.employeeId === at.employeeId);
      return tech && tech.supervisorId === user.id;
    });

    if ((!targetTechnician || targetTechnician.supervisorId !== user.id) && !isTeamMemberSupervisor) {
      return res.status(403).json({ error: "Only the technician's supervisor can reject this request" });
    }

    task.status = "REJECTED";
    task.requestStatus = "REJECTED";
    task.requestRemarks = remarks;
    task.logs.push({
      id: Date.now().toString(),
      action: `Request Rejected by Supervisor ${user.name}: ${remarks}`,
      timestamp: new Date().toISOString(),
      user: user.name
    });

    // Notify requester
    const requester = users.find(u => u.employeeId === task.assignedBy);
    if (requester) {
      notifications.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        userId: requester.id,
        message: `Your request for task "${task.title}" has been REJECTED by ${user.name}. Reason: ${remarks}`,
        read: false,
        timestamp: new Date().toISOString()
      });
    }

    await saveData({ users, tasks, attendanceRecords, notifications });
    res.json(task);
  });

  app.post("/api/user/theme", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { theme, customBackground, removeBg } = req.body;
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex === -1) return res.status(404).json({ error: "User not found" });

    if (theme) users[userIndex].theme = theme;
    if (customBackground) users[userIndex].customBackground = customBackground;
    if (removeBg) users[userIndex].customBackground = undefined;

    await saveData({ users, tasks, attendanceRecords });
    res.json(users[userIndex]);
  });

  app.get("/api/attendance", authenticate, async (req: Request, res: Response) => {
    const today = new Date().toISOString().split('T')[0];
    const technicians = users.filter(u => u.role === 'TECHNICIAN');
    
    let updated = false;
    const todayRecords = technicians.map(tech => {
      const existingRecord = attendanceRecords.find(r => r.technicianId === tech.employeeId && r.date === today);
      if (existingRecord) {
        return existingRecord;
      } else {
        const newRecord = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          technicianId: tech.employeeId,
          status: 'PRESENT',
          date: today
        };
        attendanceRecords.push(newRecord);
        updated = true;
        return newRecord;
      }
    });
    
    if (updated) {
      await saveData({ users, tasks, attendanceRecords });
    }
    
    res.json(todayRecords);
  });

  app.post("/api/attendance", authenticate, async (req: Request, res: Response) => {
    const { technicianId, status } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const index = attendanceRecords.findIndex(r => r.technicianId === technicianId && r.date === today);
    if (index !== -1) {
      attendanceRecords[index].status = status;
    } else {
      attendanceRecords.push({ id: Date.now().toString(), technicianId, status, date: today });
    }
    await saveData({ users, tasks, attendanceRecords });
    res.json({ success: true });
  });

  app.put("/api/tasks/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
    const { id } = req.params;
    const index = tasks.findIndex(t => t.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    const oldTask = tasks[index];

    // Role-based authorization
    if (user.role === 'TECHNICIAN') {
      // Technicians can only update tasks assigned to them
      if (oldTask.assignedTo !== user.name && oldTask.assignedTo !== user.employeeId) {
        return res.status(403).json({ error: "Access Denied: You can only update tasks assigned to you." });
      }
      // Technicians can only update specific fields
      const allowedFields = ['status', 'progress', 'remarks', 'logs', 'startedAt', 'completedAt'];
      const updates = req.body;
      const requestedFields = Object.keys(updates);
      const isAllowed = requestedFields.every(field => allowedFields.includes(field));
      
      if (!isAllowed) {
        return res.status(403).json({ error: "Access Denied: Technicians can only update status, progress, remarks, logs, startedAt, and completedAt." });
      }
    } else if (user.role === 'ENGINEER') {
      // Strict Assignment Rule for Engineers on Update
      const assignedToName = req.body.assignedTo;
      if (assignedToName && assignedToName !== oldTask.assignedTo) {
        const targetUser = users.find(u => u.name === assignedToName || u.employeeId === assignedToName);
        if (!targetUser || targetUser.role !== 'OFFICER') {
          return res.status(403).json({ error: "Access Denied: Engineers can only assign tasks to Officers." });
        }
        // Ensure the Engineer is authorized for this Officer
        if (!(targetUser.assignedEngineers || []).includes(user.employeeId)) {
          return res.status(403).json({ error: "Access Denied: You are not authorized to assign tasks to this Officer." });
        }
      }
      
      // Engineers shouldn't be able to update points or quality unless they created the task
      if (req.body.points !== undefined || req.body.quality !== undefined) {
        if (oldTask.createdBy !== user.employeeId && user.role !== 'SUPER_ADMIN' && user.role !== 'HOD') {
          return res.status(403).json({ error: "Access Denied: Only the creator or admin can update points and quality." });
        }
      }
    } else if (user.role === 'OFFICER') {
      // Officers can only assign tasks to Technicians
      const assignedToName = req.body.assignedTo;
      if (assignedToName && assignedToName !== oldTask.assignedTo) {
        const targetUser = users.find(u => u.name === assignedToName || u.employeeId === assignedToName);
        if (!targetUser || targetUser.role !== 'TECHNICIAN') {
          return res.status(403).json({ error: "Access Denied: Officers can only assign tasks to Technicians." });
        }
      }
    }

    const updatedData = { ...req.body };

    // Mandatory remarks for every update (except when assigning a task or editing task details)
    if (!updatedData.remarks && user.role !== 'SUPER_ADMIN' && !updatedData.assignedTo && !updatedData.title && !updatedData.assignedTechnicians) {
      return res.status(400).json({ error: "Remarks are mandatory for every update" });
    }
      
    // Handle Team Work Assignment
    if (updatedData.workType === 'TEAM' && updatedData.assignedTechnicians) {
      // Check if any technician is not in my team
      const hasOtherTeamTech = updatedData.assignedTechnicians.some((at: any) => {
        const tech = users.find(u => u.employeeId === at.employeeId);
        return tech && tech.supervisorId !== user.id;
      });

      if (hasOtherTeamTech && user.role === 'OFFICER') {
        updatedData.status = 'REQUESTED';
        updatedData.requestStatus = 'PENDING';
      } else {
        updatedData.status = 'RUNNING';
        updatedData.startedAt = new Date().toISOString();
      }

      updatedData.assignedBy = user.employeeId;
      updatedData.assignedTechnicians = updatedData.assignedTechnicians.map((t: any) => ({
        ...t,
        progress: t.progress || 0,
        status: t.status || (updatedData.status === 'REQUESTED' ? 'PENDING' : 'RUNNING'),
        startedAt: t.startedAt || (updatedData.status === 'REQUESTED' ? undefined : new Date().toISOString())
      }));
      
      if (!updatedData.logs) updatedData.logs = [...(oldTask.logs || [])];
      updatedData.logs.push({
        id: Date.now().toString(),
        action: updatedData.status === 'REQUESTED' ? `Team task requested (${updatedData.assignedTechnicians.length} technicians)` : `Task assigned to Team (${updatedData.assignedTechnicians.length} technicians) - Started`,
        timestamp: new Date().toISOString(),
        user: user.name
      });

      // Notify supervisors if requested
      if (updatedData.status === 'REQUESTED') {
        const supervisorsToNotify = new Set();
        updatedData.assignedTechnicians.forEach((at: any) => {
          const tech = users.find(u => u.employeeId === at.employeeId);
          if (tech && tech.supervisorId && tech.supervisorId !== user.id) {
            supervisorsToNotify.add(tech.supervisorId);
          }
        });
        supervisorsToNotify.forEach(supId => {
          notifications.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            userId: supId,
            message: `Officer ${user.name} requested your technician for a team task: ${oldTask.title}`,
            read: false,
            timestamp: new Date().toISOString()
          });
        });
      }
    }

    // Auto-start system: If assigned to a technician, status becomes RUNNING
    if (updatedData.assignedTo && updatedData.assignedTo !== oldTask.assignedTo && updatedData.workType !== 'TEAM') {
      const assignedUser = users.find(u => u.employeeId === updatedData.assignedTo || u.name === updatedData.assignedTo);
      if (assignedUser && assignedUser.role === 'TECHNICIAN') {
        // Check for cross-team
        if (user.role === 'OFFICER' && assignedUser.supervisorId !== user.id) {
          updatedData.status = 'REQUESTED';
          updatedData.requestStatus = 'PENDING';
        } else {
          updatedData.status = 'RUNNING';
          updatedData.startedAt = new Date().toISOString();
        }
        updatedData.assignedBy = user.employeeId; 
        if (!updatedData.logs) updatedData.logs = [...(oldTask.logs || [])];
        updatedData.logs.push({
          id: Date.now().toString(),
          action: updatedData.status === 'REQUESTED' ? `Task requested for ${assignedUser.name}` : `Task assigned to ${assignedUser.name} - Started`,
          timestamp: new Date().toISOString(),
          user: user.name
        });

        // Notify supervisor if requested
        if (updatedData.status === 'REQUESTED' && assignedUser.supervisorId) {
          notifications.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            userId: assignedUser.supervisorId,
            message: `Officer ${user.name} requested your technician ${assignedUser.name} for task: ${oldTask.title}`,
            read: false,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Handle Approval/Rejection
    if (updatedData.requestStatus === 'APPROVED' && oldTask.requestStatus === 'PENDING') {
      updatedData.status = 'RUNNING';
      updatedData.startedAt = new Date().toISOString();
      if (oldTask.workType === 'TEAM' && oldTask.assignedTechnicians) {
        updatedData.assignedTechnicians = oldTask.assignedTechnicians.map(at => ({
          ...at,
          status: 'RUNNING',
          startedAt: new Date().toISOString()
        }));
      }
      
      // Notify requester
      const requester = users.find(u => u.employeeId === oldTask.assignedBy);
      if (requester) {
        notifications.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          userId: requester.id,
          message: `Your request for task "${oldTask.title}" has been APPROVED by ${user.name}`,
          read: false,
          timestamp: new Date().toISOString()
        });
      }
    } else if (updatedData.requestStatus === 'REJECTED' && oldTask.requestStatus === 'PENDING') {
      updatedData.status = 'REJECTED';
      
      // Notify requester
      const requester = users.find(u => u.employeeId === oldTask.assignedBy);
      if (requester) {
        notifications.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          userId: requester.id,
          message: `Your request for task "${oldTask.title}" has been REJECTED by ${user.name}. Reason: ${updatedData.requestRemarks || 'No reason provided'}`,
          read: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Handle Team Progress Updates
    if (oldTask.workType === 'TEAM' && updatedData.assignedTechnicians) {
      const totalProgress = updatedData.assignedTechnicians.reduce((sum: number, t: any) => sum + (t.progress || 0), 0);
      updatedData.totalTeamProgress = Math.round(totalProgress / updatedData.assignedTechnicians.length);
      updatedData.progress = updatedData.totalTeamProgress;
      
      if (updatedData.assignedTechnicians.every((t: any) => t.status === 'COMPLETED')) {
        updatedData.status = 'COMPLETED';
        updatedData.completedAt = new Date().toISOString();
      }
    }

    // Handle Completion Logic
    if (updatedData.progress === 100 && oldTask.status !== 'COMPLETED') {
      updatedData.status = 'COMPLETED';
      const completedAt = updatedData.actualCompletionTime || new Date().toISOString();
      updatedData.completedAt = completedAt;
      
      // Calculate Task Taken Time
      const start = new Date(oldTask.startedAt || oldTask.createdAt);
      const end = new Date(completedAt);
      const diffMs = end.getTime() - start.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      updatedData.taskTakenTime = `${diffHrs}h ${diffMins}m`;

      // Calculate Remaining and Over Time relative to Deadline
      const deadline = new Date(oldTask.deadline);
      const timeDiff = deadline.getTime() - end.getTime();
      const absDiff = Math.abs(timeDiff);
      const dHrs = Math.floor(absDiff / (1000 * 60 * 60));
      const dMins = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      const formattedDiff = `${dHrs}h ${dMins}m`;

      if (timeDiff >= 0) {
        updatedData.remainingTime = formattedDiff;
        updatedData.overTime = "0h 0m";
      } else {
        updatedData.remainingTime = "0h 0m";
        updatedData.overTime = formattedDiff;
      }

      // 1. Point Transaction for Officer
      let assignedOfficer = null;
      
      // If Engineer created it, it was assigned to an Officer
      if (oldTask.createdBy && users.find(u => u.employeeId === oldTask.createdBy)?.role === 'ENGINEER') {
        assignedOfficer = users.find(u => (u.name === oldTask.assignedTo || u.employeeId === oldTask.assignedTo) && u.role === 'OFFICER');
      } 
      // If Officer created it, they are the assigned officer
      if (!assignedOfficer) {
        assignedOfficer = users.find(u => u.employeeId === oldTask.assignedBy && u.role === 'OFFICER');
      }

      if (assignedOfficer && !oldTask.pointAdded) {
        pointTransactions.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          taskId: oldTask.id,
          officerId: assignedOfficer.id,
          engineerId: oldTask.createdBy,
          pointValue: oldTask.points || 1,
          taskPriority: oldTask.urgency,
          completedAt: completedAt
        });
        updatedData.pointAdded = true;
      }

      // 2. Technician Performance & Status Update
      const techniciansToUpdate = [];
      if (oldTask.workType === 'TEAM' && oldTask.assignedTechnicians) {
        techniciansToUpdate.push(...oldTask.assignedTechnicians.map(at => at.employeeId));
      } else if (oldTask.assignedTo) {
        const tech = users.find(u => u.employeeId === oldTask.assignedTo || u.name === oldTask.assignedTo);
        if (tech && tech.role === 'TECHNICIAN') {
          techniciansToUpdate.push(tech.employeeId);
        }
      }

      // Parse estimated duration (e.g., "1h 30m" or "90")
      const parseDuration = (dur: string) => {
        if (!dur) return 60; // Default 60 mins if not provided
        if (/^\d+$/.test(dur)) return parseInt(dur);
        let mins = 0;
        const hMatch = dur.match(/(\d+)h/);
        const mMatch = dur.match(/(\d+)m/);
        if (hMatch) mins += parseInt(hMatch[1]) * 60;
        if (mMatch) mins += parseInt(mMatch[1]);
        return mins || 60;
      };

      const estimatedMinutes = parseDuration(oldTask.estimatedDuration);
      const actualMinutes = Math.floor(diffMs / (1000 * 60));

      for (const techId of techniciansToUpdate) {
        const deadline = new Date(oldTask.deadline);
        const remainingMs = deadline.getTime() - end.getTime();
        const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
        
        // Efficiency calculation: (Estimated / Actual) * 100
        // If actual is 0 (unlikely), set a high score
        const efficiency = actualMinutes > 0 ? (estimatedMinutes / actualMinutes) * 100 : 100;
        
        let completionSpeedScore = 10;
        if (efficiency > 120) completionSpeedScore = 15; // Completed much faster
        else if (efficiency < 80) completionSpeedScore = 5; // Completed much slower

        technicianPerformance.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          technicianId: techId,
          taskId: oldTask.id,
          date: completedAt.split('T')[0],
          totalWorkMinutes: actualMinutes,
          estimatedMinutes: estimatedMinutes,
          remainingMinutes,
          completionSpeedScore,
          attendanceScore: 10,
          efficiencyScore: Math.min(Math.round(efficiency / 2), 50), // Max 50 points for efficiency
          finalDailyScore: Math.min(Math.round(efficiency / 2) + 10 + completionSpeedScore, 100)
        });

        // Update technician status to FREE if no other running tasks
        const runningTasks = tasks.filter(t => 
          t.id !== oldTask.id && 
          t.status === 'RUNNING' && 
          (t.assignedTo === techId || (t.assignedTechnicians && t.assignedTechnicians.some(at => at.employeeId === techId)))
        );
        if (runningTasks.length === 0) {
          const techUser = users.find(u => u.employeeId === techId);
          if (techUser) techUser.status = 'FREE';
        }
      }
    } else if (updatedData.status === 'COMPLETED' && oldTask.status !== 'COMPLETED') {
      // Handle case where status is set to COMPLETED directly
      updatedData.progress = 100;
      // Recurse or handle similarly to above (simplified for now)
      updatedData.completedAt = new Date().toISOString();
    }

      // Handle HOLD status
      if (updatedData.status === 'HOLD') {
        updatedData.progress = 0; // No progress shown during HOLD
        if (!updatedData.remarks) {
          return res.status(400).json({ error: "Remarks are required for Temporary Hold" });
        }
      }

      // If status changes from HOLD back to RUNNING or a percentage is set
      if (oldTask.status === 'HOLD' && (updatedData.status === 'RUNNING' || (updatedData.progress > 0 && updatedData.status !== 'HOLD'))) {
        updatedData.status = 'RUNNING';
        updatedData.startedAt = new Date().toISOString();
      }

      // Ensure logs are appended if not already handled by the logic above or the request body
      if (!updatedData.logs) {
        updatedData.logs = [
          ...(oldTask.logs || []),
          {
            id: Date.now().toString(),
            action: `Task updated by ${user.name}`,
            timestamp: new Date().toISOString(),
            user: user.name
          }
        ];
      }

      tasks[index] = { ...oldTask, ...updatedData };
      await saveData({ users, tasks, attendanceRecords, notifications, pointTransactions, technicianPerformance, assignmentRequests });
      res.json(tasks[index]);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.put("/api/users/theme", authenticate, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { theme, customBackground } = req.body;
    const userIndex = users.findIndex(u => u.employeeId === user.employeeId);
    if (userIndex !== -1) {
      users[userIndex].theme = theme;
      users[userIndex].customBackground = customBackground;
      await saveData({ users, tasks, attendanceRecords });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.delete("/api/tasks/:id", authenticate, async (req: Request, res: Response) => {
    console.log(`Delete task request for ID: ${req.params.id} from user: ${req.user.name} (${req.user.role})`);
    if (req.user.role !== 'SUPER_ADMIN') {
      console.warn(`Unauthorized delete attempt by user: ${req.user.name}`);
      return res.status(403).json({ error: "Only Super Admin can delete tasks" });
    }
    const { id } = req.params;
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks.splice(index, 1);
      await saveData({ users, tasks, attendanceRecords });
      console.log(`Task ${id} deleted successfully`);
      res.status(204).send();
    } else {
      console.warn(`Task ${id} not found for deletion`);
      res.status(404).json({ error: "Task not found" });
    }
  });

  app.get("/api/backup/:role/:type", authenticate, async (req: Request, res: Response) => {
    const { role, type } = req.params;
    const { format } = req.query;

    if (req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden: Role mismatch" });
    }

    // Define scope based on role
    const myScope = {
      id: req.user.id,
      employeeId: req.user.employeeId,
      role: req.user.role,
      assignedEngineers: req.user.assignedEngineers || []
    };

    const isTaskInScope = (task: any) => {
      if (myScope.role === 'SUPER_ADMIN' || myScope.role === 'HOD') return true;
      if (myScope.role === 'IN_CHARGE' || myScope.role === 'MODEL_MANAGER') {
        // Created by them or assigned to someone they manage
        return task.createdBy === myScope.employeeId || myScope.assignedEngineers.includes(task.assignedToEmployeeId);
      }
      if (myScope.role === 'ENGINEER') {
        // Assigned to them or created by them
        return task.assignedTo === req.user.name || task.createdBy === myScope.employeeId;
      }
      if (myScope.role === 'OFFICER') {
        // Assigned to them or created by them
        return task.assignedTo === req.user.name || task.createdBy === myScope.employeeId;
      }
      return false;
    };

    const scopedTasks = tasks.filter(isTaskInScope);
    let backupData: any = {
      role: myScope.role,
      type,
      timestamp: new Date().toISOString(),
      tasks: scopedTasks
    };

    if (type === 'full') {
      // Include users in scope
      const scopedUsers = users.filter((u: any) => {
        if (myScope.role === 'SUPER_ADMIN' || myScope.role === 'HOD') return true;
        if (myScope.role === 'IN_CHARGE' || myScope.role === 'MODEL_MANAGER') {
          return myScope.assignedEngineers.includes(u.employeeId) || u.supervisorId === myScope.id;
        }
        if (myScope.role === 'ENGINEER') {
          return u.supervisorId === myScope.id || (u.assignedEngineers || []).includes(myScope.employeeId);
        }
        return u.id === myScope.id;
      });

      backupData.users = scopedUsers;
      backupData.mapping = users.filter((u: any) => u.assignedEngineers && u.assignedEngineers.length > 0).map((u: any) => ({
        employeeId: u.employeeId,
        assignedEngineers: u.assignedEngineers
      }));
      // Performance data (simplified)
      backupData.performance = scopedTasks.map(t => ({
        taskId: t.taskId,
        points: t.points,
        status: t.status,
        completedAt: t.completedAt
      }));
    }

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      const wsTasks = XLSX.utils.json_to_sheet(scopedTasks);
      XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");
      
      if (type === 'full') {
        const wsUsers = XLSX.utils.json_to_sheet(backupData.users);
        XLSX.utils.book_append_sheet(wb, wsUsers, "Users");
        const wsMapping = XLSX.utils.json_to_sheet(backupData.mapping);
        XLSX.utils.book_append_sheet(wb, wsMapping, "Mapping");
        const wsPerformance = XLSX.utils.json_to_sheet(backupData.performance);
        XLSX.utils.book_append_sheet(wb, wsPerformance, "Performance");
      }

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename=backup_${role.toLowerCase()}_${type}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    res.json(backupData);
  });

  app.post("/api/restore/:role", authenticate, upload.single('backup'), async (req: Request, res: Response) => {
    const { role } = req.params;
    if (req.user.role !== role) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: "Forbidden: Role mismatch" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No backup file uploaded" });
    }

    try {
      let restoredData: any;
      if (req.file.originalname.endsWith('.json')) {
        const content = await fs.readFile(req.file.path, 'utf-8');
        restoredData = JSON.parse(content);
      } else if (req.file.originalname.endsWith('.xlsx')) {
        const workbook = XLSX.readFile(req.file.path);
        const tasksSheet = workbook.Sheets['Tasks'];
        const usersSheet = workbook.Sheets['Users'];

        restoredData = {
          tasks: tasksSheet ? XLSX.utils.sheet_to_json(tasksSheet) : [],
          users: usersSheet ? XLSX.utils.sheet_to_json(usersSheet) : []
        };
      } else {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: "Unsupported file format" });
      }

      // Validation and scoped restore logic
      if (restoredData.role && restoredData.role !== role) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: "Backup file role mismatch" });
      }

      // Get current user's scope
      const myScope = {
        id: req.user.id,
        employeeId: req.user.employeeId,
        role: req.user.role,
        assignedEngineers: req.user.assignedEngineers || []
      };

      const isTaskInScope = (task: any) => {
        if (myScope.role === 'SUPER_ADMIN' || myScope.role === 'HOD') return true;
        if (myScope.role === 'IN_CHARGE' || myScope.role === 'MODEL_MANAGER') {
          return task.createdBy === myScope.employeeId || myScope.assignedEngineers.includes(task.assignedToEmployeeId);
        }
        if (myScope.role === 'ENGINEER') {
          return task.assignedTo === req.user.name || task.createdBy === myScope.employeeId;
        }
        if (myScope.role === 'OFFICER') {
          return task.assignedTo === req.user.name || task.createdBy === myScope.employeeId;
        }
        return false;
      };

      // Restore tasks
      if (Array.isArray(restoredData.tasks)) {
        restoredData.tasks.forEach((restoredTask: any) => {
          if (isTaskInScope(restoredTask)) {
            const index = tasks.findIndex(t => t.id === restoredTask.id);
            if (index !== -1) {
              tasks[index] = { ...tasks[index], ...restoredTask };
            } else {
              tasks.push(restoredTask);
            }
          }
        });
      }

      // Restore users (only for SUPER_ADMIN/HOD)
      if ((myScope.role === 'SUPER_ADMIN' || myScope.role === 'HOD') && Array.isArray(restoredData.users)) {
        restoredData.users.forEach((restoredUser: any) => {
          const index = users.findIndex(u => u.employeeId === restoredUser.employeeId);
          if (index !== -1) {
            users[index] = { ...users[index], ...restoredUser };
          } else {
            users.push(restoredUser);
          }
        });
      }

      await saveData({ users, tasks, attendanceRecords });
      await fs.unlink(req.file.path); // Clean up uploaded file
      res.json({ message: "Data restored successfully within your scope" });
    } catch (err) {
      console.error("Restore error:", err);
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: "Failed to restore data" });
    }
  });

  // --- API 404 Handler ---
  app.all("/api/*", (req, res) => {
    console.warn(`404 API Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found` });
  });

  // --- Global Error Handler ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      path: req.originalUrl
    });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
