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

const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]).default("TRIAL"),
  plan: z.string().min(1).default("Starter"),
  seats: z.number().int().positive().default(1),
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
