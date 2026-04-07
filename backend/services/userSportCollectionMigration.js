import mongoose from "mongoose";

export const migrateUserSportCollection = async () => {
  const db = mongoose.connection?.db;
  if (!db) return;

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = new Set(collections.map((collection) => collection.name));

  if (!names.has("coachingsports")) {
    return;
  }

  if (!names.has("usersports")) {
    await db.collection("coachingsports").rename("usersports");
    console.log("Migrated collection: coachingsports -> usersports");
    return;
  }

  const legacyCollection = db.collection("coachingsports");
  const currentCollection = db.collection("usersports");
  const [legacyCount, currentCount] = await Promise.all([
    legacyCollection.countDocuments(),
    currentCollection.countDocuments(),
  ]);

  if (legacyCount === 0) {
    await legacyCollection.drop();
    console.log("Removed empty legacy collection: coachingsports");
    return;
  }

  if (currentCount === 0) {
    const legacyDocs = await legacyCollection.find({}).toArray();
    if (legacyDocs.length > 0) {
      await currentCollection.insertMany(legacyDocs, { ordered: false });
    }
    await legacyCollection.drop();
    console.log("Migrated legacy docs and removed: coachingsports");
    return;
  }

  console.warn(
    "Both usersports and coachingsports contain data. Please verify and merge manually before dropping coachingsports.",
  );
};
