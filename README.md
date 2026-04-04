# Daily Work Update - Hierarchical Task Management System

A robust, full-stack task management application designed for structured organizational workflows, featuring a hierarchical role system, real-time tracking, and advanced reporting.

**Developed by: Jahid Hasan (38250) RAC R&I**

---

## 🚀 Comprehensive Feature Guide (Step-by-Step)

### 1. Secure Authentication & Role-Based Access
*   **Step 1: Login**: Users log in using their unique Employee ID and password.
*   **Step 2: Role Redirection**: The system automatically identifies the user's role (Super Admin, HOD, In-Charge, Officer, Engineer, or Technician) and redirects them to their specialized dashboard.
*   **Step 3: Profile Management**: Users can view their profile details and current status (e.g., Technicians see if they are 'FREE' or 'WORKING').

### 2. Hierarchical Task Lifecycle
*   **Step 1: Task Creation (Officer/Admin)**: Officers or Admins create tasks, specifying the title, model, priority, and assigning it to an Engineer or Technician.
*   **Step 2: Engineer Oversight**: Engineers receive tasks. They can view the task details and, if needed, assign them to a specific Technician for execution.
*   **Step 3: Execution (Technician)**: Technicians move tasks from `PENDING` to `RUNNING`. They update the progress percentage (0-100%) in real-time.
*   **Step 4: Completion**: Once finished, the Technician marks the task as `COMPLETED`. The system automatically records the completion timestamp and calculates the total time taken.
*   **Step 5: Feedback (Officer Remarks)**: Officers can review completed tasks and add "Officer Remarks" for quality control and feedback.

### 3. Advanced Reporting System
*   **Step 1: Select Report Type**: Users (with appropriate permissions) can choose from "DAILY", "WEEKLY", "MONTHLY", or "CUSTOM" reports.
*   **Step 2: Custom Range**: For "CUSTOM" reports, users can select a precise start and end date/time.
*   **Step 3: Role-Based Data Visibility**:
    *   **Engineer Reports**: Strictly hide Technician names for external reporting. Shows task details, assigned Officer, status, and time taken.
    *   **Officer Reports**: Include mandatory Engineer and Technician names for internal accountability.
    *   **Admin/HOD Reports**: Full visibility across all hierarchy levels.
*   **Step 4: Export Formats**:
    *   **PDF**: Generates a professional **Landscape** document with a standardized header and the mandatory footer: *"Software development by Jahid Hasan (38250) RAC R&I"*.
    *   **Excel**: Exports a clean data sheet with all relevant columns and the same mandatory footer.

### 4. Real-Time Monitoring & Dashboard
*   **Step 1: Performance Metrics**: View live stats on Total Tasks, Active Tasks, Completed Tasks, and Team Efficiency.
*   **Step 2: Visual Analytics**: Interactive Recharts display task distribution by priority and staff workload.
*   **Step 3: Task Filtering**: Use the "ALL", "PENDING", "RUNNING", and "COMPLETED" tabs to quickly find specific tasks.
*   **Step 4: Search & Sort**: Search tasks by ID, Title, or Model, and sort by priority or date.

### 5. Staff & Team Management
*   **Step 1: Staff Directory**: View a comprehensive list of all employees, their roles, and current work status.
*   **Step 2: Live Status**: See at a glance which Technicians are currently occupied and which are available for new assignments.
*   **Step 3: Team Hierarchy**: Admins can manage the relationships between Officers and their assigned Technicians.

### 6. System Administration (Super Admin Only)
*   **Step 1: Task Deletion**: Super Admins can delete tasks with a secure confirmation modal.
*   **Step 2: User Management**: Add, edit, or remove staff members and reset passwords.
*   **Step 3: Backup**: Export the entire system database (Users, Tasks, etc.) to a secure JSON file for off-site storage.
*   **Step 4: Restore**: Instantly recover the system state from a previously saved backup file.

---

## 🛠️ Tech Stack
-   **Frontend**: React 18+, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion (Animations), Recharts (Analytics).
-   **Backend**: Node.js, Express (Custom Server).
-   **Reporting**: `jspdf`, `jspdf-autotable` (PDF Generation), `xlsx` (Excel Export).
-   **Authentication**: JWT (JSON Web Tokens) with Bcrypt password hashing.
-   **State Management**: React Hooks (useState, useEffect, useMemo).

---

## 📝 License & Attribution
This project is developed for internal organizational use.
**Software development by Jahid Hasan (38250) RAC R&I**
Copyright © 2026 Daily Work Update.
