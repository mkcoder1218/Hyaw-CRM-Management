import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { requireAuth, signSession } from "../auth";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      tenants: {
        include: {
          tenant: true,
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const membership = user.tenants[0];
  if (!membership?.role || membership.tenant.status === "SUSPENDED") {
    res.status(403).json({ message: "No active workspace access" });
    return;
  }

  const permissions = membership.role.permissions.map((item) => item.permission.key);
  const session = {
    userId: user.id,
    tenantId: membership.tenantId,
    role: membership.role.name,
    permissions,
  };
  const token = signSession(session);

  res.cookie("hyaw_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({
    data: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenant: { id: membership.tenant.id, name: membership.tenant.name },
      role: membership.role.name,
      permissions,
    },
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("hyaw_session");
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { id: true, email: true, firstName: true, lastName: true, active: true },
  });
  if (!user?.active) {
    res.status(401).json({ message: "User is inactive" });
    return;
  }
  res.json({ data: { ...user, ...req.auth } });
});
