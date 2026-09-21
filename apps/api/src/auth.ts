import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthPayload = {
  userId: string;
  tenantId: string;
  role: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

const secret = process.env.JWT_SECRET ?? "development-only-change-me";

export function signSession(payload: AuthPayload) {
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.hyaw_session;
  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    req.auth = jwt.verify(token, secret) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.permissions.includes(permission)) {
      res.status(403).json({ message: "Permission denied", permission });
      return;
    }
    next();
  };
}
