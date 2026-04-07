import mongoose from "mongoose";

const userSportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sport name is required"],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    scope: {
      type: String,
      enum: ["system", "user"],
      default: "system",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSportSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

userSportSchema.index({ isActive: 1, scope: 1 });
userSportSchema.index({ createdBy: 1, isActive: 1 });
userSportSchema.index({ scope: 1, slug: 1 });
userSportSchema.index({ createdBy: 1, slug: 1 }, { unique: true, sparse: true });

const UserSport = mongoose.model("UserSport", userSportSchema);

export default UserSport;
