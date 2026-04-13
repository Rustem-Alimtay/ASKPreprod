import type { Express } from "express";
import type { Server } from "http";
import { isAuthenticated } from "../portal-auth";
import { storage } from "../storage";
import type { NetSuiteData, HRData, LiveryData } from "@workspace/db";

function generateNetSuiteData(): NetSuiteData & { isPlaceholder: true } {
  const now = new Date();
  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const formatTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return {
    isPlaceholder: true,
    metrics: [
      { id: "revenue", title: "Total Revenue", value: "$1,284,500", change: 12.5, changeLabel: "vs last month" },
      { id: "transactions", title: "Transactions", value: "2,847", change: 8.2, changeLabel: "vs last month" },
      { id: "avg-order", title: "Avg. Order Value", value: "$451", change: 3.1, changeLabel: "vs last month" },
      { id: "customers", title: "Active Customers", value: "1,234", change: -2.4, changeLabel: "vs last month" },
    ],
    transactions: [
      { id: "TXN-001", date: formatDate(now), type: "Invoice", customer: "Acme Corporation", amount: 15250, status: "completed" },
      { id: "TXN-002", date: formatDate(now), type: "Payment", customer: "TechStart Inc", amount: 8900, status: "completed" },
      { id: "TXN-003", date: formatDate(new Date(now.getTime() - 86400000)), type: "Invoice", customer: "Global Solutions", amount: 22000, status: "pending" },
      { id: "TXN-004", date: formatDate(new Date(now.getTime() - 86400000)), type: "Credit Memo", customer: "DataFlow Ltd", amount: 3500, status: "completed" },
      { id: "TXN-005", date: formatDate(new Date(now.getTime() - 172800000)), type: "Invoice", customer: "CloudNine Corp", amount: 45000, status: "pending" },
      { id: "TXN-006", date: formatDate(new Date(now.getTime() - 172800000)), type: "Payment", customer: "Innovate LLC", amount: 12750, status: "completed" },
      { id: "TXN-007", date: formatDate(new Date(now.getTime() - 259200000)), type: "Invoice", customer: "StartupX", amount: 5800, status: "failed" },
      { id: "TXN-008", date: formatDate(new Date(now.getTime() - 259200000)), type: "Payment", customer: "Enterprise Co", amount: 67500, status: "completed" },
    ],
    revenueByMonth: [
      { month: "Jan", revenue: 85000 },
      { month: "Feb", revenue: 92000 },
      { month: "Mar", revenue: 88000 },
      { month: "Apr", revenue: 105000 },
      { month: "May", revenue: 112000 },
      { month: "Jun", revenue: 98000 },
      { month: "Jul", revenue: 125000 },
      { month: "Aug", revenue: 118000 },
      { month: "Sep", revenue: 132000 },
      { month: "Oct", revenue: 145000 },
      { month: "Nov", revenue: 138000 },
      { month: "Dec", revenue: 146500 },
    ],
    lastSync: formatTime(now),
    connectionStatus: "connected",
  };
}

function generateHRData(): HRData & { isPlaceholder: true } {
  const now = new Date();
  const formatTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return {
    isPlaceholder: true,
    metrics: [
      { id: "total-employees", title: "Total Employees", value: "342", change: 5.2, changeLabel: "vs last quarter" },
      { id: "active", title: "Active", value: "328", change: 3.8, changeLabel: "vs last quarter" },
      { id: "on-leave", title: "On Leave", value: "14", change: 0, changeLabel: "vs last month" },
      { id: "departments", title: "Departments", value: "12", change: 0, changeLabel: "stable" },
    ],
    employees: [
      { id: "EMP-001", employeeCode: "EMP-001", name: "Sarah Johnson", email: "sarah.johnson@example.com", department: "Engineering", position: "Senior Developer", status: "active", startDate: "2021-03-15" },
      { id: "EMP-002", employeeCode: "EMP-002", name: "Michael Chen", email: "michael.chen@example.com", department: "Marketing", position: "Marketing Manager", status: "active", startDate: "2020-07-22" },
      { id: "EMP-003", employeeCode: "EMP-003", name: "Emily Rodriguez", email: "emily.rodriguez@example.com", department: "Sales", position: "Sales Lead", status: "active", startDate: "2022-01-10" },
      { id: "EMP-004", employeeCode: "EMP-004", name: "David Kim", email: "david.kim@example.com", department: "Engineering", position: "DevOps Engineer", status: "on-leave", startDate: "2019-11-05" },
      { id: "EMP-005", employeeCode: "EMP-005", name: "Jessica Brown", email: "jessica.brown@example.com", department: "HR", position: "HR Specialist", status: "active", startDate: "2021-09-18" },
      { id: "EMP-006", employeeCode: "EMP-006", name: "Robert Taylor", email: "robert.taylor@example.com", department: "Finance", position: "Financial Analyst", status: "active", startDate: "2020-04-01" },
      { id: "EMP-007", employeeCode: "EMP-007", name: "Amanda White", email: "amanda.white@example.com", department: "Engineering", position: "Frontend Developer", status: "active", startDate: "2022-06-12" },
      { id: "EMP-008", employeeCode: "EMP-008", name: "James Wilson", email: "james.wilson@example.com", department: "Operations", position: "Operations Manager", status: "terminated", startDate: "2018-02-28" },
    ],
    departmentStats: [
      { department: "Engineering", count: 85 },
      { department: "Marketing", count: 42 },
      { department: "Sales", count: 58 },
      { department: "HR", count: 28 },
      { department: "Finance", count: 35 },
      { department: "Operations", count: 45 },
      { department: "Legal", count: 15 },
      { department: "Support", count: 34 },
    ],
    lastSync: formatTime(now),
    connectionStatus: "connected",
  };
}

function generateLiveryData(): LiveryData & { isPlaceholder: true } {
  const now = new Date();
  const formatTime = (date: Date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  return {
    isPlaceholder: true,
    metrics: [
      { id: "total-shipments", title: "Total Shipments", value: "1,847", change: 15.3, changeLabel: "vs last week" },
      { id: "in-transit", title: "In Transit", value: "423", change: 8.7, changeLabel: "vs yesterday" },
      { id: "delivered", title: "Delivered Today", value: "156", change: 12.1, changeLabel: "vs yesterday" },
      { id: "on-time", title: "On-Time Rate", value: "94.2%", change: 2.5, changeLabel: "vs last week" },
    ],
    deliveries: [
      { id: "DEL-001", trackingNumber: "TRK-78542-A", origin: "Los Angeles, CA", destination: "New York, NY", status: "in-transit", estimatedDelivery: formatDate(new Date(now.getTime() + 172800000)) },
      { id: "DEL-002", trackingNumber: "TRK-78543-B", origin: "Chicago, IL", destination: "Miami, FL", status: "delivered", estimatedDelivery: formatDate(now) },
      { id: "DEL-003", trackingNumber: "TRK-78544-C", origin: "Seattle, WA", destination: "Denver, CO", status: "in-transit", estimatedDelivery: formatDate(new Date(now.getTime() + 86400000)) },
      { id: "DEL-004", trackingNumber: "TRK-78545-D", origin: "Houston, TX", destination: "Phoenix, AZ", status: "pending", estimatedDelivery: formatDate(new Date(now.getTime() + 259200000)) },
      { id: "DEL-005", trackingNumber: "TRK-78546-E", origin: "Boston, MA", destination: "Atlanta, GA", status: "delayed", estimatedDelivery: formatDate(new Date(now.getTime() + 345600000)) },
      { id: "DEL-006", trackingNumber: "TRK-78547-F", origin: "San Francisco, CA", destination: "Portland, OR", status: "delivered", estimatedDelivery: formatDate(now) },
      { id: "DEL-007", trackingNumber: "TRK-78548-G", origin: "Dallas, TX", destination: "Nashville, TN", status: "in-transit", estimatedDelivery: formatDate(new Date(now.getTime() + 86400000)) },
      { id: "DEL-008", trackingNumber: "TRK-78549-H", origin: "Philadelphia, PA", destination: "Detroit, MI", status: "pending", estimatedDelivery: formatDate(new Date(now.getTime() + 172800000)) },
    ],
    deliveryStats: [
      { status: "In Transit", count: 423 },
      { status: "Delivered", count: 1156 },
      { status: "Pending", count: 189 },
      { status: "Delayed", count: 79 },
    ],
    lastSync: formatTime(now),
    connectionStatus: "connected",
  };
}

export function registerErpDashboardRoutes(app: Express, _httpServer: Server) {
  app.get("/api/netsuite", isAuthenticated, (_req, res) => {
    const data = generateNetSuiteData();
    res.json(data);
  });

  app.get("/api/hr", isAuthenticated, async (_req, res) => {
    try {
      const ds = await storage.getDataSourceBySlug("employee-directory");
      if (!ds) {
        const data = generateHRData();
        return res.json(data);
      }

      const { records } = await storage.getDsRecords(ds.id, { limit: 500 });

      const employees: HRData["employees"] = records.map((r) => ({
        id: String(r.id),
        employeeCode: (r.data.employee_code as string) || "",
        name: (r.data.full_name as string) || "",
        email: (r.data.email as string) || "",
        department: (r.data.department_english as string) || "",
        position: (r.data.position as string) || "",
        status: "active" as const,
        startDate: "",
      }));

      const deptCounts: Record<string, number> = {};
      for (const emp of employees) {
        if (emp.department) {
          deptCounts[emp.department] = (deptCounts[emp.department] || 0) + 1;
        }
      }
      const departmentStats = Object.entries(deptCounts).map(([department, count]) => ({
        department,
        count,
      }));

      const now = new Date();
      const formatTime = (date: Date) =>
        date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      const data: HRData = {
        metrics: [
          { id: "total-employees", title: "Total Employees", value: String(employees.length), change: 0, changeLabel: "" },
          { id: "active", title: "Active", value: String(employees.filter((e) => e.status === "active").length), change: 0, changeLabel: "" },
          { id: "on-leave", title: "On Leave", value: String(employees.filter((e) => e.status === "on-leave").length), change: 0, changeLabel: "" },
          { id: "departments", title: "Departments", value: String(Object.keys(deptCounts).length), change: 0, changeLabel: "" },
        ],
        employees,
        departmentStats,
        lastSync: formatTime(now),
        connectionStatus: "connected",
      };

      res.json(data);
    } catch (error) {
      console.error("Error fetching HR data:", error);
      const data = generateHRData();
      res.json(data);
    }
  });

  app.get("/api/livery", isAuthenticated, (_req, res) => {
    const data = generateLiveryData();
    res.json(data);
  });
}
