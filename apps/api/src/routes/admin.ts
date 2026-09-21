import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";

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
});


const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  status: tenantStatusSchema.optional(),
});
const tenantSettingsSchema = z.object({
  timezone: z.string().min(1),
  currency: z.string().min(3).max(3),
  locale: z.string().min(2),
  leadAssignment: z.enum(["manual", "round_robin"]),
  callerTracking: z.boolean(),
});
const membershipSchema = z.object({ roleId: z.string().min(1).nullable().optional(), active: z.boolean().optional() });
const rolePermissionsSchema = z.object({ permissionIds: z.array(z.string()).default([]) });
const userUpdateSchema = z.object({ active: z.boolean() });
const platformSettingsSchema = z.object({
  platformName: z.string().min(2),
  supportEmail: z.string().email(),
  defaultPlan: z.string().min(1),
  defaultSeats: z.number().int().positive(),
  allowTrials: z.boolean(),
  trialDays: z.number().int().min(0).max(365),
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
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: parsed.data });
    await audit(req.auth!.userId, "TENANT_UPDATED", "Tenant", tenant.id, tenant.id, parsed.data);
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
    const membership = await prisma.tenantUser.findFirst({ where: { id: req.params.membershipId, tenantId: req.params.tenantId }, include: { user: true } });
    if (!membership) { res.status(404).json({ message: "Business user not found" }); return; }
    if (parsed.data.roleId !== undefined) await prisma.tenantUser.update({ where: { id: membership.id }, data: { roleId: parsed.data.roleId } });
    if (parsed.data.active !== undefined) await prisma.user.update({ where: { id: membership.userId }, data: { active: parsed.data.active } });
    await audit(req.auth!.userId, "MEMBERSHIP_UPDATED", "TenantUser", membership.id, req.params.tenantId, parsed.data);
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
    const stored = Object.fromEntries(rows.map(row => [row.key, JSON.parse(row.value)]));
    res.json({ data: { platformName: "Hyaw CRM", supportEmail: "support@hyaw.tech", defaultPlan: "Starter", defaultSeats: 5, allowTrials: true, trialDays: 14, ...stored } });
  } catch (error) { next(error); }
});

adminRouter.put("/settings", async (req, res, next) => {
  try {
    const parsed = platformSettingsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid platform settings", issues: parsed.error.issues }); return; }
    await prisma.$transaction(Object.entries(parsed.data).map(([key, value]) => prisma.platformSetting.upsert({ where: { key }, update: { value: JSON.stringify(value) }, create: { key, value: JSON.stringify(value) } })));
    await audit(req.auth!.userId, "PLATFORM_SETTINGS_UPDATED", "PlatformSetting", undefined, undefined, parsed.data);
    res.json({ data: parsed.data });
  } catch (error) { next(error); }
});

adminRouter.get("/audit", async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { tenant: { select: { name: true } } } });
    res.json({ data: logs });
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

    const { plan, seats, ...tenantData } = parsed.data;
    const tenant = await prisma.tenant.create({
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
