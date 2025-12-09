import mongoose from "mongoose";

export async function connectMongo(uri: string) {
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(uri);
  return mongoose;
}

const profileSchema = new mongoose.Schema(
  {
    platform: String,
    platformId: String,
    username: String,
    displayName: String,
    profileUrl: String,
    avatarUrl: String,
    bio: String,
    metadata: Object,
    posts: Array,
    interests: [String],
    sentiment: Object,
    riskScore: Number,
    status: String,
    campaignIds: [mongoose.Schema.Types.ObjectId],
  },
  { timestamps: true, versionKey: "version" }
);

profileSchema.index({ platform: 1, username: 1 }, { unique: true });
profileSchema.index({ status: 1, createdAt: -1 });
profileSchema.index({ campaignIds: 1, status: 1, createdAt: -1 });
profileSchema.index({ interests: 1 });
profileSchema.index({ bio: "text", "posts.content": "text" });

const campaignSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    description: String,
    targetCriteria: Object,
    status: String,
    settings: Object,
    stats: Object,
  },
  { timestamps: true }
);

export const Profile = mongoose.model("Profile", profileSchema);
export const Campaign = mongoose.model("Campaign", campaignSchema);

const messageSchema = new mongoose.Schema(
  {
    campaignId: mongoose.Schema.Types.ObjectId,
    profileId: mongoose.Schema.Types.ObjectId,
    type: { type: String, enum: ["initial", "follow_up", "custom"] },
    content: String,
    platform: String,
    status: { type: String, enum: ["pending", "sent", "delivered", "failed"] },
    scheduledFor: Date,
    sentAt: Date,
    response: Object,
    metadata: Object,
  },
  { timestamps: true }
);
messageSchema.index({ campaignId: 1, profileId: 1 });
messageSchema.index({ status: 1, scheduledFor: 1 });
messageSchema.index({ sentAt: -1 });

const userSchema = new mongoose.Schema(
  {
    email: String,
    username: String,
    passwordHash: String,
    role: { type: String, enum: ["admin", "operator", "viewer"] },
    permissions: [String],
    profile: Object,
    apiKeys: Array,
    usageStats: Object,
  },
  { timestamps: true }
);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ role: 1 });

const sessionSchema = new mongoose.Schema(
  {
    platform: String,
    sessionId: String,
    userId: mongoose.Schema.Types.ObjectId,
    proxy: Object,
    userAgent: String,
    cookiesEncrypted: String,
    lastValidatedAt: Date,
    expiresAt: Date,
    status: String,
  },
  { timestamps: true }
);
sessionSchema.index({ platform: 1, userId: 1 });
sessionSchema.index({ expiresAt: 1 });
sessionSchema.index({ status: 1, lastValidatedAt: -1 });

export const Message = mongoose.model("Message", messageSchema);
export const User = mongoose.model("User", userSchema);
export const Session = mongoose.model("Session", sessionSchema);

// Analytics Collection - time-bucketed aggregated metrics
const analyticsSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["metric", "event", "aggregate"] },
    timeBucket: Date,
    dimensions: {
      campaignId: mongoose.Schema.Types.ObjectId,
      userId: mongoose.Schema.Types.ObjectId,
      platform: String,
    },
    metrics: mongoose.Schema.Types.Mixed, // { [key: string]: Number }
  },
  { timestamps: true }
);
analyticsSchema.index({ type: 1, timeBucket: -1 });
analyticsSchema.index({ "dimensions.campaignId": 1, timeBucket: -1 });
analyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // 90-day TTL for raw events

export const Analytics = mongoose.model("Analytics", analyticsSchema);
