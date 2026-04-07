import SubscriptionSlug from "../models/SubscriptionSlug.js";
import { DEFAULT_SUBSCRIPTION_PLANS } from "./subscriptionPlanSeedService.js";

const toSlugLabel = (slug = "") =>
  String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || String(slug || "");

export const seedSubscriptionSlugs = async ({ actorId = null } = {}) => {
  const defaultSlugs = Array.from(
    new Set(
      (DEFAULT_SUBSCRIPTION_PLANS || [])
        .map((plan) => String(plan?.slug || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );

  let created = 0;
  for (const slug of defaultSlugs) {
    const result = await SubscriptionSlug.updateOne(
      { slug },
      {
        $setOnInsert: {
          slug,
          label: toSlugLabel(slug),
          isActive: true,
          createdBy: actorId || null,
          updatedBy: actorId || null,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) created += 1;
  }

  return { created, totalSeeded: defaultSlugs.length };
};

export default seedSubscriptionSlugs;

