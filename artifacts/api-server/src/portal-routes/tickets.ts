import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../portal-auth";
import { isAdmin } from "./helpers";
import { type ManagedUser, type Ticket, tickets, itSupportSubcategories, digitalTransformationSubcategories } from "@workspace/db";
import { z } from "zod";
import { sendTicketCreatedNotification, sendTicketStatusChangedNotification, sendTicketCommentNotification } from "../email";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/httpError";

async function resolveAssignedEmail(assignedTo: string | null | undefined): Promise<string | null> {
  if (!assignedTo) return null;
  const user = await storage.getManagedUser(assignedTo);
  return user?.email || null;
}

export async function registerTicketRoutes(app: Express, _httpServer: Server) {
  // ===== HELP CENTER & TICKETS =====

  // Seed initial help center content
  async function seedHelpCenterContent() {
    const existingFaq = await storage.getAllFaqEntries();
    if (existingFaq.length === 0) {
      const faqEntries = [
        { category: "general", question: "What is the Data Integration Portal?", answer: "The Data Integration Portal is a centralized dashboard that brings together data from multiple business systems including NetSuite (financial data), HR (employee management), and Livery (delivery tracking) into one unified interface.", order: "1", isPublished: true },
        { category: "general", question: "How often is data synchronized?", answer: "Data is synchronized in near real-time. Each dashboard displays the last sync time in the header. Typically, data is refreshed every 5-15 minutes depending on the source system.", order: "2", isPublished: true },
        { category: "netsuite", question: "Why can't I see certain transactions?", answer: "Transaction visibility depends on your role permissions. Viewers can see summary data, Editors can see detailed transactions, and Admins have full access. Contact your administrator if you need expanded access.", order: "1", isPublished: true },
        { category: "netsuite", question: "How do I export financial data?", answer: "To export data, navigate to the NetSuite dashboard, use the filters to select your date range, then click the Export button in the top right corner. Data can be exported as CSV or Excel format.", order: "2", isPublished: true },
        { category: "hr", question: "Can I update employee information?", answer: "Employee information is read-only in this portal. To update employee records, please use the primary HR system directly or contact your HR administrator.", order: "1", isPublished: true },
        { category: "livery", question: "Why is a delivery showing as delayed?", answer: "Deliveries are marked as delayed when they exceed their estimated delivery time. The status is updated automatically based on driver GPS data and route calculations.", order: "1", isPublished: true },
        { category: "account", question: "How do I reset my password?", answer: "Go to Settings > Profile, then click 'Change Password'. You'll need to enter your current password and then your new password twice for confirmation.", order: "1", isPublished: true },
        { category: "account", question: "How do I enable Multi-Factor Authentication (MFA)?", answer: "Navigate to Settings > Security tab, then click 'Enable MFA'. You'll need an authenticator app like Google Authenticator or Authy to scan the QR code and complete setup.", order: "2", isPublished: true },
        { category: "troubleshooting", question: "The dashboard is loading slowly. What can I do?", answer: "Try refreshing the page, clearing your browser cache, or using a different browser. If issues persist, check your internet connection or submit a support ticket.", order: "1", isPublished: true },
        { category: "troubleshooting", question: "I'm seeing outdated data. How do I refresh?", answer: "Each dashboard has a refresh button near the sync status indicator. Click it to force a data refresh. If the issue persists, there may be a sync issue - please submit a support ticket.", order: "2", isPublished: true },
      ];
      for (const entry of faqEntries) {
        await storage.createFaqEntry(entry);
      }
      console.log("Seeded FAQ entries");
    }

    const existingManuals = await storage.getAllUserManuals();
    if (existingManuals.length === 0) {
      const manuals = [
        { category: "general", title: "Getting Started Guide", description: "Learn the basics of navigating the Data Integration Portal and accessing your dashboards.", content: "# Getting Started\n\nWelcome to the Data Integration Portal. This guide will help you get started with the system.\n\n## Logging In\n\n1. Navigate to the portal URL\n2. Enter your username and password\n3. Click 'Sign In'\n\n## Navigation\n\nUse the sidebar to navigate between different dashboards:\n- NetSuite: Financial data and transactions\n- HR: Employee information\n- Livery: Delivery tracking", order: "1", isPublished: true },
        { category: "netsuite", title: "NetSuite Dashboard Manual", description: "Complete guide to using the NetSuite financial dashboard including metrics, transactions, and reporting.", content: "# NetSuite Dashboard\n\n## Overview\n\nThe NetSuite dashboard provides real-time financial data including:\n- Revenue metrics\n- Transaction history\n- Customer information\n\n## Features\n\n### Metrics Cards\nTop-level KPIs showing current performance vs. previous periods.\n\n### Transaction Table\nSearchable, filterable list of all transactions.\n\n### Charts\nVisual representations of financial trends over time.", order: "1", isPublished: true },
        { category: "hr", title: "HR Dashboard Manual", description: "Guide to viewing employee data, department statistics, and organizational metrics.", content: "# HR Dashboard\n\n## Overview\n\nThe HR dashboard displays employee-related information:\n- Total employee count\n- Department breakdown\n- Leave status\n- Hiring metrics", order: "1", isPublished: true },
        { category: "livery", title: "Livery Tracking Manual", description: "How to track deliveries, monitor fleet performance, and understand delivery statuses.", content: "# Livery Tracking\n\n## Overview\n\nMonitor your delivery fleet in real-time:\n- Active deliveries\n- Driver locations\n- Delivery status updates\n\n## Status Codes\n\n- **In Transit**: Package is on the way\n- **Delivered**: Successfully delivered\n- **Delayed**: Behind schedule", order: "1", isPublished: true },
        { category: "account", title: "Account Security Guide", description: "Best practices for keeping your account secure including MFA setup and password management.", content: "# Account Security\n\n## Password Requirements\n\n- Minimum 8 characters\n- Mix of uppercase and lowercase\n- At least one number\n\n## Multi-Factor Authentication\n\nWe strongly recommend enabling MFA for added security. Go to Settings > Security to enable.", order: "1", isPublished: true },
      ];
      for (const manual of manuals) {
        await storage.createUserManual(manual);
      }
      console.log("Seeded User Manuals");
    }
  }

  // Run seeding in background
  seedHelpCenterContent().catch(console.error);

  // Get FAQ entries
  app.get("/api/help/faq", isAuthenticated, asyncHandler(async (_req, res) => {
    const entries = await storage.getAllFaqEntries();
    res.json(entries);
  }));

  // Get user manuals
  app.get("/api/help/manuals", isAuthenticated, asyncHandler(async (_req, res) => {
    const manuals = await storage.getAllUserManuals();
    res.json(manuals);
  }));

  // Get user manual by ID
  app.get("/api/help/manuals/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const manual = await storage.getUserManual(req.params.id);
    if (!manual) {
      throw HttpError.notFound("Manual not found");
    }
    res.json(manual);
  }));

  // ===== TICKET MANAGEMENT =====

  // Create a new ticket
  const createTicketSchema = z.object({
    subject: z.string().min(5, "Subject must be at least 5 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    category: z.enum(["it_support", "digital_transformation", "other"]),
    subcategory: z.string().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]),
  }).superRefine((data, ctx) => {
    if (data.subcategory) {
      if (data.category === "it_support" && !(itSupportSubcategories as readonly string[]).includes(data.subcategory)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid subcategory for IT Support`, path: ["subcategory"] });
      }
      if (data.category === "digital_transformation" && !(digitalTransformationSubcategories as readonly string[]).includes(data.subcategory)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid subcategory for Digital Transformation`, path: ["subcategory"] });
      }
    }
  });

  app.post("/api/tickets", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const parsed = { data: createTicketSchema.parse(req.body) } as const;

    const ticket = await storage.createTicket({
      ...parsed.data,
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      status: "new",
    });

    await storage.createAuditLog({
      action: "ticket_created",
      category: "support",
      userId: user.id,
      userEmail: user.email,
      details: { ticketId: ticket.id, trackingId: ticket.trackingId, subject: ticket.subject },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      status: "success",
    });

    sendTicketCreatedNotification(ticket);

    res.status(201).json(ticket);
  }));

  // Get current user's tickets
  app.get("/api/tickets/my", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const tickets = await storage.getTicketsByUser(user.id);
    res.json(tickets);
  }));

  app.get("/api/tickets/stats", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const userFilter = isAdmin ? sql`1=1` : sql`user_id = ${user.id}`;

    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where status in ('new','in_progress','under_review'))::int`,
      resolved: sql<number>`count(*) filter (where status = 'resolved')::int`,
      closed: sql<number>`count(*) filter (where status = 'closed')::int`,
      statusNew: sql<number>`count(*) filter (where status = 'new')::int`,
      statusInProgress: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      statusUnderReview: sql<number>`count(*) filter (where status = 'under_review')::int`,
      itSupport: sql<number>`count(*) filter (where category = 'it_support')::int`,
      digitalTransformation: sql<number>`count(*) filter (where category = 'digital_transformation')::int`,
      critical: sql<number>`count(*) filter (where severity = 'critical' and status in ('new','in_progress','under_review'))::int`,
      itOpen: sql<number>`count(*) filter (where category = 'it_support' and status in ('new','in_progress','under_review'))::int`,
      itResolved: sql<number>`count(*) filter (where category = 'it_support' and status in ('resolved','closed'))::int`,
      dtOpen: sql<number>`count(*) filter (where category = 'digital_transformation' and status in ('new','in_progress','under_review'))::int`,
      dtResolved: sql<number>`count(*) filter (where category = 'digital_transformation' and status in ('resolved','closed'))::int`,
      avgCloseMs: sql<number>`coalesce(avg(extract(epoch from (resolved_at - created_at)) * 1000) filter (where status in ('resolved','closed') and resolved_at is not null), 0)`,
    }).from(tickets).where(userFilter);

    const avgCloseTimeHours = Math.round((Number(counts.avgCloseMs) / (1000 * 60 * 60)) * 100) / 100;
    const avgCloseTimeDays = Math.round((avgCloseTimeHours / 24) * 100) / 100;

    const overdueRows = await db.select({ id: tickets.id }).from(tickets)
      .where(sql`${userFilter} AND status in ('new','in_progress','under_review') AND (
        (severity = 'critical' AND created_at < now() - interval '4 hours') OR
        (severity = 'high' AND created_at < now() - interval '24 hours') OR
        (severity = 'medium' AND created_at < now() - interval '48 hours') OR
        (severity = 'low' AND created_at < now() - interval '72 hours')
      )`);

    const overdueTickets = overdueRows.map(r => r.id);

    const stats = {
      total: counts.total,
      open: counts.open,
      resolved: counts.resolved,
      closed: counts.closed,
      itSupport: counts.itSupport,
      digitalTransformation: counts.digitalTransformation,
      critical: counts.critical,
      byStatus: {
        new: counts.statusNew,
        in_progress: counts.statusInProgress,
        under_review: counts.statusUnderReview,
        resolved: counts.resolved,
        closed: counts.closed,
      },
      avgCloseTimeHours,
      avgCloseTimeDays,
      byDepartmentLoad: {
        it_support: {
          total: counts.itSupport,
          open: counts.itOpen,
          resolved: counts.itResolved,
        },
        digital_transformation: {
          total: counts.digitalTransformation,
          open: counts.dtOpen,
          resolved: counts.dtResolved,
        },
      },
      slaBreaches: overdueTickets.length,
      overdueTickets,
    };
    res.json(stats);
  }));

  // Get ticket by ID (user can only view their own, admin can view all)
  app.get("/api/tickets/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(req.params.id);
      
    if (!ticket) {
      throw HttpError.notFound("Ticket not found");
    }

    // Users can only view their own tickets, admins can view all
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("You can only view your own tickets");
    }

    res.json(ticket);
  }));

  // Get ticket comments
  app.get("/api/tickets/:id/comments", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(req.params.id);
      
    if (!ticket) {
      throw HttpError.notFound("Ticket not found");
    }

    // Users can only view their own tickets, admins can view all
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("You can only view your own tickets");
    }

    const comments = await storage.getTicketComments(req.params.id);
    res.json(comments);
  }));

  // Add comment to ticket
  const addCommentSchema = z.object({
    message: z.string().min(1, "Message is required"),
  });

  app.post("/api/tickets/:id/comments", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(req.params.id);
      
    if (!ticket) {
      throw HttpError.notFound("Ticket not found");
    }

    // Users can only comment on their own tickets, admins can comment on all
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("You can only comment on your own tickets");
    }

    const parsed = { data: addCommentSchema.parse(req.body) } as const;

    const commentUserName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
    const comment = await storage.createTicketComment({
      ticketId: req.params.id,
      userId: user.id,
      userEmail: user.email,
      userName: commentUserName,
      isAdmin: user.role === "admin" || user.role === "superadmin",
      message: parsed.data.message,
    });

    const assignedToEmail = await resolveAssignedEmail(ticket.assignedTo);
    sendTicketCommentNotification({ ...ticket, assignedToEmail }, commentUserName, parsed.data.message);

    res.status(201).json(comment);
  }));

  // ===== ADMIN TICKET MANAGEMENT =====

  app.get("/api/admin/tickets", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    const result = await storage.getAllTickets({
      limit, offset, status, category,
      userId: isAdmin ? undefined : user.id,
    });
    res.json(result);
  }));

  // Update ticket (admin: status/assignee/severity/category; user: subject/description when status=new)
  const updateTicketSchema = z.object({
    status: z.enum(["new", "in_progress", "under_review", "resolved", "closed"]).optional(),
    assignedTo: z.string().optional(),
    assignedToName: z.string().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    category: z.enum(["it_support", "digital_transformation", "other"]).optional(),
    subject: z.string().min(5, "Subject must be at least 5 characters").optional(),
    description: z.string().min(10, "Description must be at least 10 characters").optional(),
  });

  app.patch("/api/admin/tickets/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const ticket = await storage.getTicket(req.params.id);
      
    if (!ticket) {
      throw HttpError.notFound("Ticket not found");
    }

    if (!isAdmin && ticket.userId !== user.id) {
      throw HttpError.forbidden("You can only update your own tickets");
    }

    const parsed = { data: updateTicketSchema.parse(req.body) } as const;

    if (!isAdmin) {
      const adminOnlyFields = ['status', 'assignedTo', 'assignedToName', 'severity', 'category'] as const;
      const hasAdminField = adminOnlyFields.some(f => parsed.data[f] !== undefined);
      if (hasAdminField) {
        throw HttpError.forbidden("Only admins can change status, assignment, severity, or category");
      }
      if ((parsed.data.subject || parsed.data.description) && ticket.status !== "new") {
        throw HttpError.forbidden("You can only edit subject/description while the ticket is in 'new' status");
      }
    }

    if (parsed.data.status) {
      if (ticket.status === "closed" && parsed.data.status !== "closed") {
        throw HttpError.badRequest("Cannot reopen a closed ticket");
      }
    }

    const updateData: Partial<Ticket> & typeof parsed.data = { ...parsed.data };

    if (parsed.data.category && parsed.data.category !== ticket.category) {
      updateData.subcategory = null;
    }

    if (parsed.data.status === "resolved" && ticket.status !== "resolved") {
      updateData.resolvedAt = new Date();
    }
    if (parsed.data.status === "closed" && ticket.status !== "closed") {
      updateData.closedAt = new Date();
    }

    const updated = await storage.updateTicket(req.params.id, updateData);

    await storage.createAuditLog({
      action: "ticket_updated",
      category: "support",
      userId: user.id,
      userEmail: user.email,
      details: { ticketId: ticket.id, trackingId: ticket.trackingId, changes: parsed.data },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      status: "success",
    });

    if (parsed.data.status && parsed.data.status !== ticket.status) {
      const changedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
      const assignedEmail = await resolveAssignedEmail(updated.assignedTo);
      sendTicketStatusChangedNotification({
        ...updated,
        userEmail: ticket.userEmail,
        userName: ticket.userName,
        assignedToEmail: assignedEmail,
      }, ticket.status, parsed.data.status, changedByName);
    }

    res.json(updated);
  }));

  // ===== TICKET ATTACHMENTS =====

  app.get("/api/tickets/:id/attachments", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) throw HttpError.notFound("Ticket not found");
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("Access denied");
    }
    const attachments = await storage.getTicketAttachments(req.params.id);
    res.json(attachments.map(a => ({ id: a.id, ticketId: a.ticketId, filename: a.filename, fileType: a.fileType, fileSize: a.fileSize, uploadedAt: a.uploadedAt })));
  }));

  const uploadAttachmentSchema = z.object({
    attachments: z.array(z.object({
      filename: z.string().min(1),
      fileType: z.string().min(1),
      fileSize: z.number().max(10 * 1024 * 1024, "File too large (max 10MB)"),
      fileData: z.string().min(1),
    })).min(1).max(5),
  });

  app.post("/api/tickets/:id/attachments", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) throw HttpError.notFound("Ticket not found");
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("Access denied");
    }

    const parsed = { data: uploadAttachmentSchema.parse(req.body) } as const;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv"];

    const existingAttachments = await storage.getTicketAttachments(req.params.id);
    const maxPerTicket = 10;
    if (existingAttachments.length + parsed.data.attachments.length > maxPerTicket) {
      return res.status(400).json({ message: `Maximum ${maxPerTicket} attachments per ticket. Currently ${existingAttachments.length} attached.` });
    }

    const maxFileBytes = 10 * 1024 * 1024;
    const created = [];
    for (const att of parsed.data.attachments) {
      if (!allowedTypes.includes(att.fileType)) {
        return res.status(400).json({ message: `File type not allowed: ${att.fileType}` });
      }
      const base64Part = att.fileData.includes(",") ? att.fileData.split(",")[1] : att.fileData;
      const actualBytes = Buffer.from(base64Part, "base64").length;
      if (actualBytes > maxFileBytes) {
        return res.status(400).json({ message: `File "${att.filename}" exceeds 10MB limit (actual size: ${(actualBytes / (1024 * 1024)).toFixed(1)}MB)` });
      }
      const attachment = await storage.createTicketAttachment({
        ticketId: req.params.id,
        filename: att.filename,
        fileType: att.fileType,
        fileSize: actualBytes,
        fileData: att.fileData,
      });
      created.push({ id: attachment.id, ticketId: attachment.ticketId, filename: attachment.filename, fileType: attachment.fileType, fileSize: attachment.fileSize, uploadedAt: attachment.uploadedAt });
    }
    res.status(201).json(created);
  }));

  app.get("/api/ticket-attachments/:id/download", isAuthenticated, asyncHandler(async (req, res) => {
    const att = await storage.getTicketAttachmentById(req.params.id);
    if (!att) throw HttpError.notFound("Attachment not found");

    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(att.ticketId);
    if (!ticket) throw HttpError.notFound("Ticket not found");
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("Access denied");
    }

    const base64Data = att.fileData.includes(",") ? att.fileData.split(",")[1] : att.fileData;
    const buffer = Buffer.from(base64Data, "base64");
    res.setHeader("Content-Type", att.fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${att.filename}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  }));

  app.delete("/api/ticket-attachments/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const att = await storage.getTicketAttachmentById(req.params.id);
    if (!att) throw HttpError.notFound("Attachment not found");

    const user = (req as any).managedUser as ManagedUser;
    const ticket = await storage.getTicket(att.ticketId);
    if (!ticket) throw HttpError.notFound("Ticket not found");
    if (ticket.userId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("Access denied");
    }

    await storage.deleteTicketAttachment(req.params.id);
    res.json({ message: "Attachment deleted" });
  }));

  // Delete ticket (admin only)
  app.delete("/api/admin/tickets/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const user = (req as any).managedUser as ManagedUser;
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw HttpError.forbidden("Only admins can delete tickets");
    }

    const ticket = await storage.getTicket(req.params.id);
      
    if (!ticket) {
      throw HttpError.notFound("Ticket not found");
    }

    await storage.deleteTicket(req.params.id);

    await storage.createAuditLog({
      action: "ticket_deleted",
      category: "support",
      userId: user.id,
      userEmail: user.email,
      details: { ticketId: ticket.id, trackingId: ticket.trackingId, subject: ticket.subject },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      status: "success",
    });

    res.json({ message: "Ticket deleted" });
  }));
}
