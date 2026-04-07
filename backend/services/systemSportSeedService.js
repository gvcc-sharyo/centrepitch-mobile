import Sport from "../models/Sport.js";

const toSlug = (name = "") =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const SEEDED_SPORTS = [
  {
    name: "Football",
    description:
      "A team sport played with a round ball, focusing on passing, dribbling, and scoring goals.",
  },
  {
    name: "Cricket",
    description:
      "A bat-and-ball sport where teams score runs and take wickets across innings and overs.",
  },
  {
    name: "Badminton",
    description: "A fast racket sport played with a shuttlecock in singles or doubles formats.",
  },
  {
    name: "Tennis",
    description:
      "A racket sport played on a court where players score by hitting the ball into the opponent’s area.",
  },
  {
    name: "Table Tennis",
    description: "A quick racket sport played on a table, emphasizing reflexes, spin, and precision.",
  },
  {
    name: "Basketball",
    description:
      "A team sport where players score by shooting a ball through a hoop, with fast transitions and teamwork.",
  },
  {
    name: "Volleyball",
    description:
      "A team net sport where points are scored by grounding the ball on the opponent’s court.",
  },
  {
    name: "Hockey",
    description: "A stick-and-ball team sport played on a field, focusing on passing, tackling, and goals.",
  },
  {
    name: "Kabaddi",
    description:
      "A contact team sport where raiders score by tagging defenders and returning to their half in one breath.",
  },
  {
    name: "Swimming",
    description: "A water sport based on speed and technique across different strokes and distances.",
  },
  {
    name: "Athletics",
    description: "A collection of track-and-field events including running, jumping, and throwing disciplines.",
  },
  {
    name: "Boxing",
    description:
      "A combat sport featuring striking with fists, footwork, and defensive skills across timed rounds.",
  },
  {
    name: "Wrestling",
    description: "A grappling combat sport focused on takedowns, control, and pins within a regulated ruleset.",
  },
  {
    name: "Judo",
    description: "A martial art and sport emphasizing throws, holds, and controlled technique to score points.",
  },
  {
    name: "Karate",
    description: "A striking martial art sport emphasizing punches, kicks, and kata with controlled sparring.",
  },
  {
    name: "Taekwondo",
    description: "A martial art sport known for dynamic kicking techniques, speed, and point-based sparring.",
  },
  {
    name: "Skating",
    description: "A sport involving movement on skates, ranging from speed skating to recreational rink skating.",
  },
  {
    name: "Cycling",
    description:
      "A sport based on endurance and speed on bicycles, including road, track, and time trial formats.",
  },
  {
    name: "Golf",
    description: "A precision sport where players aim to complete holes with the fewest strokes on a course.",
  },
  {
    name: "Squash",
    description:
      "A high-intensity racket sport played in a closed court, focusing on angles, stamina, and tactics.",
  },
  {
    name: "Baseball",
    description: "A bat-and-ball team sport where players score by running bases after hitting pitched balls.",
  },
  {
    name: "Softball",
    description:
      "A bat-and-ball sport similar to baseball, typically played with a larger ball and shorter field.",
  },
  {
    name: "Rugby",
    description:
      "A physical team sport where players advance an oval ball to score tries, supported by tackling and strategy.",
  },
  {
    name: "Handball",
    description:
      "A fast team sport where players pass and throw a ball to score goals against the opponent.",
  },
  {
    name: "Chess",
    description: "A strategic mind sport focused on planning, tactics, and endgame technique.",
  },
  {
    name: "Futsal",
    description:
      "A small-sided indoor version of football emphasizing close control, quick passing, and fast play.",
  },
  {
    name: "Pickleball",
    description: "A paddle sport combining elements of tennis and badminton, played in singles or doubles.",
  },
  {
    name: "Padel",
    description: "A doubles racket sport played in an enclosed court, featuring walls and quick rallies.",
  },
  {
    name: "Beach Volleyball",
    description: "A sand-court variation of volleyball emphasizing agility, ball control, and teamwork.",
  },
  {
    name: "Archery",
    description: "A precision sport where athletes shoot arrows at targets, focusing on technique and consistency.",
  },
];

export const seedSystemSports = async () => {
  let created = 0;
  let updated = 0;

  for (const item of SEEDED_SPORTS) {
    const name = item?.name ? String(item.name).trim() : "";
    if (!name) continue;

    const slug = toSlug(name);
    const description = item?.description ? String(item.description).trim() : "";

    const existing = await Sport.findOne({
      $or: [{ slug }, { name: { $regex: new RegExp(`^${name}$`, "i") } }],
    })
      .select("_id slug name scope isActive description")
      .lean();

    if (!existing?._id) {
      await Sport.create({
        name,
        slug,
        description,
        scope: "system",
        isActive: true,
      });
      created += 1;
      continue;
    }

    const next = {};
    if (!existing.slug) next.slug = slug;
    if (!existing.scope || existing.scope !== "system") next.scope = "system";
    if (existing.isActive !== true) next.isActive = true;
    if ((!existing.description || !String(existing.description).trim()) && description) {
      next.description = description;
    }

    if (Object.keys(next).length > 0) {
      await Sport.updateOne({ _id: existing._id }, { $set: next });
      updated += 1;
    }
  }

  console.log("System sports seed synced.");
  console.log(`- Seed set size: ${SEEDED_SPORTS.length}`);
  console.log(`- Created: ${created}`);
  console.log(`- Updated: ${updated}`);

  return { created, updated, total: SEEDED_SPORTS.length };
};

export default seedSystemSports;

