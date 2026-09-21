import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

export const sopsRouter = Router();

const stepSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dueAfterHours: z.number().int().nonnegative().optional(),
  required: z.boolean().default(true),
});

const sopSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  active: z.boolean().default(true),
  steps: z.array(stepSchema).min(1),
});

sopsRouter.get("/", async (req, res, next) => {
  try {
    const tenantId =
      typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const sops = await prisma.sop.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        steps: { orderBy: { position: "asc" } },
        _count: { select: { runs: true } },
      },
    });
    res.json({ data: sops });
  } catch (error) {
    next(error);
  }
});

sopsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = sopSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ message: "Invalid SOP", issues: parsed.error.issues });
      return;
    }

    const { steps, ...data } = parsed.data;
    const sop = await prisma.sop.create({
      data: {
        ...data,
        steps: {
          create: steps.map((step, index) => ({
            ...step,
            position: index + 1,
          })),
        },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    res.status(201).json({ data: sop });
  } catch (error) {
    next(error);
  }
});
