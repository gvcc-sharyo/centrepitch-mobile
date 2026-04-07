/** Mirrors `frontend/src/pages/admin/Sports.jsx` initial shape + submit cleaning for organizer public sports. */

export const FORM_TAB_IDS = ["basic", "formats", "team", "categories", "match", "rules"];

export const FORM_TAB_LABELS = {
  basic: "Basic",
  formats: "Formats",
  team: "Team",
  categories: "Categories",
  match: "Match",
  rules: "Rules",
};

export const MEMBER_FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "dateOfBirth", label: "Date of Birth" },
  { value: "gender", label: "Gender" },
  { value: "position", label: "Position" },
  { value: "jerseyNumber", label: "Jersey Number" },
  { value: "photo", label: "Photo" },
  { value: "idProof", label: "ID Proof" },
];

export const SKILL_LEVEL_OPTIONS = [
  { value: "any", label: "Any Level" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export const GENDER_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "mixed", label: "Mixed" },
];

export const SCORING_TYPE_OPTIONS = [
  { value: "points", label: "Points" },
  { value: "goals", label: "Goals" },
  { value: "runs", label: "Runs" },
  { value: "sets", label: "Sets" },
  { value: "games", label: "Games" },
  { value: "time", label: "Time-based" },
  { value: "other", label: "Other" },
];

export function createInitialFormData() {
  return {
    sportId: "",
    name: "",
    description: "",
    icon: "",
    image: "",
    formats: {
      individual: { enabled: false, minPlayers: 1, maxPlayers: 1, description: "" },
      doubles: { enabled: false, minPlayers: 2, maxPlayers: 2, description: "" },
      team: {
        enabled: false,
        minPlayersPerTeam: 5,
        maxPlayersPerTeam: 15,
        playingCount: 11,
        substitutesCount: 4,
        description: "",
      },
    },
    teamSettings: {
      requiresCaptain: true,
      requiresViceCaptain: true,
      captainCanPlay: true,
      memberRequiredFields: ["name", "email", "phone"],
      positions: [],
      jerseyNumberRange: { min: 1, max: 99 },
    },
    categorySettings: {
      useGender: true,
      useAgeRange: true,
      useSkillLevel: false,
      useWeightClass: false,
      availableFields: [],
    },
    categories: [],
    scoringSystem: {
      type: "points",
      description: "",
      winCondition: "",
    },
    matchSettings: {
      defaultDuration: 90,
      periods: 2,
      periodDuration: 45,
      breakDuration: 15,
      overtimeAllowed: false,
      tieBreaker: "",
    },
    rules: {
      summary: "",
      detailed: "",
      documentUrl: "",
    },
    equipment: [],
    venueRequirements: {
      fieldType: "",
      fieldDimensions: "",
      specialRequirements: [],
    },
    isFeatured: false,
  };
}

export const initialCategoryData = {
  name: "",
  code: "",
  minAge: "",
  maxAge: "",
  gender: "any",
  skillLevel: "any",
  minWeight: "",
  maxWeight: "",
  weightUnit: "kg",
  description: "",
  order: 0,
};

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Same cleaning logic as web `cleanFormDataForSubmit`. */
export function cleanFormDataForSubmit(data) {
  const cleanedData = { ...data };

  if (cleanedData.categories && Array.isArray(cleanedData.categories)) {
    cleanedData.categories = cleanedData.categories.map((cat) => {
      const cleanCat = {
        name: cat.name,
        isActive: cat.isActive !== undefined ? cat.isActive : true,
        order: cat.order !== undefined ? cat.order : 0,
      };

      if (cat.code !== undefined) cleanCat.code = cat.code;
      if (cat.description !== undefined) cleanCat.description = cat.description;
      if (cat.gender !== undefined) cleanCat.gender = cat.gender;
      if (cat.skillLevel !== undefined) cleanCat.skillLevel = cat.skillLevel;
      if (cat.weightUnit !== undefined) cleanCat.weightUnit = cat.weightUnit;

      if (cat.minAge !== undefined && cat.minAge !== "") {
        cleanCat.minAge = cat.minAge;
      }
      if (cat.maxAge !== undefined && cat.maxAge !== "") {
        cleanCat.maxAge = cat.maxAge;
      }
      if (cat.minWeight !== undefined && cat.minWeight !== "") {
        cleanCat.minWeight = cat.minWeight;
      }
      if (cat.maxWeight !== undefined && cat.maxWeight !== "") {
        cleanCat.maxWeight = cat.maxWeight;
      }

      if (cat.customFields !== undefined) {
        cleanCat.customFields = cat.customFields;
      }

      return cleanCat;
    });
  }

  return cleanedData;
}

export function mapSportToFormData(sport, catalogMatch) {
  const base = createInitialFormData();
  return {
    ...base,
    sportId: catalogMatch?._id || "",
    name: sport.name || "",
    description: sport.description || "",
    icon: sport.icon || "",
    image: sport.image || "",
    formats: sport.formats || deepClone(base.formats),
    teamSettings: sport.teamSettings || deepClone(base.teamSettings),
    categorySettings: sport.categorySettings || deepClone(base.categorySettings),
    categories: sport.categories || [],
    scoringSystem: sport.scoringSystem || deepClone(base.scoringSystem),
    matchSettings: sport.matchSettings || deepClone(base.matchSettings),
    rules: sport.rules || deepClone(base.rules),
    equipment: sport.equipment || [],
    venueRequirements: sport.venueRequirements || deepClone(base.venueRequirements),
    isFeatured: sport.isFeatured || false,
  };
}
