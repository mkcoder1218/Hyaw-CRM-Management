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
    res.json({ data: subscription });
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
    res.json({ data: roles });
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
