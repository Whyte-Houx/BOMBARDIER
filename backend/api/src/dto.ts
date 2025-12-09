import { z } from "zod";

// Campaign Schemas
export const TargetCriteriaSchema = z.object({
  platforms: z.array(z.string()).min(1),
  ageRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  locations: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  followersRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
});

export const CampaignSettingsSchema = z.object({
  maxProfilesPerDay: z.number().min(1).max(1000).optional(),
  messageDelay: z.number().min(0).optional(), // seconds between messages
  retryAttempts: z.number().min(0).max(10).optional(),
});

export const CampaignStartSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  targetCriteria: TargetCriteriaSchema,
  settings: CampaignSettingsSchema.optional(),
});

export const CampaignUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  targetCriteria: TargetCriteriaSchema.partial().optional(),
  settings: CampaignSettingsSchema.optional(),
});

// Profile Schemas
export const ProfileMetadataSchema = z.object({
  followers: z.number().optional(),
  following: z.number().optional(),
  postsCount: z.number().optional(),
  verified: z.boolean().optional(),
  location: z.string().optional(),
  joinDate: z.string().datetime().optional(),
  lastActive: z.string().datetime().optional(),
});

export const ProfilePostSchema = z.object({
  id: z.string(),
  content: z.string(),
  timestamp: z.string().datetime(),
  engagement: z.object({
    likes: z.number().optional(),
    comments: z.number().optional(),
    shares: z.number().optional(),
  }).optional(),
});

export const ProfileCreateSchema = z.object({
  platform: z.string().min(1),
  platformId: z.string().optional(),
  username: z.string().min(1),
  displayName: z.string().optional(),
  profileUrl: z.string().url().optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().optional(),
  metadata: ProfileMetadataSchema.optional(),
  posts: z.array(ProfilePostSchema).optional(),
  interests: z.array(z.string()).optional(),
  sentiment: z.object({ overall: z.number(), confidence: z.number() }).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  status: z.enum(["pending", "approved", "rejected", "engaged"]).optional(),
  campaignIds: z.array(z.string()).optional(),
});

// Message Schemas
export const MessageCreateSchema = z.object({
  campaignId: z.string(),
  profileId: z.string(),
  type: z.enum(["initial", "follow_up", "custom"]).optional(),
  content: z.string().min(1),
  platform: z.string(),
  status: z.enum(["pending", "sent", "delivered", "failed"]).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const MessageGenerateSchema = z.object({
  campaignId: z.string(),
  profileId: z.string(),
  type: z.enum(["initial", "follow_up", "custom"]).optional(),
  context: z.object({
    tone: z.enum(["formal", "casual", "playful"]).optional(),
    maxLength: z.number().min(10).max(2000).optional(),
  }).optional(),
});

// Analytics Schemas
export const AnalyticsQuerySchema = z.object({
  campaignId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z.enum(["hour", "day", "week"]).optional(),
});

// Export types
export type CampaignStart = z.infer<typeof CampaignStartSchema>;
export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;
export type ProfileCreate = z.infer<typeof ProfileCreateSchema>;
export type MessageCreate = z.infer<typeof MessageCreateSchema>;
export type MessageGenerate = z.infer<typeof MessageGenerateSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;