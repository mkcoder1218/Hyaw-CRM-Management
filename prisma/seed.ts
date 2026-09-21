import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const permissions = [
  ["lead.view", "View leads"],
  ["lead.create", "Create leads"],
  ["lead.update", "Update leads"],
  ["lead.assign", "Assign leads to team members"],
  ["activity.view", "View CRM activities"],
  ["activity.create", "Record calls, notes and follow-ups"],
  ["contact.view", "View contacts"],
  ["contact.manage", "Manage contacts"],
  ["company.view", "View companies"],
  ["company.manage", "Manage companies"],
  ["opportunity.view", "View opportunities"],
  ["opportunity.manage", "Manage opportunities"],
  ["task.view", "View CRM tasks"],
  ["task.manage", "Create and update CRM tasks"],
  ["sop.view", "View SOP processes"],
  ["sop.manage", "Manage SOP processes"],
  ["report.view", "View CRM reports"],
  ["team.view", "View workspace team"],
  ["team.manage", "Manage workspace team"],
  ["role.manage", "Manage roles and permissions"],
  ["settings.manage", "Manage workspace settings"],
  ["platform.manage", "Manage the whole CRM platform"],
] as const;

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map(([key]) => key),
  ADMIN: permissions.map(([key]) => key).filter((key) => key !== "platform.manage"),
  SELLER: [
    "lead.view", "lead.create", "lead.update", "activity.view", "activity.create",
    "contact.view", "contact.manage", "company.view", "company.manage",
    "opportunity.view", "opportunity.manage", "task.view", "task.manage", "sop.view", "report.view", "team.view",
  ],
  CALLER: [
    "lead.view", "lead.update", "activity.view", "activity.create",
    "contact.view", "task.view", "task.manage", "sop.view",
  ],
};

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "hyaw" },
    update: { name: "Hyaw", status: "ACTIVE" },
    create: {
      name: "Hyaw",
      slug: "hyaw",
      status: "ACTIVE",
      subscription: { create: { plan: "Internal", status: "ACTIVE", seats: 25 } },
    },
  });

  const permissionRows = new Map<string, { id: string }>();
  for (const [key, description] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissionRows.set(key, permission);
  }

  const roles = new Map<string, { id: string }>();
  for (const name of Object.keys(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { description: `${name.replace("_", " ")} role` },
      create: { tenantId: tenant.id, name, description: `${name.replace("_", " ")} role` },
    });
    roles.set(name, role);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: rolePermissions[name].map((key) => ({
        roleId: role.id,
        permissionId: permissionRows.get(key)!.id,
      })),
      skipDuplicates: true,
    });
  }

  const accounts = [
    { email: "superadmin@hyaw.local", firstName: "Super", lastName: "Admin", role: "SUPER_ADMIN", password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? "HyawSuper123!" },
    { email: "admin@hyaw.local", firstName: "Hyaw", lastName: "Admin", role: "ADMIN", password: process.env.SEED_ADMIN_PASSWORD ?? "HyawAdmin123!" },
    { email: "test@hyaw.local", firstName: "Test", lastName: "Seller", role: "SELLER", password: process.env.SEED_SELLER_PASSWORD ?? "TestSeller123!" },
    { email: "caller@hyaw.local", firstName: "Test", lastName: "Caller", role: "CALLER", password: process.env.SEED_CALLER_PASSWORD ?? "TestCaller123!" },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { firstName: account.firstName, lastName: account.lastName, passwordHash, active: true },
      create: { email: account.email, firstName: account.firstName, lastName: account.lastName, passwordHash },
    });
    await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: { roleId: roles.get(account.role)!.id },
      create: { tenantId: tenant.id, userId: user.id, roleId: roles.get(account.role)!.id },
    });
  }

  await prisma.pipeline.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Sales Pipeline" } },
    update: { isDefault: true },
    create: {
      tenantId: tenant.id,
      name: "Sales Pipeline",
      isDefault: true,
      stages: {
        create: [
          { name: "New", position: 1, probability: 10 },
          { name: "Contacted", position: 2, probability: 25 },
          { name: "Qualified", position: 3, probability: 50 },
          { name: "Proposal", position: 4, probability: 75 },
          { name: "Won", position: 5, probability: 100 },
        ],
      },
    },
  });

  const platformDefaults: Record<string, unknown> = {
    platformName: "Hyaw CRM",
    supportEmail: "support@hyaw.tech",
    defaultPlan: "Starter",
    defaultSeats: 5,
    allowTrials: true,
    trialDays: 14,
  };
  for (const [key, value] of Object.entries(platformDefaults)) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.stringify(value) },
    });
  }

  const superAdmin = await prisma.user.findUnique({ where: { email: "superadmin@hyaw.local" } });
  if (superAdmin) {
    const existingSeedAudit = await prisma.auditLog.findFirst({
      where: { actorId: superAdmin.id, action: "PLATFORM_SEEDED", entity: "Platform" },
    });
    if (!existingSeedAudit) {
      await prisma.auditLog.create({
        data: {
          actorId: superAdmin.id,
          action: "PLATFORM_SEEDED",
          entity: "Platform",
          metadata: { tenant: "Hyaw", source: "seed" },
        },
      });
    }
  }

  console.log("Seeded Hyaw tenant, RBAC roles, permissions and test accounts.");
}

main().finally(() => prisma.$disconnect());
