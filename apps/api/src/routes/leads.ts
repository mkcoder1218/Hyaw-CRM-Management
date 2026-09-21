import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

export const leadsRouter = Router();

const schema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  source: z.string().optional(),
  estimatedValue: z.number().nonnegative().default(0),
});

leadsRouter.get("/", async (req, res, next) => {
  try {
    const tenantId =
      typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const leads = await prisma.lead.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json({ data: leads, total: leads.length });
  } catch (error) {
    next(error);
  }
});

leadsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ errors: parsed.error.flatten() });
      return;
    }
    const lead = await prisma.lead.create({ data: parsed.data });
    res.status(201).json({ data: lead });
  } catch (error) {
    next(error);
  }
});
