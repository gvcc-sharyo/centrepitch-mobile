import Permission from "../models/Permission.js";
import Role from "../models/Role.js";

const DEFAULT_PERMISSIONS = [
  { key: "dashboard.read", module: "dashboard", description: "View dashboard data" },
  { key: "profile.read", module: "profile", description: "View profile details" },
  { key: "profile.update", module: "profile", description: "Update profile details" },
  { key: "subscription.read", module: "subscription", description: "View subscription details" },
  { key: "subscription.purchase", module: "subscription", description: "Purchase subscription plans" },
  { key: "events.read", module: "events", description: "View events" },
  { key: "events.manage", module: "events", description: "Create and manage events" },
  { key: "academy.read", module: "academy", description: "View academy data" },
  { key: "academy.manage", module: "academy", description: "Manage academy data" },
  { key: "coach.read", module: "coach", description: "View coach data" },
  { key: "coach.manage", module: "coach", description: "Manage coach data" },
  { key: "users.read", module: "users", description: "View users" },
  { key: "users.manage", module: "users", description: "Manage users and approvals" },
  { key: "roles.read", module: "roles", description: "View roles and permissions" },
  { key: "roles.manage", module: "roles", description: "Manage roles and permissions" },
];

const DEFAULT_ROLES = [
  {
    name: "superadmin",
    displayName: "Super Admin",
    description: "Platform owner with unrestricted access",
    permissionKeys: DEFAULT_PERMISSIONS.map((permission) => permission.key),
  },
  {
    name: "player",
    displayName: "Player",
    description: "Default app user role",
    permissionKeys: [
      "dashboard.read",
      "profile.read",
      "profile.update",
      "subscription.read",
      "subscription.purchase",
      "events.read",
    ],
  },
  {
    name: "coach",
    displayName: "Coach",
    description: "Coaching role unlocked after subscription or approval",
    permissionKeys: [
      "dashboard.read",
      "profile.read",
      "profile.update",
      "subscription.read",
      "events.read",
      "coach.read",
      "coach.manage",
    ],
  },
  {
    name: "academyadmin",
    displayName: "Academy Admin",
    description: "Academy administrator role",
    permissionKeys: [
      "dashboard.read",
      "profile.read",
      "profile.update",
      "subscription.read",
      "academy.read",
      "academy.manage",
      "coach.read",
      "coach.manage",
      "roles.read",
      "roles.manage",
    ],
  },
  {
    name: "organizer",
    displayName: "Organizer",
    description: "Event organizer role",
    permissionKeys: [
      "dashboard.read",
      "profile.read",
      "profile.update",
      "subscription.read",
      "subscription.purchase",
      "events.read",
      "events.manage",
    ],
  },
];

export const seedRolesAndPermissions = async () => {
  for (const permission of DEFAULT_PERMISSIONS) {
    await Permission.updateOne(
      { key: permission.key },
      {
        $set: {
          module: permission.module,
          description: permission.description,
        },
        $setOnInsert: {
          key: permission.key,
        },
      },
      { upsert: true }
    );
  }

  const permissions = await Permission.find({
    key: { $in: DEFAULT_PERMISSIONS.map((permission) => permission.key) },
  }).select("_id key");

  const permissionIdByKey = new Map(
    permissions.map((permission) => [permission.key, permission._id])
  );

  for (const role of DEFAULT_ROLES) {
    const permissionIds = role.permissionKeys
      .map((permissionKey) => permissionIdByKey.get(permissionKey))
      .filter(Boolean);

    await Role.updateOne(
      { name: role.name },
      {
        $set: {
          displayName: role.displayName,
          description: role.description,
          permissions: permissionIds,
        },
        $setOnInsert: {
          name: role.name,
        },
      },
      { upsert: true }
    );
  }

  console.log("RBAC defaults synced (roles + permissions).");
};

