import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { getPlatformValue, maskSecret, setPlatformValue } from "../services/platform-ai-settings";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use((req, res, next) => {
  if (req.auth?.role !== "SUPER_ADMIN") {
    res.status(403).json({ message: "Super admin access required" });
    return;
  }
  next();
});

const tenantStatusSchema = z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]);
const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  status: tenantStatusSchema.default("TRIAL"),
  plan: z.string().min(1).default("Starter"),
  seats: z.number().int().positive().default(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1).default("Business"),
  adminLastName: z.string().min(1).default("Admin"),
});


const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  status: tenantStatusSchema.optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(8).optional(),
});
const tenantSettingsSchema = z.object({
  timezone: z.string().min(1),
  currency: z.string().min(3).max(3),
  locale: z.string().min(2),
  leadAssignment: z.enum(["manual", "round_robin"]),
  callerTracking: z.boolean(),
});
const membershipSchema = z.object({
  roleId: z.string().min(1).nullable().optional(),
  active: z.boolean().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});
const createMembershipSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  roleId: z.string().min(1).nullable().optional(),
});
const rolePermissionsSchema = z.object({ permissionIds: z.array(z.string()).default([]) });
const userUpdateSchema = z.object({ active: z.boolean() });
const platformSettingsSchema = z.object({
  platformName: z.string().min(2),
  supportEmail: z.string().email(),
  defaultPlan: z.string().min(1),
  defaultSeats: z.number().int().positive(),
  allowTrials: z.boolean(),
  trialDays: z.number().int().min(0).max(365),
  aiProvider: z.enum(["GROQ","OPENAI","GEMINI","ANTHROPIC"]).default("GROQ"),
  aiModel: z.string().min(1).default("openai/gpt-oss-120b"),
  aiApiKey: z.string().optional(),
  groqModel: z.string().optional(),
  groqApiKey: z.string().optional(),
  leadSearchProvider: z.enum(["SERPER","BRAVE","TAVILY","EXA"]).default("SERPER"),
  leadSearchApiKey: z.string().optional(),
});

async function audit(actorId: string, action: string, entity: string, entityId?: string, tenantId?: string, metadata?: object) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, tenantId, metadata } });
}

const updateSubscriptionSchema = z.object({
  plan: z.string().min(1),
  seats: z.number().int().positive(),
  status: z.enum(["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"]),
});

adminRouter.patch("/tenants/:id", async (req, res, next) => {
  try {
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid business", issues: parsed.error.issues }); return; }

    const { adminEmail, adminPassword, ...tenantData } = parsed.data;
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: tenantData });

    if (adminEmail || adminPassword) {
      const membership = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant.id, role: { name: "ADMIN" } },
        include: { user: true },
      });

      if (membership) {
        if (adminEmail && adminEmail !== membership.user.email) {
          const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
          if (existing && existing.id !== membership.userId) {
            res.status(409).json({ message: "That admin email is already used by another account" });
            return;
          }
        }
        await prisma.user.update({
          where: { id: membership.userId },
          data: {
            ...(adminEmail ? { email: adminEmail } : {}),
            ...(adminPassword ? { passwordHash: await bcrypt.hash(adminPassword, 12) } : {}),
          },
        });
      } else {
        if (!adminEmail || !adminPassword) {
          res.status(400).json({ message: "This business has no admin yet. Enter both admin email and password." });
          return;
        }
        const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existing) {
          res.status(409).json({ message: "That admin email is already used by another account" });
          return;
        }
        const permissions = await prisma.permission.findMany({
          where: { key: { not: "platform.manage" } },
          select: { id: true },
        });
        const role = await prisma.role.upsert({
          where: { tenantId_name: { tenantId: tenant.id, name: "ADMIN" } },
          update: {},
          create: {
            tenantId: tenant.id,
            name: "ADMIN",
            description: "ADMIN role",
            permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
          },
        });
        const user = await prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash: await bcrypt.hash(adminPassword, 12),
            firstName: tenant.name,
            lastName: "Admin",
          },
        });
        await prisma.tenantUser.create({
          data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
        });
      }
    }

    await audit(req.auth!.userId, "TENANT_UPDATED", "Tenant", tenant.id, tenant.id, {
      ...tenantData,
      adminEmail,
      adminPasswordUpdated: Boolean(adminPassword),
    });
    res.json({ data: tenant });
  } catch (error) { next(error); }
});

adminRouter.patch("/tenants/:id/subscription", async (req, res, next) => {
  try {
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid subscription", issues: parsed.error.issues }); return; }
    const subscription = await prisma.subscription.upsert({
      where: { tenantId: req.params.id },
      update: parsed.data,
      create: { tenantId: req.params.id, ...parsed.data },
    });
    await audit(req.auth!.userId, "SUBSCRIPTION_UPDATED", "Subscription", subscription.id, req.params.id, parsed.data);
    res.json({ data: subscription });
  } catch (error) { next(error); }
});

adminRouter.patch("/tenants/:tenantId/users/:membershipId", async (req, res, next) => {
  try {
    const parsed = membershipSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid membership", issues: parsed.error.issues }); return; }
    const membership = await prisma.tenantUser.findFirst({
      where: { id: req.params.membershipId, tenantId: req.params.tenantId },
      include: { user: true },
    });
    if (!membership) { res.status(404).json({ message: "Business user not found" }); return; }

    if (parsed.data.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: parsed.data.roleId, tenantId: req.params.tenantId },
      });
      if (!role) { res.status(400).json({ message: "Role does not belong to this business" }); return; }
    }

    if (parsed.data.email && parsed.data.email !== membership.user.email) {
      const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (existing && existing.id !== membership.userId) {
        res.status(409).json({ message: "That email is already used by another account" });
        return;
      }
    }

    if (parsed.data.roleId !== undefined) {
      await prisma.tenantUser.update({
        where: { id: membership.id },
        data: { roleId: parsed.data.roleId },
      });
    }

    const userData = {
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.email ? { email: parsed.data.email } : {}),
      ...(parsed.data.firstName ? { firstName: parsed.data.firstName } : {}),
      ...(parsed.data.lastName ? { lastName: parsed.data.lastName } : {}),
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 12) } : {}),
    };

    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: membership.userId }, data: userData });
    }

    await audit(req.auth!.userId, "MEMBERSHIP_UPDATED", "TenantUser", membership.id, req.params.tenantId, {
      ...parsed.data,
      password: parsed.data.password ? "[updated]" : undefined,
    });
    res.json({ data: { id: membership.id } });
  } catch (error) { next(error); }
});

adminRouter.patch("/tenants/:tenantId/roles/:roleId/permissions", async (req, res, next) => {
  try {
    const parsed = rolePermissionsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid permissions", issues: parsed.error.issues }); return; }
    const role = await prisma.role.findFirst({ where: { id: req.params.roleId, tenantId: req.params.tenantId } });
    if (!role) { res.status(404).json({ message: "Role not found" }); return; }
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: parsed.data.permissionIds.map(permissionId => ({ roleId: role.id, permissionId })), skipDuplicates: true }),
    ]);
    await audit(req.auth!.userId, "ROLE_PERMISSIONS_UPDATED", "Role", role.id, req.params.tenantId, { permissionIds: parsed.data.permissionIds });
    res.json({ data: { id: role.id } });
  } catch (error) { next(error); }
});

adminRouter.get("/tenants/:id/settings", async (req, res, next) => {
  try {
    const rows = await prisma.tenantSetting.findMany({ where: { tenantId: req.params.id } });
    const stored = Object.fromEntries(rows.map(row => [row.key, JSON.parse(row.value)]));
    res.json({ data: { timezone: "Africa/Addis_Ababa", currency: "ETB", locale: "en", leadAssignment: "manual", callerTracking: true, ...stored } });
  } catch (error) { next(error); }
});

adminRouter.put("/tenants/:id/settings", async (req, res, next) => {
  try {
    const parsed = tenantSettingsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid settings", issues: parsed.error.issues }); return; }
    await prisma.$transaction(Object.entries(parsed.data).map(([key, value]) => prisma.tenantSetting.upsert({ where: { tenantId_key: { tenantId: req.params.id, key } }, update: { value: JSON.stringify(value) }, create: { tenantId: req.params.id, key, value: JSON.stringify(value) } })));
    await audit(req.auth!.userId, "TENANT_SETTINGS_UPDATED", "TenantSetting", undefined, req.params.id, parsed.data);
    res.json({ data: parsed.data });
  } catch (error) { next(error); }
});

adminRouter.get("/tenants/:id/users", async (req, res, next) => {
  try {
    const members = await prisma.tenantUser.findMany({
      where: { tenantId: req.params.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, user: { select: { id: true, firstName: true, lastName: true, email: true, active: true } }, role: { select: { id: true, name: true } } },
    });
    res.json({ data: members });
  } catch (error) { next(error); }
});

adminRouter.post("/tenants/:id/users", async (req, res, next) => {
  try {
    const parsed = createMembershipSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid user", issues: parsed.error.issues }); return; }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!tenant) { res.status(404).json({ message: "Business not found" }); return; }

    if (parsed.data.roleId) {
      const role = await prisma.role.findFirst({
        where: { id: parsed.data.roleId, tenantId: req.params.id },
      });
      if (!role) { res.status(400).json({ message: "Role does not belong to this business" }); return; }
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      res.status(409).json({ message: "That email is already used by another account" });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const membership = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          passwordHash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          active: true,
        },
      });

      return tx.tenantUser.create({
        data: {
          tenantId: req.params.id,
          userId: user.id,
          roleId: parsed.data.roleId ?? null,
        },
        select: {
          id: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, active: true },
          },
          role: { select: { id: true, name: true } },
        },
      });
    });

    await audit(req.auth!.userId, "MEMBERSHIP_CREATED", "TenantUser", membership.id, req.params.id, {
      email: parsed.data.email,
      roleId: parsed.data.roleId ?? null,
    });
    res.status(201).json({ data: membership });
  } catch (error) { next(error); }
});

adminRouter.get("/tenants/:id/roles", async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      where: { tenantId: req.params.id },
      orderBy: { name: "asc" },
      include: { permissions: { include: { permission: true } }, _count: { select: { members: true } } },
    });
    const permissions = await prisma.permission.findMany({ orderBy: { key: "asc" } });
    res.json({ data: { roles, permissions } });
  } catch (error) { next(error); }
});

adminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid user update", issues: parsed.error.issues }); return; }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data, select: { id: true, email: true, firstName: true, lastName: true, active: true } });
    await audit(req.auth!.userId, "USER_UPDATED", "User", user.id, undefined, parsed.data);
    res.json({ data: user });
  } catch (error) { next(error); }
});

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    const rows = await prisma.platformSetting.findMany();
    const stored = Object.fromEntries(rows.map(row => {
      try { return [row.key, JSON.parse(row.value)]; }
      catch { return [row.key, row.value]; }
    }));
    const aiKey = (await getPlatformValue("aiApiKey")) || (await getPlatformValue("groqApiKey")); const searchKey = await getPlatformValue("leadSearchApiKey");
    res.json({ data: { platformName: "Hyaw CRM", supportEmail: "support@hyaw.tech", defaultPlan: "Starter", defaultSeats: 5, allowTrials: true, trialDays: 14, aiProvider: "GROQ", aiModel: "openai/gpt-oss-120b", leadSearchProvider: "SERPER", ...stored, aiApiKey: "", aiApiKeyMasked: maskSecret(aiKey), groqApiKey: "", leadSearchApiKey: "", leadSearchApiKeyMasked: maskSecret(searchKey) } });
  } catch (error) { next(error); }
});

adminRouter.put("/settings", async (req, res, next) => {
  try {
    const parsed = platformSettingsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid platform settings", issues: parsed.error.issues }); return; }
    const { aiApiKey, groqApiKey, leadSearchApiKey, ...plain } = parsed.data;
    await prisma.$transaction(Object.entries(plain).map(([key, value]) => prisma.platformSetting.upsert({ where: { key }, update: { value: JSON.stringify(value) }, create: { key, value: JSON.stringify(value) } })));
    if (aiApiKey?.trim()) await setPlatformValue("aiApiKey", aiApiKey.trim());
    else if (groqApiKey?.trim()) await setPlatformValue("aiApiKey", groqApiKey.trim());
    if (leadSearchApiKey?.trim()) await setPlatformValue("leadSearchApiKey", leadSearchApiKey.trim());
    await audit(req.auth!.userId, "PLATFORM_SETTINGS_UPDATED", "PlatformSetting", undefined, undefined, { ...plain, aiApiKeyUpdated: Boolean(aiApiKey?.trim() || groqApiKey?.trim()), leadSearchApiKeyUpdated: Boolean(leadSearchApiKey?.trim()) });
    res.json({ data: parsed.data });
  } catch (error) { next(error); }
});

adminRouter.get("/audit", async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { tenant: { select: { name: true } } } });
    res.json({ data: logs.map((log) => ({ ...log, action: log.action ?? "UNKNOWN_ACTION", entity: log.entity ?? "Unknown", actorId: log.actorId ?? "unknown" })) });
  } catch (error) { next(error); }
});

adminRouter.get("/overview", async (_req, res, next) => {
  try {
    const [businesses, activeUsers, activeSubscriptions, trials] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenantUser.count({ where: { user: { active: true } } }),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.tenant.count({ where: { status: "TRIAL" } }),
      ]);

    res.json({
      data: { businesses, activeUsers, activeSubscriptions, trials },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/tenants", async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true } },
        subscription: true,
      },
    });

    res.json({
      data: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        userCount: tenant._count.users,
        plan: tenant.subscription?.plan ?? "No plan",
        subscriptionStatus: tenant.subscription?.status ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/tenants", async (req, res, next) => {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid business",
        issues: parsed.error.issues,
      });
      return;
    }

    const existingAdmin = await prisma.user.findUnique({
      where: { email: parsed.data.adminEmail },
    });
    if (existingAdmin) {
      res.status(409).json({ message: "That admin email is already used by another account" });
      return;
    }

    const {
      plan,
      seats,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      ...tenantData
    } = parsed.data;

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const permissions = await prisma.permission.findMany({
      where: { key: { not: "platform.manage" } },
      select: { id: true },
    });

    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          ...tenantData,
          subscription: {
            create: {
              plan,
              seats,
              status: tenantData.status === "ACTIVE" ? "ACTIVE" : "TRIAL",
            },
          },
        },
        include: { subscription: true },
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: createdTenant.id,
          name: "ADMIN",
          description: "ADMIN role",
          permissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
      });

      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          firstName: adminFirstName,
          lastName: adminLastName,
          active: true,
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: createdTenant.id,
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      return createdTenant;
    });

    await audit(req.auth!.userId, "TENANT_CREATED", "Tenant", tenant.id, tenant.id, {
      name: tenant.name,
      slug: tenant.slug,
      adminEmail,
      plan,
      seats,
    });

    res.status(201).json({ data: tenant });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        active: true,
        createdAt: true,
        tenants: {
          select: {
            tenant: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/subscriptions", async (_req, res, next) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      orderBy: { startsAt: "desc" },
      include: { tenant: { select: { id: true, name: true, status: true } } },
    });
    res.json({ data: subscriptions });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/permissions", async (_req, res, next) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { key: "asc" },
    });
    res.json({ data: permissions });
  } catch (error) {
    next(error);
  }
});
