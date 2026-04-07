import mongoose from "mongoose";

const academyRoleSchema = new mongoose.Schema(
  {
    academy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SportsAcademy",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    permissions: [
      {
        type: String,
        trim: true,
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

academyRoleSchema.index({ academy: 1, name: 1 }, { unique: true });
academyRoleSchema.index({ academy: 1, isActive: 1 });

const AcademyRole = mongoose.model("AcademyRole", academyRoleSchema);

export default AcademyRole;
