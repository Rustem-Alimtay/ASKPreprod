import { db } from "@workspace/db";
import { externalServices, iconLibrary, spaces, projectGroups, projects, projectAssignments, managedUsers, sectionTemplates, pageSections, dataSources, dsRecords } from "@workspace/db";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import path from "path";

const defaultServices = [
  {
    name: "Business Units",
    description: null,
    url: "/business-units",
    icon: "Building2",
    category: "general",
    isEnabled: true,
    isExternal: false,
    sortOrder: "1",
  },
  {
    name: "Customer DB",
    description: null,
    url: "/applications/customer-db",
    icon: "Contact",
    category: "general",
    isEnabled: true,
    isExternal: false,
    sortOrder: "2",
  },
  {
    name: "Projects",
    description: null,
    url: "/projects",
    icon: "FolderKanban",
    category: "general",
    isEnabled: true,
    isExternal: false,
    sortOrder: "3",
  },
  {
    name: "HRMS",
    description: null,
    url: "/hr",
    icon: "Users",
    category: "hr",
    isEnabled: true,
    isExternal: false,
    sortOrder: "4",
  },
  {
    name: "ERP",
    description: null,
    url: "/erp",
    icon: "DollarSign",
    category: "finance",
    isEnabled: true,
    isExternal: false,
    sortOrder: "5",
  },
  {
    name: "Asset and Lease Management",
    description: null,
    url: "/asset-lease",
    icon: "Store",
    category: "operations",
    isEnabled: true,
    isExternal: false,
    sortOrder: "6",
  },
  {
    name: "Events & Entertainment",
    description: null,
    url: "/events",
    icon: "PartyPopper",
    category: "marketing",
    isEnabled: true,
    isExternal: false,
    sortOrder: "8",
  },
  {
    name: "Media & Marketing",
    description: null,
    url: "/media-marketing",
    icon: "Megaphone",
    category: "marketing",
    isEnabled: true,
    isExternal: false,
    sortOrder: "9",
  },
  {
    name: "AKS Request Center",
    description: null,
    url: "/intranet",
    icon: "Headphones",
    category: "general",
    isEnabled: true,
    isExternal: false,
    sortOrder: "10",
  },
  {
    name: "Legal",
    description: null,
    url: "/legal",
    icon: "Scale",
    category: "general",
    isEnabled: true,
    isExternal: false,
    sortOrder: "11",
  },
  {
    name: "Performance & KPIs",
    description: null,
    url: "/performance-kpi",
    icon: "Target",
    category: "operations",
    isEnabled: true,
    isExternal: false,
    sortOrder: "12",
  },
  {
    name: "OPS & FM",
    description: null,
    url: "/ops-fm",
    icon: "Wrench",
    category: "operations",
    isEnabled: true,
    isExternal: false,
    sortOrder: "13",
  },
  {
    name: "IT Service Desk",
    description: null,
    url: "/it-dt",
    icon: "MonitorCog",
    category: "general",
    isEnabled: true,
    isExternal: false,
    sortOrder: "14",
  },
];

const defaultIcons = [
  { name: "Store", label: "Store", category: "business", description: "Retail store / shop front" },
  { name: "Building2", label: "Building", category: "business", description: "Office building / organization" },
  { name: "Contact", label: "Contact", category: "communication", description: "Contact card / person details" },
  { name: "Headphones", label: "Headphones", category: "communication", description: "Audio headset / support" },
  { name: "DollarSign", label: "Dollar Sign", category: "finance", description: "Currency / financial" },
  { name: "CircleDot", label: "Circle Dot", category: "general", description: "Target point / marker" },
  { name: "PartyPopper", label: "Party Popper", category: "events", description: "Celebration / events" },
  { name: "Users", label: "Users", category: "people", description: "Group of people / team" },
  { name: "Scale", label: "Scale", category: "legal", description: "Legal scales / justice" },
  { name: "Megaphone", label: "Megaphone", category: "communication", description: "Announcements / marketing" },
  { name: "Wrench", label: "Wrench", category: "operations", description: "Tool / maintenance" },
  { name: "Target", label: "Target", category: "general", description: "Goal / KPI target" },
  { name: "FolderKanban", label: "Folder Kanban", category: "general", description: "Project boards / kanban view" },
  { name: "Globe", label: "Globe", category: "general", description: "World / internet / global" },
  { name: "Shield", label: "Shield", category: "security", description: "Security / protection" },
  { name: "BarChart3", label: "Bar Chart", category: "analytics", description: "Charts / analytics / data" },
  { name: "Truck", label: "Truck", category: "logistics", description: "Delivery / logistics / shipping" },
  { name: "Heart", label: "Heart", category: "general", description: "Health / wellness / favorite" },
  { name: "Briefcase", label: "Briefcase", category: "business", description: "Business / portfolio / work" },
  { name: "Cpu", label: "CPU", category: "technology", description: "Technology / computing / hardware" },
  { name: "Database", label: "Database", category: "technology", description: "Data storage / database" },
  { name: "Landmark", label: "Landmark", category: "business", description: "Banking / government / institution" },
  { name: "Palette", label: "Palette", category: "creative", description: "Design / art / creative" },
  { name: "Rocket", label: "Rocket", category: "general", description: "Launch / startup / speed" },
  { name: "Zap", label: "Zap", category: "general", description: "Energy / electric / fast" },
  { name: "Calendar", label: "Calendar", category: "general", description: "Scheduling / dates / calendar" },
  { name: "MapPin", label: "Map Pin", category: "general", description: "Location / map / places" },
  { name: "Award", label: "Award", category: "general", description: "Achievement / award / recognition" },
  { name: "BookOpen", label: "Book Open", category: "education", description: "Education / documentation / reading" },
];

export async function seedSpacesAndProjects() {
  try {
    const existingSpaces = await db.select().from(spaces);
    if (existingSpaces.length > 0) {
      console.log(`Spaces already exist (${existingSpaces.length} spaces)`);
      return;
    }

    console.log("Seeding spaces, projects, and sample tasks...");

    const adminUsers = await db.select().from(managedUsers);
    const adminId = adminUsers[0]?.id;
    if (!adminId) {
      console.log("No admin user found, skipping spaces seed");
      return;
    }

    const [itSpace] = await db.insert(spaces).values({
      name: "IT & Digital",
      description: "Information Technology and Digital Transformation department",
      color: "#3b82f6",
      ownerId: adminId,
    }).returning();

    const [opsSpace] = await db.insert(spaces).values({
      name: "Operations",
      description: "Operations and Facility Management department",
      color: "#10b981",
      ownerId: adminId,
    }).returning();

    const [hrSpace] = await db.insert(spaces).values({
      name: "HR & Admin",
      description: "Human Resources and Administration",
      color: "#f59e0b",
      ownerId: adminId,
    }).returning();

    const [portalProject] = await db.insert(projectGroups).values({
      name: "Unified Portal",
      description: "Enterprise portal development and rollout",
      spaceId: itSpace.id,
      color: "#6366f1",
      status: "active",
      startDate: "2026-01-15",
      endDate: "2026-06-30",
      createdBy: adminId,
    }).returning();

    const [infraProject] = await db.insert(projectGroups).values({
      name: "Infrastructure Upgrade",
      description: "Network and server infrastructure modernization",
      spaceId: itSpace.id,
      color: "#0ea5e9",
      status: "active",
      startDate: "2026-02-01",
      endDate: "2026-05-31",
      createdBy: adminId,
    }).returning();

    const [facilityProject] = await db.insert(projectGroups).values({
      name: "Facility Renovation Q1",
      description: "Building and facility renovation plan",
      spaceId: opsSpace.id,
      color: "#22c55e",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      createdBy: adminId,
    }).returning();

    const [onboardingProject] = await db.insert(projectGroups).values({
      name: "Employee Onboarding 2026",
      description: "Streamline onboarding processes for new hires",
      spaceId: hrSpace.id,
      color: "#eab308",
      status: "active",
      startDate: "2026-01-10",
      endDate: "2026-04-30",
      createdBy: adminId,
    }).returning();

    const sampleTasks = [
      { name: "Design dashboard layout", projectGroupId: portalProject.id, status: "completed", priority: "high", deadline: "2026-02-10", description: "Create wireframes and mockups for the main dashboard" },
      { name: "Implement authentication system", projectGroupId: portalProject.id, status: "completed", priority: "critical", deadline: "2026-02-15", description: "Set up user login, roles, and session management" },
      { name: "Build section management UI", projectGroupId: portalProject.id, status: "in_progress", priority: "high", deadline: "2026-03-01", description: "Admin interface for managing service page sections" },
      { name: "Integrate Power BI reports", projectGroupId: portalProject.id, status: "not_started", priority: "medium", deadline: "2026-03-15", description: "Embed Power BI dashboards into the portal" },
      { name: "User acceptance testing", projectGroupId: portalProject.id, status: "not_started", priority: "high", deadline: "2026-04-01", description: "Conduct UAT with key stakeholders" },
      { name: "Migrate to new firewall", projectGroupId: infraProject.id, status: "in_progress", priority: "critical", deadline: "2026-03-01", description: "Replace legacy firewall with next-gen solution" },
      { name: "Set up monitoring system", projectGroupId: infraProject.id, status: "not_started", priority: "high", deadline: "2026-03-15", description: "Deploy Grafana/Prometheus monitoring stack" },
      { name: "Server room cooling upgrade", projectGroupId: infraProject.id, status: "on_hold", priority: "medium", deadline: "2026-04-01", description: "Install new HVAC for server room" },
      { name: "Lobby renovation", projectGroupId: facilityProject.id, status: "in_progress", priority: "medium", deadline: "2026-02-28", description: "Redesign and renovate main lobby area" },
      { name: "HVAC maintenance schedule", projectGroupId: facilityProject.id, status: "completed", priority: "low", deadline: "2026-02-01", description: "Create quarterly HVAC maintenance plan" },
      { name: "Security camera upgrade", projectGroupId: facilityProject.id, status: "not_started", priority: "high", deadline: "2026-03-15", description: "Replace outdated CCTV system" },
      { name: "Create onboarding checklist", projectGroupId: onboardingProject.id, status: "completed", priority: "high", deadline: "2026-01-31", description: "Define standard onboarding checklist for all departments" },
      { name: "Setup digital signatures", projectGroupId: onboardingProject.id, status: "in_progress", priority: "medium", deadline: "2026-02-28", description: "Implement DocuSign for HR documents" },
      { name: "Training materials update", projectGroupId: onboardingProject.id, status: "not_started", priority: "low", deadline: "2026-03-31", description: "Update employee training materials for 2026" },
    ];

    for (const task of sampleTasks) {
      const [created] = await db.insert(projects).values({
        ...task,
        createdBy: adminId,
        startDate: "2026-01-15",
      }).returning();

      await db.insert(projectAssignments).values({
        projectId: created.id,
        userId: adminId,
        role: "owner",
        assignedBy: adminId,
      });
    }

    console.log(`Seeded 3 spaces, 4 project groups, and ${sampleTasks.length} sample tasks`);
  } catch (error) {
    console.error("Failed to seed spaces and projects:", error);
  }
}

const defaultSectionTemplates = [
  { name: "Hero Banner", description: "Hero section with gradient background and key stats", sectionType: "hero_banner", icon: "Image", defaultConfig: JSON.stringify({ stats: [{ label: "Total", value: "0" }, { label: "Active", value: "0" }, { label: "Pending", value: "0" }], gradient: "from-primary/10 to-primary/5", showStats: true }) },
  { name: "Data Table", description: "Tabular data display with sorting/filtering", sectionType: "data_table", icon: "Table" },
  { name: "Module Cards", description: "Grid of clickable module/service cards", sectionType: "cards_grid", icon: "LayoutGrid" },
  { name: "Metrics Dashboard", description: "Row of key metrics/KPI cards", sectionType: "metrics_row", icon: "BarChart3" },
  { name: "Iframe Embed", description: "Embedded external application or Power BI", sectionType: "iframe_embed", icon: "Monitor" },
  { name: "Activity Feed", description: "Chronological activity/event feed", sectionType: "activity_feed", icon: "Activity" },
  { name: "Quick Links", description: "Grid of quick action buttons", sectionType: "quick_links", icon: "Link" },
  { name: "Reports List", description: "List of report links or quick actions", sectionType: "list", icon: "FileText" },
  { name: "Alerts Panel", description: "Priority-based alerts and notifications", sectionType: "list", icon: "AlertTriangle" },
  { name: "Categories Grid", description: "Category cards with counts and icons", sectionType: "cards_grid", icon: "Grid" },
  { name: "Status Monitor", description: "System/service status indicators", sectionType: "cards_grid", icon: "Monitor" },
  { name: "Tabs Layout", description: "Tabbed content sections", sectionType: "tabs", icon: "Layers" },
  { name: "Communications Hub", description: "Communication channel cards", sectionType: "cards_grid", icon: "MessageCircle" },
];

interface ServiceSectionDef {
  serviceUrl: string;
  sections: Array<{
    title: string;
    subtitle?: string;
    icon: string;
    sortOrder: number;
    isEnabled: boolean;
    isExpandable: boolean;
    templateType: string;
    config?: string;
  }>;
}

const defaultServiceSections: ServiceSectionDef[] = [
  {
    serviceUrl: "/business-units",
    sections: [
      { title: "Business Units Overview", icon: "Building2", sortOrder: 0, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
    ],
  },
  {
    serviceUrl: "/erp",
    sections: [
      { title: "Hero Banner", icon: "DollarSign", sortOrder: 0, isEnabled: true, isExpandable: false, templateType: "hero_banner" },
      { title: "Finance Modules", icon: "DollarSign", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "tabs" },
      { title: "Other Finance Modules", icon: "CreditCard", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
    ],
  },
  {
    serviceUrl: "/hr",
    sections: [
      { title: "HR Overview", icon: "Users", sortOrder: 0, isEnabled: true, isExpandable: false, templateType: "hero_banner" },
      { title: "HR Modules", icon: "Users", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Recent Activity", icon: "Activity", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "activity_feed" },
      { title: "Reports & Analytics", icon: "BarChart3", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "list" },
    ],
  },
  {
    serviceUrl: "/asset-lease",
    sections: [
      { title: "Property Overview", icon: "Store", sortOrder: 0, isEnabled: true, isExpandable: false, templateType: "hero_banner" },
      { title: "Assets & Leases", icon: "Store", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Lease Renewals", icon: "Calendar", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Reports & Analytics", icon: "BarChart3", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "list" },
    ],
  },
  {
    serviceUrl: "/events",
    sections: [
      { title: "Events Overview", icon: "PartyPopper", sortOrder: 0, isEnabled: true, isExpandable: false, templateType: "hero_banner" },
      { title: "Upcoming Events", icon: "Calendar", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Communication Channels", icon: "MessageCircle", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Message Templates", icon: "FileText", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Campaign Management", icon: "Send", sortOrder: 4, isEnabled: true, isExpandable: true, templateType: "data_table" },
    ],
  },
  {
    serviceUrl: "/media-marketing",
    sections: [
      { title: "External Services", icon: "Globe", sortOrder: 0, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Media Production", icon: "Video", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Brand Assets", icon: "FolderOpen", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Reports & Downloads", icon: "Download", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "list" },
    ],
  },
  {
    serviceUrl: "/legal",
    sections: [
      { title: "Legal Overview", icon: "Scale", sortOrder: 0, isEnabled: true, isExpandable: false, templateType: "hero_banner" },
      { title: "Document Categories", icon: "FileText", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Recent Documents", icon: "FileText", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Compliance Alerts", icon: "AlertTriangle", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "list" },
      { title: "Quick Links", icon: "Link", sortOrder: 4, isEnabled: true, isExpandable: true, templateType: "quick_links" },
    ],
  },
  {
    serviceUrl: "/performance-kpi",
    sections: [
      { title: "KPI Categories", icon: "Target", sortOrder: 0, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Key Metrics", icon: "BarChart3", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "metrics_row" },
      { title: "Performance Alerts", icon: "AlertTriangle", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "list" },
      { title: "Quick Reports", icon: "FileText", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "quick_links" },
    ],
  },
  {
    serviceUrl: "/ops-fm",
    sections: [
      { title: "Facility Stats", icon: "Building", sortOrder: 0, isEnabled: true, isExpandable: true, templateType: "metrics_row" },
      { title: "FM Categories", icon: "Wrench", sortOrder: 1, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
      { title: "Active Work Orders", icon: "ClipboardCheck", sortOrder: 2, isEnabled: true, isExpandable: true, templateType: "data_table" },
      { title: "Utility Monitoring", icon: "Zap", sortOrder: 3, isEnabled: true, isExpandable: true, templateType: "cards_grid" },
    ],
  },
];

export async function seedSectionTemplatesAndPages() {
  try {
    const existingTemplates = await db.select().from(sectionTemplates);
    if (existingTemplates.length === 0) {
      console.log("Seeding section templates...");
      for (const template of defaultSectionTemplates) {
        await db.insert(sectionTemplates).values({
          name: template.name,
          description: template.description,
          sectionType: template.sectionType,
          icon: template.icon,
          defaultConfig: template.defaultConfig || null,
          isEnabled: true,
        });
      }
      console.log(`Seeded ${defaultSectionTemplates.length} section templates`);
    } else {
      console.log(`Section templates already exist (${existingTemplates.length} templates)`);
    }

    const existingPageSections = await db.select().from(pageSections);
    if (existingPageSections.length === 0) {
      console.log("Seeding page sections...");
      const allServices = await db.select().from(externalServices);
      const allTemplates = await db.select().from(sectionTemplates);
      let sectionCount = 0;

      for (const def of defaultServiceSections) {
        const service = allServices.find((s) => s.url === def.serviceUrl);
        if (!service) continue;

        for (const sec of def.sections) {
          const template = allTemplates.find((t) => t.sectionType === sec.templateType);
          await db.insert(pageSections).values({
            serviceId: service.id,
            sectionTemplateId: template?.id || null,
            title: sec.title,
            subtitle: sec.subtitle || null,
            icon: sec.icon,
            sortOrder: sec.sortOrder,
            isEnabled: sec.isEnabled,
            isExpandable: sec.isExpandable,
            config: sec.config || null,
          });
          sectionCount++;
        }
      }
      console.log(`Seeded ${sectionCount} page sections`);
    } else {
      console.log(`Page sections already exist (${existingPageSections.length} sections)`);
    }
  } catch (error) {
    console.error("Failed to seed section templates and pages:", error);
  }
}

export async function seedExternalServices() {
  try {
    const existingServices = await db.select().from(externalServices);
    
    const dtSupportService = existingServices.find(s => s.name === "DT Support" && s.url === "/intranet");
    if (dtSupportService) {
      await db.update(externalServices).set({ name: "AKS Request Center" }).where(eq(externalServices.id, dtSupportService.id));
      console.log("Renamed 'DT Support' to 'AKS Request Center'");
    }

    const itDtService = existingServices.find(s => s.name === "IT & DT" && s.url === "/it-dt");
    if (itDtService) {
      await db.update(externalServices).set({ name: "IT Service Desk" }).where(eq(externalServices.id, itDtService.id));
      console.log("Renamed 'IT & DT' to 'IT Service Desk'");
    }

    // Ensure IT Service Desk exists (may be missing in older environments)
    const itServiceDesk = existingServices.find(s => s.url === "/it-dt");
    if (!itServiceDesk && existingServices.length > 0) {
      await db.insert(externalServices).values({
        name: "IT Service Desk",
        description: null,
        url: "/it-dt",
        icon: "MonitorCog",
        category: "general",
        isEnabled: true,
        isExternal: false,
        sortOrder: "14",
      });
      console.log("Added missing 'IT Service Desk' service");
    }

    if (existingServices.length > 0) {
      console.log(`External services already exist (${existingServices.length} services)`);
    } else {
      console.log("Seeding external services...");
      for (const service of defaultServices) {
        await db.insert(externalServices).values(service);
      }
      console.log(`Seeded ${defaultServices.length} external services`);
    }

    const existingIcons = await db.select().from(iconLibrary);
    if (existingIcons.length === 0) {
      console.log("Seeding icon library...");
      for (const icon of defaultIcons) {
        await db.insert(iconLibrary).values({ ...icon, isCustom: false });
      }
      console.log(`Seeded ${defaultIcons.length} icons`);
    } else {
      console.log(`Icon library already exists (${existingIcons.length} icons)`);
    }

    await seedSectionTemplatesAndPages();
  } catch (error) {
    console.error("Failed to seed external services:", error);
  }
}

const DATA_SOURCE_COLUMNS: Record<string, { key: string; label: string; type: string }[]> = {
  "pony-camp": [
    { key: "name", label: "Name", type: "text" },
    { key: "rider_fn", label: "Rider FN", type: "text" },
    { key: "rider_ln", label: "Rider LN", type: "text" },
    { key: "form_submitted", label: "Form Submitted", type: "text" },
    { key: "parent_fn", label: "Parent FN", type: "text" },
    { key: "parent_ln", label: "Parent LN", type: "text" },
    { key: "relationship", label: "Relationship", type: "text" },
    { key: "parent_ph_no", label: "Parent Ph No", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "dob", label: "DOB", type: "text" },
    { key: "gender", label: "Gender", type: "text" },
    { key: "nationality", label: "Nationality", type: "text" },
    { key: "source_file", label: "Source File", type: "text" },
  ],
  "contact-form": [
    { key: "name", label: "Name", type: "text" },
    { key: "contact_in", label: "Contact In", type: "text" },
    { key: "company", label: "Company", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "department", label: "Department", type: "text" },
    { key: "message", label: "Message", type: "text" },
    { key: "form_submission", label: "Form submission", type: "text" },
  ],
  "calls": [
    { key: "name", label: "Name", type: "text" },
    { key: "last_name", label: "Last Name", type: "text" },
    { key: "company", label: "Company", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "department", label: "Department", type: "text" },
    { key: "message", label: "Message", type: "text" },
    { key: "call_date", label: "Call date", type: "text" },
  ],
  "employee-directory": [
    { key: "employee_code", label: "Employee Code", type: "number" },
    { key: "full_name", label: "Full Name", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "position", label: "Position", type: "text" },
    { key: "department_english", label: "Department ( English )", type: "text" },
    { key: "sub_department_english", label: "Sub Department ( English )", type: "text" },
    { key: "section_english", label: "Section ( English )", type: "text" },
    { key: "cost_center", label: "Cost Center", type: "text" },
    { key: "cost_center_account_number", label: "Cost Center - Account Number", type: "number" },
    { key: "account", label: "Account", type: "boolean" },
    { key: "direct_manager_code", label: "Direct Manager - Code", type: "text" },
    { key: "direct_manager_full_name", label: "Direct Manager - Full Name", type: "text" },
    { key: "department_head_code", label: "Department Head Code", type: "text" },
    { key: "department_head_full_name", label: "Department Head - Full Name", type: "text" },
  ],
};

const EMPLOYEE_EXCEL_COLUMN_MAP: Record<string, string> = {
  "Employee Code": "employee_code",
  "Full Name": "full_name",
  "Email": "email",
  "Phone": "phone",
  "Position": "position",
  "Department ( English ) ": "department_english",
  "Sub Department ( English ) ": "sub_department_english",
  "Section ( English ) ": "section_english",
  "Cost Center": "cost_center",
  "Cost Center - Account Number": "cost_center_account_number",
  "Direct Manager - Code": "direct_manager_code",
  "Direct Manager - Full Name": "direct_manager_full_name",
  "Department Head Code": "department_head_code",
  "Department Head  - Full Name": "department_head_full_name",
};

const NUMERIC_EMPLOYEE_KEYS = new Set(["employee_code", "cost_center_account_number"]);

async function loadEmployeeDataFromExcel(): Promise<Record<string, string | number | boolean | null>[]> {
  const filePath = path.resolve("attached_assets/Employees_Cost_Center_(1)_1774934982910.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const headerRow = ws.getRow(1);
  const headers: { col: number; value: string }[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers.push({ col: colNumber, value: String(cell.value).trim() });
  });

  const trimmedMap: Record<string, string> = {};
  for (const [excelHeader, key] of Object.entries(EMPLOYEE_EXCEL_COLUMN_MAP)) {
    trimmedMap[excelHeader.trim()] = key;
  }

  const rows: Record<string, string | number | boolean | null>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let hasValue = false;
    const data: Record<string, string | number | boolean | null> = {};

    for (const h of headers) {
      const targetKey = trimmedMap[h.value];
      if (!targetKey) continue;
      const cellValue = row.getCell(h.col).value;
      if (cellValue !== null && cellValue !== undefined && cellValue !== "") {
        if (NUMERIC_EMPLOYEE_KEYS.has(targetKey)) {
          const num = Number(cellValue);
          data[targetKey] = isNaN(num) ? String(cellValue) : num;
        } else {
          data[targetKey] = String(cellValue);
        }
        hasValue = true;
      } else {
        data[targetKey] = null;
      }
    }

    data["account"] = false;

    if (hasValue) {
      rows.push(data);
    }
  }
  return rows;
}

export async function seedDataSources() {
  try {
    const existing = await db.select().from(dataSources);
    if (existing.length === 0) {
      console.log("Seeding data sources...");
      await db.insert(dataSources).values([
        { name: "Pony Camp", slug: "pony-camp", icon: "Tent", color: "#f59e0b" },
        { name: "Contact Form", slug: "contact-form", icon: "FileText", color: "#3b82f6" },
        { name: "Calls", slug: "calls", icon: "Phone", color: "#10b981" },
        { name: "Livery Clients", slug: "livery-clients", icon: "Home", color: "#8b5cf6" },
        { name: "Riding Schools", slug: "riding-schools", icon: "GraduationCap", color: "#ef4444" },
        { name: "Therapeutic", slug: "therapeutic", icon: "Heart", color: "#ec4899" },
      ]);
      console.log("Data sources seeded (6 sources)");
    } else {
      console.log("Data sources already seeded");

      const employeeDir = existing.find(s => s.slug === "employee-directory");
      if (!employeeDir) {
        await db.insert(dataSources).values({
          name: "Employee Directory",
          slug: "employee-directory",
          icon: "Users",
          color: "#0ea5e9",
          columns: DATA_SOURCE_COLUMNS["employee-directory"],
        });
        console.log("Added Employee Directory data source");
      }
    }

    const allSources = await db.select().from(dataSources);
    for (const [slug, expectedCols] of Object.entries(DATA_SOURCE_COLUMNS)) {
      const source = allSources.find(s => s.slug === slug);
      if (!source) continue;

      const currentCols = (source.columns as { key: string; label: string; type: string }[]) || [];
      if (currentCols.length === 0) {
        await db.update(dataSources).set({ columns: expectedCols }).where(eq(dataSources.slug, slug));
        console.log(`Updated columns for ${slug} (${expectedCols.length} columns)`);
      } else {
        const existingKeys = new Set(currentCols.map(c => c.key));
        const newCols = expectedCols.filter(c => !existingKeys.has(c.key));
        if (newCols.length > 0) {
          const merged = [...currentCols, ...newCols];
          await db.update(dataSources).set({ columns: merged }).where(eq(dataSources.slug, slug));
          console.log(`Added ${newCols.length} new column(s) to ${slug}: ${newCols.map(c => c.label).join(", ")}`);
        }
      }
    }

    const empSource = allSources.find(s => s.slug === "employee-directory");
    if (empSource) {
      const currentEmpCols = (empSource.columns as { key: string; label: string; type: string }[]) || [];
      const hasNewCols = currentEmpCols.some(c => c.key === "department_head_code");
      const existingCount = await db.select({ id: dsRecords.id }).from(dsRecords).where(eq(dsRecords.dataSourceId, empSource.id));
      const needsImport = !hasNewCols || existingCount.length === 0;

      if (needsImport) {
        console.log("Replacing Employee Directory data from Excel...");
        try {
          const rows = await loadEmployeeDataFromExcel();
          await db.transaction(async (tx) => {
            await tx.delete(dsRecords).where(eq(dsRecords.dataSourceId, empSource.id));
            const batchSize = 100;
            for (let i = 0; i < rows.length; i += batchSize) {
              const batch = rows.slice(i, i + batchSize).map(data => ({
                dataSourceId: empSource.id,
                data,
              }));
              await tx.insert(dsRecords).values(batch);
            }
            await tx.update(dataSources).set({
              recordCount: rows.length,
              columns: DATA_SOURCE_COLUMNS["employee-directory"],
            }).where(eq(dataSources.id, empSource.id));
          });
          console.log(`Imported ${rows.length} Employee Directory records from Excel`);
        } catch (err) {
          console.error("Failed to import Employee Directory Excel data:", err);
        }
      }
    }
  } catch (error) {
    console.error("Failed to seed data sources:", error);
  }
}
