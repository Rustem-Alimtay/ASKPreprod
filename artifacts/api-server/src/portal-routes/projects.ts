import type { Express } from "express";
import type { Server } from "http";
import { storage } from "../storage";
import { isAuthenticated } from "../portal-auth";
import { isAdmin } from "./helpers";
import { type ManagedUser, insertSpaceSchema, insertProjectGroupSchema, insertProjectSchema, insertProjectAssignmentSchema, insertProjectCommentSchema, insertBlueprintSchema, insertSectionTemplateSchema, insertPageSectionSchema } from "@workspace/db";
import { z } from "zod";

export async function registerProjectRoutes(app: Express, _httpServer: Server) {
  // ==================== Collaboration Blueprints Routes ====================
  
  // Get all blueprints
  app.get("/api/blueprints", isAuthenticated, async (req, res) => {
    try {
      const blueprints = await storage.getAllBlueprints();
      res.json(blueprints);
    } catch (error) {
      console.error("Error fetching blueprints:", error);
      res.status(500).json({ message: "Failed to fetch blueprints" });
    }
  });

  // Get blueprint by section name
  app.get("/api/blueprints/section/:sectionName", isAuthenticated, async (req, res) => {
    try {
      const blueprint = await storage.getBlueprintBySectionName(req.params.sectionName);
      if (!blueprint) {
        return res.status(404).json({ message: "Blueprint not found" });
      }
      res.json(blueprint);
    } catch (error) {
      console.error("Error fetching blueprint:", error);
      res.status(500).json({ message: "Failed to fetch blueprint" });
    }
  });

  // Get single blueprint
  app.get("/api/blueprints/:id", isAuthenticated, async (req, res) => {
    try {
      const blueprint = await storage.getBlueprint(req.params.id);
      if (!blueprint) {
        return res.status(404).json({ message: "Blueprint not found" });
      }
      res.json(blueprint);
    } catch (error) {
      console.error("Error fetching blueprint:", error);
      res.status(500).json({ message: "Failed to fetch blueprint" });
    }
  });

  // Create blueprint
  app.post("/api/blueprints", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = insertBlueprintSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid blueprint data", errors: parsed.error.errors });
      }
      const blueprint = await storage.createBlueprint(parsed.data);
      res.status(201).json(blueprint);
    } catch (error) {
      console.error("Error creating blueprint:", error);
      res.status(500).json({ message: "Failed to create blueprint" });
    }
  });

  // Update blueprint
  app.patch("/api/blueprints/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const existing = await storage.getBlueprint(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Blueprint not found" });
      }
      const bpParsed = insertBlueprintSchema.partial().safeParse(req.body);
      if (!bpParsed.success) {
        return res.status(400).json({ message: "Invalid blueprint data", errors: bpParsed.error.errors });
      }
      const blueprint = await storage.updateBlueprint(req.params.id, bpParsed.data);
      res.json(blueprint);
    } catch (error) {
      console.error("Error updating blueprint:", error);
      res.status(500).json({ message: "Failed to update blueprint" });
    }
  });

  // Delete blueprint
  app.delete("/api/blueprints/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const existing = await storage.getBlueprint(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Blueprint not found" });
      }
      await storage.deleteBlueprint(req.params.id);
      res.json({ message: "Blueprint deleted successfully" });
    } catch (error) {
      console.error("Error deleting blueprint:", error);
      res.status(500).json({ message: "Failed to delete blueprint" });
    }
  });

  // ========================
  // Project Tags API Routes
  // ========================
  
  app.get("/api/project-tags", isAuthenticated, async (req, res) => {
    try {
      const tags = await storage.getAllProjectTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project tags" });
    }
  });

  app.post("/api/project-tags", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, color } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Tag name is required" });
      }
      const tag = await storage.createProjectTag({ name, color });
      res.status(201).json(tag);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(400).json({ message: "Tag with this name already exists" });
      }
      res.status(500).json({ message: "Failed to create project tag" });
    }
  });

  app.patch("/api/project-tags/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      const tag = await storage.updateProjectTag(id, { name, color });
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      res.status(500).json({ message: "Failed to update project tag" });
    }
  });

  app.delete("/api/project-tags/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProjectTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project tag" });
    }
  });

  // ========================
  // Sprints API Routes
  // ========================

  // Get all sprints
  app.get("/api/sprints", isAuthenticated, async (req, res) => {
    try {
      const sprints = await storage.getAllSprints();
      res.json(sprints);
    } catch (error) {
      console.error("Error fetching sprints:", error);
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });

  // Get active sprint
  app.get("/api/sprints/active", isAuthenticated, async (req, res) => {
    try {
      const sprint = await storage.getActiveSprint();
      res.json(sprint || null);
    } catch (error) {
      console.error("Error fetching active sprint:", error);
      res.status(500).json({ message: "Failed to fetch active sprint" });
    }
  });

  // Create sprint
  app.post("/api/sprints", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      if (managedUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const sprint = await storage.createSprint(req.body);
      res.status(201).json(sprint);
    } catch (error) {
      console.error("Error creating sprint:", error);
      res.status(500).json({ message: "Failed to create sprint" });
    }
  });

  // Update sprint
  app.patch("/api/sprints/:id", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      if (managedUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const sprint = await storage.updateSprint(req.params.id, req.body);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }
      res.json(sprint);
    } catch (error) {
      console.error("Error updating sprint:", error);
      res.status(500).json({ message: "Failed to update sprint" });
    }
  });

  // Delete sprint
  app.delete("/api/sprints/:id", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      if (managedUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      await storage.deleteSprint(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sprint:", error);
      res.status(500).json({ message: "Failed to delete sprint" });
    }
  });

  // Close sprint (archives completed tasks)
  app.post("/api/sprints/:id/close", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      if (managedUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const result = await storage.closeSprint(req.params.id);
      if (!result) {
        return res.status(404).json({ message: "Sprint not found" });
      }
      res.json({ 
        success: true, 
        sprint: result.sprint, 
        archivedCount: result.archivedCount,
        message: `Sprint closed. ${result.archivedCount} completed tasks archived.`
      });
    } catch (error) {
      console.error("Error closing sprint:", error);
      res.status(500).json({ message: "Failed to close sprint" });
    }
  });

  // ========================
  // Spaces API Routes
  // ========================

  app.get("/api/spaces", isAuthenticated, async (req, res) => {
    try {
      const spacesList = await storage.getAllSpaces();
      res.json(spacesList);
    } catch (error) {
      console.error("Error fetching spaces:", error);
      res.status(500).json({ message: "Failed to fetch spaces" });
    }
  });

  app.get("/api/spaces/hierarchy", isAuthenticated, async (req, res) => {
    try {
      const viewType = req.query.viewType as string | undefined;
      const currentUser = (req as any).managedUser;
      const hierarchy = await storage.getSpacesWithHierarchy(viewType, currentUser?.id);
      res.json(hierarchy);
    } catch (error) {
      console.error("Error fetching hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch hierarchy" });
    }
  });

  app.post("/api/spaces", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser;
      const data = insertSpaceSchema.parse({ ...req.body, ownerId: currentUser.id });
      const space = await storage.createSpace(data);
      res.status(201).json(space);
    } catch (error) {
      console.error("Error creating space:", error);
      res.status(500).json({ message: "Failed to create space" });
    }
  });

  app.patch("/api/spaces/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser;
      const space = await storage.getSpace(req.params.id);
      if (!space) return res.status(404).json({ message: "Space not found" });
      const isOwner = space.ownerId === currentUser.id;
      const isAdminUser = currentUser.role === "admin" || currentUser.role === "superadmin";
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateSpace(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating space:", error);
      res.status(500).json({ message: "Failed to update space" });
    }
  });

  app.delete("/api/spaces/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser;
      const space = await storage.getSpace(req.params.id);
      if (!space) return res.status(404).json({ message: "Space not found" });
      const isOwner = space.ownerId === currentUser.id;
      const isAdminUser = currentUser.role === "admin" || currentUser.role === "superadmin";
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" });
      const deleted = await storage.deleteSpace(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Space not found" });
      res.json({ message: "Space deleted" });
    } catch (error) {
      console.error("Error deleting space:", error);
      res.status(500).json({ message: "Failed to delete space" });
    }
  });

  // Space members endpoints
  app.get("/api/spaces/:id/members", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser;
      const space = await storage.getSpace(req.params.id);
      if (!space) return res.status(404).json({ message: "Space not found" });
      const isOwner = space.ownerId === currentUser.id;
      const isAdminUser = currentUser.role === "admin" || currentUser.role === "superadmin";
      const isMember = !isOwner && !isAdminUser ? await storage.isSpaceMember(req.params.id, currentUser.id) : false;
      if (!isOwner && !isAdminUser && !isMember) return res.status(403).json({ message: "Forbidden" });
      const members = await storage.getSpaceMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching space members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.post("/api/spaces/:id/members", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser;
      const space = await storage.getSpace(req.params.id);
      if (!space) return res.status(404).json({ message: "Space not found" });
      const isOwner = space.ownerId === currentUser.id;
      const isAdminUser = currentUser.role === "admin" || currentUser.role === "superadmin";
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" });
      const parsed = z.object({ userId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "userId is required" });
      const { userId } = parsed.data;
      if (userId === space.ownerId) return res.status(400).json({ message: "Owner is already the creator" });
      const targetUser = await storage.getManagedUser(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      const member = await storage.addSpaceMember(req.params.id, userId);
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding space member:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/spaces/:id/members/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).managedUser;
      const space = await storage.getSpace(req.params.id);
      if (!space) return res.status(404).json({ message: "Space not found" });
      const isOwner = space.ownerId === currentUser.id;
      const isAdminUser = currentUser.role === "admin" || currentUser.role === "superadmin";
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" });
      await storage.removeSpaceMember(req.params.id, req.params.userId);
      res.json({ message: "Member removed" });
    } catch (error) {
      console.error("Error removing space member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // ========================
  // Project Groups API Routes
  // ========================

  app.get("/api/project-groups", isAuthenticated, async (req, res) => {
    try {
      const { spaceId } = req.query;
      const groups = await storage.getAllProjectGroups(spaceId as string | undefined);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching project groups:", error);
      res.status(500).json({ message: "Failed to fetch project groups" });
    }
  });

  app.post("/api/project-groups", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      const data = insertProjectGroupSchema.parse({
        ...req.body,
        createdBy: managedUser.id,
      });
      const group = await storage.createProjectGroup(data);
      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating project group:", error);
      res.status(500).json({ message: "Failed to create project group" });
    }
  });

  app.patch("/api/project-groups/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const group = await storage.updateProjectGroup(req.params.id, req.body);
      if (!group) return res.status(404).json({ message: "Project group not found" });
      res.json(group);
    } catch (error) {
      console.error("Error updating project group:", error);
      res.status(500).json({ message: "Failed to update project group" });
    }
  });

  app.delete("/api/project-groups/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteProjectGroup(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Project group not found" });
      res.json({ message: "Project group deleted" });
    } catch (error) {
      console.error("Error deleting project group:", error);
      res.status(500).json({ message: "Failed to delete project group" });
    }
  });

  // ========================
  // Projects API Routes
  // ========================
  
  // Get all projects
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const { status, mine } = req.query;
      const managedUser = (req as any).managedUser as ManagedUser;
      
      let projectList;
      if (mine === "true" && managedUser) {
        projectList = await storage.getProjectsByUser(managedUser.id);
      } else {
        projectList = await storage.getAllProjects({ 
          status: status as string | undefined 
        });
      }
      
      // Fetch assignments with user data for each project
      const projectsWithAssignments = await Promise.all(
        projectList.map(async (project) => {
          const assignments = await storage.getProjectAssignments(project.id);
          const assignmentsWithUsers = await Promise.all(
            assignments.map(async (assignment) => {
              const user = await storage.getManagedUser(assignment.userId);
              return { ...assignment, user };
            })
          );
          const ownerUser = project.ownerUserId ? await storage.getManagedUser(project.ownerUserId) : null;
          const createdByUser = project.createdBy ? await storage.getManagedUser(project.createdBy) : null;
          return { ...project, assignments: assignmentsWithUsers, ownerUser, createdByUser };
        })
      );
      
      res.json(projectsWithAssignments);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get project by ID with full details
  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProjectWithAssignments(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Create new project
  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      
      // Normalize empty strings to null for date fields
      const bodyData = { ...req.body };
      if (bodyData.startDate === "") bodyData.startDate = null;
      if (bodyData.deadline === "") bodyData.deadline = null;
      // Default owner to creator if not specified
      if (!bodyData.ownerUserId) bodyData.ownerUserId = managedUser.id;
      
      const data = insertProjectSchema.parse({
        ...bodyData,
        createdBy: managedUser.id
      });
      const project = await storage.createProject(data);
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Update project
  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      
      // Others role cannot edit projects
      if (managedUser.role === "others") {
        return res.status(403).json({ message: "Insufficient permissions to edit projects" });
      }
      
      const existing = await storage.getProject(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user is owner, admin/superadmin, or assigned to project
      const assignments = await storage.getProjectAssignments(req.params.id);
      const isOwner = assignments.some(a => a.userId === managedUser.id && a.role === "owner");
      const isAdminRole = managedUser.role === "admin" || managedUser.role === "superadmin";
      const isAssigned = assignments.some(a => a.userId === managedUser.id);
      
      if (!isOwner && !isAdminRole && !isAssigned) {
        return res.status(403).json({ message: "You don't have permission to update this project" });
      }
      
      // Normalize empty strings to null for date fields
      const data = { ...req.body };
      if (data.startDate === "") data.startDate = null;
      if (data.deadline === "") data.deadline = null;
      
      const updated = await storage.updateProject(req.params.id, data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const existing = await storage.getProject(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Project not found" });
      }
      await storage.deleteProject(req.params.id);
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Add assignment to project
  app.post("/api/projects/:id/assignments", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      
      // Check if user can assign (must be owner, admin, or already assigned)
      const assignments = await storage.getProjectAssignments(req.params.id);
      const isOwner = assignments.some(a => a.userId === managedUser.id && a.role === "owner");
      const isAdmin = managedUser.role === "admin";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Only project owners or admins can assign users" });
      }
      
      const data = insertProjectAssignmentSchema.parse({
        ...req.body,
        projectId: req.params.id,
        assignedBy: managedUser.id
      });
      const assignment = await storage.createProjectAssignment(data);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  // Remove assignment from project
  app.delete("/api/projects/:projectId/assignments/:id", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      
      // Check if user can remove assignments (must be owner or admin)
      const assignments = await storage.getProjectAssignments(req.params.projectId);
      const isOwner = assignments.some(a => a.userId === managedUser.id && a.role === "owner");
      const isAdmin = managedUser.role === "admin";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Only project owners or admins can remove assignments" });
      }
      
      await storage.deleteProjectAssignment(req.params.id);
      res.json({ message: "Assignment removed successfully" });
    } catch (error) {
      console.error("Error removing assignment:", error);
      res.status(500).json({ message: "Failed to remove assignment" });
    }
  });

  // Get project comments
  app.get("/api/projects/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const comments = await storage.getProjectComments(req.params.id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Add comment to project
  app.post("/api/projects/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const managedUser = (req as any).managedUser as ManagedUser;
      
      // Others role cannot comment
      if (managedUser.role === "others") {
        return res.status(403).json({ message: "Insufficient permissions to add comments" });
      }
      
      const data = insertProjectCommentSchema.parse({
        ...req.body,
        projectId: req.params.id,
        userId: managedUser.id,
        userName: managedUser.firstName && managedUser.lastName 
          ? `${managedUser.firstName} ${managedUser.lastName}` 
          : managedUser.username
      });
      const comment = await storage.createProjectComment(data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Get all users (for assignment dropdown)
  app.get("/api/users/list", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllManagedUsers();
      const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // ===== SECTION TEMPLATES (Admin only) =====

  app.get("/api/admin/section-templates", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const templates = await storage.getAllSectionTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching section templates:", error);
      res.status(500).json({ message: "Failed to fetch section templates" });
    }
  });

  app.post("/api/admin/section-templates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = insertSectionTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const template = await storage.createSectionTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating section template:", error);
      res.status(500).json({ message: "Failed to create section template" });
    }
  });

  app.patch("/api/admin/section-templates/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = insertSectionTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const template = await storage.updateSectionTemplate(req.params.id, parsed.data);
      if (!template) {
        return res.status(404).json({ message: "Section template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating section template:", error);
      res.status(500).json({ message: "Failed to update section template" });
    }
  });

  app.delete("/api/admin/section-templates/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSectionTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Section template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting section template:", error);
      res.status(500).json({ message: "Failed to delete section template" });
    }
  });

  // ===== PAGE SECTIONS =====

  app.get("/api/services/:serviceId/sections", isAuthenticated, async (req, res) => {
    try {
      const sections = await storage.getPageSectionsByService(req.params.serviceId);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching page sections:", error);
      res.status(500).json({ message: "Failed to fetch page sections" });
    }
  });

  app.post("/api/admin/services/:serviceId/sections", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = { ...req.body, serviceId: req.params.serviceId };

      if (data.sectionTemplateId) {
        const template = await storage.getSectionTemplate(data.sectionTemplateId);
        if (template) {
          if (!data.icon && template.icon) {
            data.icon = template.icon;
          }
          if (!data.config && template.defaultConfig) {
            data.config = template.defaultConfig;
          }
        }
      }

      const parsed = insertPageSectionSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const section = await storage.createPageSection(parsed.data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating page section:", error);
      res.status(500).json({ message: "Failed to create page section" });
    }
  });

  app.patch("/api/admin/sections/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = { ...req.body };

      if (data.sectionTemplateId) {
        const template = await storage.getSectionTemplate(data.sectionTemplateId);
        if (template) {
          if (!data.icon && template.icon) {
            data.icon = template.icon;
          }
          if (!data.config && template.defaultConfig) {
            data.config = template.defaultConfig;
          }
        }
      }

      const parsed = insertPageSectionSchema.partial().safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      const section = await storage.updatePageSection(req.params.id, parsed.data);
      if (!section) {
        return res.status(404).json({ message: "Page section not found" });
      }
      res.json(section);
    } catch (error) {
      console.error("Error updating page section:", error);
      res.status(500).json({ message: "Failed to update page section" });
    }
  });

  app.delete("/api/admin/sections/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deletePageSection(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Page section not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting page section:", error);
      res.status(500).json({ message: "Failed to delete page section" });
    }
  });

  app.put("/api/admin/services/:serviceId/sections/reorder", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const schema = z.object({ sectionIds: z.array(z.string()) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }
      await storage.reorderPageSections(req.params.serviceId, parsed.data.sectionIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering page sections:", error);
      res.status(500).json({ message: "Failed to reorder page sections" });
    }
  });

  // Icon Library endpoints
  app.get("/api/icons", isAuthenticated, async (_req, res) => {
    try {
      const icons = await storage.getAllIcons();
      res.json(icons);
    } catch (error) {
      console.error("Error fetching icons:", error);
      res.status(500).json({ message: "Failed to fetch icons" });
    }
  });

  app.post("/api/admin/icons", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, label, category, description } = req.body;
      if (!name || !label) {
        return res.status(400).json({ message: "Name and label are required" });
      }
      const existing = await storage.getIconByName(name);
      if (existing) {
        return res.status(409).json({ message: "An icon with this name already exists in the library" });
      }
      const icon = await storage.createIcon({
        name,
        label,
        category: category || "custom",
        description: description || null,
        isCustom: true,
      });
      res.status(201).json(icon);
    } catch (error) {
      console.error("Error creating icon:", error);
      res.status(500).json({ message: "Failed to create icon" });
    }
  });

  app.delete("/api/admin/icons/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteIcon(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Icon not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting icon:", error);
      res.status(500).json({ message: "Failed to delete icon" });
    }
  });
}
