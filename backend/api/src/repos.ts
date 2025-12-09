import { Profile, Campaign, Message, User, Session, Analytics } from "./lib/mongo.js";

// ============================================================================
// Profile Repository - Enhanced per dev docs specifications
// ============================================================================
export const ProfileRepo = {
  upsertByPlatformUsername: async (doc: any) => {
    const filter = { platform: doc.platform, username: doc.username };
    const update = { ...doc, updatedAt: new Date() };
    if (!doc.version) update.$inc = { version: 1 };
    return Profile.findOneAndUpdate(filter, update, { upsert: true, new: true });
  },

  findById: async (id: string) => Profile.findById(id).lean(),

  findByStatus: async (status: string, limit = 50, skip = 0) => {
    return Profile.find({ status }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  },

  findByCampaignStatus: async (campaignId: string, status: string, limit = 50, skip = 0) => {
    return Profile.find({ campaignIds: campaignId, status }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  },

  setStatus: async (id: string, status: string) => {
    return Profile.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
  },

  // Batch operations for human-in-the-loop workflow
  batchApprove: async (ids: string[]) => {
    return Profile.updateMany({ _id: { $in: ids } }, { status: "approved", updatedAt: new Date() });
  },

  batchReject: async (ids: string[], reason?: string) => {
    return Profile.updateMany(
      { _id: { $in: ids } },
      { status: "rejected", updatedAt: new Date(), "metadata.rejectionReason": reason }
    );
  },

  // Search by interests or bio text
  searchByText: async (query: string, limit = 50) => {
    return Profile.find({ $text: { $search: query } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();
  },

  // Find profiles by interests
  findByInterests: async (interests: string[], limit = 50) => {
    return Profile.find({ interests: { $in: interests } }).limit(limit).lean();
  },

  // Update research data (from research worker)
  updateResearchData: async (id: string, data: { interests?: string[]; sentiment?: any; riskScore?: number }) => {
    return Profile.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
  },

  // Count by status for a campaign
  countByStatus: async (campaignId?: string) => {
    const filter: any = campaignId ? { campaignIds: campaignId } : {};
    const pipeline = [
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ];
    const results = await Profile.aggregate(pipeline);
    return results.reduce((acc: any, r: any) => { acc[r._id] = r.count; return acc; }, {});
  }
};

// ============================================================================
// Campaign Repository - Full CRUD per dev docs
// ============================================================================
export const CampaignRepo = {
  create: async (doc: any) => {
    const campaign = {
      ...doc,
      status: doc.status || "draft",
      stats: { profilesFound: 0, profilesApproved: 0, messagesSent: 0, responsesReceived: 0, conversionRate: 0 }
    };
    return Campaign.create(campaign);
  },

  findById: async (id: string) => Campaign.findById(id).lean(),

  findByUserId: async (userId: string, limit = 50, skip = 0) => {
    return Campaign.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  },

  list: async (filters: { status?: string; userId?: string } = {}, limit = 50, skip = 0) => {
    const q: any = {};
    if (filters.status) q.status = filters.status;
    if (filters.userId) q.userId = filters.userId;
    return Campaign.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  },

  update: async (id: string, updates: any) => {
    return Campaign.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
  },

  setStatus: async (id: string, status: string) => {
    return Campaign.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
  },

  updateStats: async (id: string, statUpdates: Partial<{ profilesFound: number; profilesApproved: number; messagesSent: number; responsesReceived: number }>) => {
    const incOps: any = {};
    Object.entries(statUpdates).forEach(([k, v]) => { incOps[`stats.${k}`] = v; });
    return Campaign.findByIdAndUpdate(id, { $inc: incOps, updatedAt: new Date() }, { new: true }).lean();
  },

  delete: async (id: string) => Campaign.findByIdAndDelete(id)
};

// ============================================================================
// Message Repository - Enhanced with delivery tracking
// ============================================================================
export const MessageRepo = {
  create: async (doc: any) => Message.create({ ...doc, status: doc.status || "pending" }),

  findById: async (id: string) => Message.findById(id).lean(),

  listByCampaign: async (campaignId: string, status?: string, limit = 50, skip = 0) => {
    const q: any = { campaignId };
    if (status) q.status = status;
    return Message.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  },

  listByProfile: async (profileId: string, limit = 50) => {
    return Message.find({ profileId }).sort({ createdAt: -1 }).limit(limit).lean();
  },

  setStatus: async (id: string, status: string, metadata?: any) => {
    const update: any = { status, updatedAt: new Date() };
    if (status === "sent") update.sentAt = new Date();
    if (metadata) update.metadata = metadata;
    return Message.findByIdAndUpdate(id, update, { new: true });
  },

  markDelivered: async (id: string) => {
    return Message.findByIdAndUpdate(id, { status: "delivered", updatedAt: new Date() }, { new: true });
  },

  markFailed: async (id: string, reason: string) => {
    return Message.findByIdAndUpdate(id, { status: "failed", "metadata.failureReason": reason, updatedAt: new Date() }, { new: true });
  },

  recordResponse: async (id: string, response: { received: boolean; content: string; timestamp: Date; sentiment?: number }) => {
    return Message.findByIdAndUpdate(id, { response, updatedAt: new Date() }, { new: true });
  },

  // Get pending messages scheduled for delivery
  getPendingScheduled: async (beforeDate: Date, limit = 100) => {
    return Message.find({ status: "pending", scheduledFor: { $lte: beforeDate } }).limit(limit).lean();
  },

  countByStatus: async (campaignId: string) => {
    const pipeline = [
      { $match: { campaignId: campaignId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ];
    const results = await Message.aggregate(pipeline);
    return results.reduce((acc: any, r: any) => { acc[r._id] = r.count; return acc; }, {});
  }
};

// ============================================================================
// User Repository - Enhanced with usage tracking
// ============================================================================
export const UserRepo = {
  findByEmail: async (email: string) => User.findOne({ email }).lean(),
  findById: async (id: string) => User.findById(id).lean(),
  findByUsername: async (username: string) => User.findOne({ username }).lean(),

  create: async (doc: any) => User.create(doc),

  update: async (id: string, updates: any) => {
    return User.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
  },

  linkOAuth: async (userId: string, provider: string, encryptedToken: string) => {
    return User.findByIdAndUpdate(
      userId,
      { $push: { apiKeys: { key: encryptedToken, name: provider, permissions: [], createdAt: new Date() } } },
      { new: true }
    );
  },

  updateUsageStats: async (userId: string, stats: Partial<{ profilesProcessed: number; messagesSent: number }>) => {
    const incOps: any = {};
    Object.entries(stats).forEach(([k, v]) => { incOps[`usageStats.${k}`] = v; });
    incOps["usageStats.lastLogin"] = new Date();
    return User.findByIdAndUpdate(userId, { $inc: incOps }, { new: true });
  },

  setRole: async (id: string, role: string) => {
    return User.findByIdAndUpdate(id, { role, updatedAt: new Date() }, { new: true });
  }
};

// ============================================================================
// Session Repository - Browser automation session management
// ============================================================================
export const SessionRepo = {
  create: async (doc: any) => Session.create({ ...doc, status: "active" }),

  findBySessionId: async (sessionId: string) => Session.findOne({ sessionId }).lean(),

  listActiveByPlatform: async (platform: string) => {
    return Session.find({ platform, status: "active" }).lean();
  },

  listByUser: async (userId: string) => {
    return Session.find({ userId }).sort({ createdAt: -1 }).lean();
  },

  updateLastValidated: async (sessionId: string) => {
    return Session.findOneAndUpdate({ sessionId }, { lastValidatedAt: new Date() }, { new: true });
  },

  setStatus: async (sessionId: string, status: string) => {
    return Session.findOneAndUpdate({ sessionId }, { status, updatedAt: new Date() }, { new: true });
  },

  expire: async (sessionId: string) => {
    return Session.findOneAndUpdate({ sessionId }, { status: "invalid", updatedAt: new Date() }, { new: true });
  },

  cleanup: async () => {
    // Remove expired sessions
    return Session.deleteMany({ expiresAt: { $lt: new Date() } });
  }
};

// ============================================================================
// Analytics Repository - Time-bucketed metrics per dev docs
// ============================================================================
export const AnalyticsRepo = {
  recordEvent: async (type: string, dimensions: { campaignId?: string; userId?: string; platform?: string }, metrics: Record<string, number>) => {
    const timeBucket = new Date();
    timeBucket.setMinutes(0, 0, 0); // Hourly bucket
    return Analytics.create({ type: "event", timeBucket, dimensions, metrics });
  },

  recordMetric: async (dimensions: { campaignId?: string; userId?: string; platform?: string }, metrics: Record<string, number>) => {
    const timeBucket = new Date();
    timeBucket.setMinutes(0, 0, 0);
    return Analytics.findOneAndUpdate(
      { type: "metric", timeBucket, "dimensions.campaignId": dimensions.campaignId },
      { $inc: metrics, $setOnInsert: { dimensions } },
      { upsert: true, new: true }
    );
  },

  getMetrics: async (query: { campaignId?: string; startDate?: Date; endDate?: Date; granularity?: string }) => {
    const match: any = { type: { $in: ["metric", "aggregate"] } };
    if (query.campaignId) match["dimensions.campaignId"] = query.campaignId;
    if (query.startDate || query.endDate) {
      match.timeBucket = {};
      if (query.startDate) match.timeBucket.$gte = query.startDate;
      if (query.endDate) match.timeBucket.$lte = query.endDate;
    }

    return Analytics.find(match).sort({ timeBucket: -1 }).limit(1000).lean();
  },

  aggregate: async (campaignId: string, startDate: Date, endDate: Date) => {
    const pipeline = [
      { $match: { "dimensions.campaignId": campaignId, timeBucket: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, totalProfiles: { $sum: "$metrics.profilesProcessed" }, totalMessages: { $sum: "$metrics.messagesSent" }, totalResponses: { $sum: "$metrics.responsesReceived" } } }
    ];
    const results = await Analytics.aggregate(pipeline);
    return results[0] || { totalProfiles: 0, totalMessages: 0, totalResponses: 0 };
  }
};

// ============================================================================
// Campaign Status Repository - Aggregated counts
// ============================================================================
export const CampaignStatusRepo = {
  countProfilesByStatus: async (campaignId: string) => {
    const pending = await Profile.countDocuments({ campaignIds: campaignId, status: "pending" });
    const approved = await Profile.countDocuments({ campaignIds: campaignId, status: "approved" });
    const rejected = await Profile.countDocuments({ campaignIds: campaignId, status: "rejected" });
    const engaged = await Profile.countDocuments({ campaignIds: campaignId, status: "engaged" });
    return { pending, approved, rejected, engaged };
  },

  countMessagesByStatus: async (campaignId: string) => {
    const pending = await Message.countDocuments({ campaignId, status: "pending" });
    const sent = await Message.countDocuments({ campaignId, status: "sent" });
    const delivered = await Message.countDocuments({ campaignId, status: "delivered" });
    const failed = await Message.countDocuments({ campaignId, status: "failed" });
    return { pending, sent, delivered, failed };
  },

  getConversionRate: async (campaignId: string) => {
    const totalMessages = await Message.countDocuments({ campaignId });
    const responses = await Message.countDocuments({ campaignId, "response.received": true });
    return totalMessages > 0 ? (responses / totalMessages) * 100 : 0;
  }
};