import dotenv from "dotenv";
import mongoose from "mongoose";
import UserRoleSubscription from "./models/UserRoleSubscription.js";
import Payment from "./models/Payment.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/sports_event_management";
const dryRun =
  process.argv.includes("--dry-run") ||
  String(process.env.DRY_RUN || "")
    .trim()
    .toLowerCase() === "true";

if (!mongoUri) {
  console.error("MONGODB_URI (or MONGO_URI) is required in environment variables.");
  process.exit(1);
}

const toDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const getRolePaymentType = (role = "") => {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "coach") return "coach_subscription";
  if (normalized === "academyadmin") return "academy_subscription";
  if (normalized === "organizer") return "organizer_subscription";
  return null;
};

const resolveChangeType = async (record) => {
  if (record?.changeType) return null;
  const startsAt = toDate(record?.startsAt);

  const prevQuery = {
    _id: { $ne: record._id },
    user: record.user,
    roleRef: record.roleRef,
  };
  if (startsAt) prevQuery.startsAt = { $lt: startsAt };

  const previous = await UserRoleSubscription.findOne(prevQuery)
    .sort({ startsAt: -1, createdAt: -1 })
    .select("planSlug billingCycle")
    .lean();

  if (!previous) return "new";
  if (String(previous.planSlug || "") === String(record.planSlug || "")) {
    if (String(previous.billingCycle || "") === String(record.billingCycle || "")) {
      return "renewal";
    }
    return "cycle_change";
  }
  return "plan_change";
};

const resolvePaymentForRecord = async (record) => {
  if (record?.payment || Number(record?.amount || 0) <= 0) return null;

  const rolePaymentType = getRolePaymentType(record?.role);
  const anchor = toDate(record?.createdAt) || toDate(record?.startsAt) || new Date();
  const from = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(anchor.getTime() + 24 * 60 * 60 * 1000);

  const payment = await Payment.findOne({
    user: record.user,
    amount: Number(record.amount || 0),
    ...(rolePaymentType ? { paymentType: rolePaymentType } : {}),
    status: { $in: ["completed", "processing", "pending"] },
    $or: [
      { "metadata.subscriptionRecordId": record._id },
      {
        "metadata.planSlug": String(record.planSlug || ""),
        "metadata.billingCycle": String(record.billingCycle || ""),
        createdAt: { $gte: from, $lte: to },
      },
      {
        "metadata.planSlug": String(record.planSlug || ""),
        "metadata.billingCycle": String(record.billingCycle || ""),
        paidAt: { $gte: from, $lte: to },
      },
    ],
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select("_id metadata")
    .lean();

  return payment || null;
};

const run = async () => {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
  if (dryRun) {
    console.log("Running in DRY-RUN mode (no database writes)");
  }

  const records = await UserRoleSubscription.find({})
    .select(
      "_id user role roleRef planSlug billingCycle amount payment changeType startsAt createdAt"
    )
    .sort({ createdAt: 1 });

  let updatedChangeType = 0;
  let linkedPayments = 0;
  let paymentMetadataUpdated = 0;

  for (const record of records) {
    let dirty = false;
    let shouldLinkPaymentMetadata = false;
    let resolvedPaymentId = null;

    const nextChangeType = await resolveChangeType(record);
    if (nextChangeType) {
      if (!dryRun) {
        record.changeType = nextChangeType;
      }
      dirty = true;
      updatedChangeType += 1;
    }

    const payment = await resolvePaymentForRecord(record);
    if (payment?._id) {
      resolvedPaymentId = payment._id;
      if (!dryRun) {
        record.payment = payment._id;
      }
      dirty = true;
      linkedPayments += 1;

      const existingSubscriptionRecordId = payment?.metadata?.subscriptionRecordId;
      if (!existingSubscriptionRecordId) {
        shouldLinkPaymentMetadata = true;
      }

      if (shouldLinkPaymentMetadata) {
        if (!dryRun) {
          await Payment.findByIdAndUpdate(payment._id, {
            $set: { "metadata.subscriptionRecordId": record._id },
          });
        }
        paymentMetadataUpdated += 1;
      }
    }

    if (dirty && !dryRun) {
      await record.save();
    }

    if (dryRun && dirty) {
      const actions = [];
      if (nextChangeType) actions.push(`changeType -> ${nextChangeType}`);
      if (resolvedPaymentId) actions.push(`payment -> ${resolvedPaymentId}`);
      if (shouldLinkPaymentMetadata) actions.push("payment.metadata.subscriptionRecordId -> record._id");
      console.log(`Would update ${record._id}: ${actions.join(", ")}`);
    }
  }

  console.log(dryRun ? "Dry-run completed:" : "Backfill completed:");
  console.log(`- Records scanned: ${records.length}`);
  console.log(`- Missing changeType fixed: ${updatedChangeType}`);
  console.log(`- Missing payment links fixed: ${linkedPayments}`);
  console.log(`- Payment metadata linked: ${paymentMetadataUpdated}`);

  await mongoose.disconnect();
  console.log("Disconnected.");
};

run().catch(async (error) => {
  console.error("Backfill failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // no-op
  }
  process.exit(1);
});
