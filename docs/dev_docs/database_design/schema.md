# Database Design & Implementation

## Database Architecture Overview

The system employs a **hybrid database architecture** combining MongoDB for flexible document storage and Redis for high-performance caching and session management. This approach provides the flexibility needed for varying profile data structures while ensuring optimal performance for critical operations.

## MongoDB Schema Design

### Core Collections

#### 1. Profiles Collection
**Purpose**: Stores all acquired and processed profile information

**Document Shape**:
```
{
  _id: ObjectId,
  platform: String,              // e.g., twitter, instagram, linkedin
  platformId: String,           // platform-specific unique id
  username: String,             // handle
  displayName: String,
  profileUrl: String,
  avatarUrl: String,
  bio: String,
  metadata: {
    followers: Number,
    following: Number,
    postsCount: Number,
    verified: Boolean,
    location: String,
    joinDate: Date,
    lastActive: Date
  },
  posts: [{
    id: String,
    content: String,
    timestamp: Date,
    engagement: { likes: Number, comments: Number, shares: Number }
  }],
  interests: [String],
  sentiment: { overall: Number, confidence: Number },
  riskScore: Number,            // 0–100
  status: String,               // pending, approved, rejected, engaged
  campaignIds: [ObjectId],
  createdAt: Date,
  updatedAt: Date,
  version: Number
}
```

**Validation (JSON Schema)**:
```
{ $jsonSchema: {
    bsonType: "object",
    required: ["platform", "username", "status", "createdAt"],
    properties: {
      platform: { bsonType: "string" },
      platformId: { bsonType: "string" },
      username: { bsonType: "string" },
      status: { enum: ["pending", "approved", "rejected", "engaged"] },
      metadata: { bsonType: "object" },
      posts: { bsonType: "array" },
      riskScore: { bsonType: "double" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      version: { bsonType: "int" }
    }
}}
```

**Indexes**:
- `unique` `{ platform: 1, username: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ interests: 1 }` (multikey)
- Text index on `bio` and `posts.content` for keyword search
- Partial index on `{ status: "approved" }` for common queries

**Notes**:
- Use optimistic concurrency via `version` field with compare-and-swap updates

#### 2. Campaigns Collection
**Purpose**: Manages acquisition campaigns and their configurations

**Document Shape**:
```
{
  _id: ObjectId,
  userId: ObjectId,
  name: String,
  description: String,
  targetCriteria: {
    platforms: [String],
    ageRange: { min: Number, max: Number },
    locations: [String],
    interests: [String],
    keywords: [String],
    followersRange: { min: Number, max: Number }
  },
  status: String,               // draft, active, paused, completed
  settings: {
    maxProfilesPerDay: Number,
    messageDelay: Number,
    retryAttempts: Number
  },
  stats: {
    profilesFound: Number,
    profilesApproved: Number,
    messagesSent: Number,
    responsesReceived: Number,
    conversionRate: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Validation**:
```
{ $jsonSchema: {
  bsonType: "object",
  required: ["userId", "name", "status", "createdAt"],
  properties: { status: { enum: ["draft", "active", "paused", "completed"] } }
}}
```

**Indexes**:
- `{ userId: 1, createdAt: -1 }`
- `{ status: 1 }`
- `{ conversionRate: -1 }`

#### 3. Messages Collection
**Purpose**: Tracks all sent messages and responses

**Document Shape**:
```
{
  _id: ObjectId,
  campaignId: ObjectId,
  profileId: ObjectId,
  type: String,                 // initial, follow_up, custom
  content: String,
  platform: String,
  status: String,               // pending, sent, delivered, failed
  scheduledFor: Date,
  sentAt: Date,
  response: {
    received: Boolean,
    content: String,
    timestamp: Date,
    sentiment: Number
  },
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

**Validation**:
```
{ $jsonSchema: {
  bsonType: "object",
  required: ["campaignId", "profileId", "type", "status", "createdAt"],
  properties: { status: { enum: ["pending", "sent", "delivered", "failed"] } }
}}
```

**Indexes**:
- `{ campaignId: 1, profileId: 1 }`
- `{ status: 1, scheduledFor: 1 }`
- `{ sentAt: -1 }`

#### 4. Users Collection
**Purpose**: User management and authentication

**Document Shape**:
```
{
  _id: ObjectId,
  email: String,
  username: String,
  passwordHash: String,
  role: String,                 // admin, operator, viewer
  permissions: [String],
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    preferences: Object
  },
  apiKeys: [{ key: String, name: String, permissions: [String], createdAt: Date, lastUsed: Date }],
  usageStats: { profilesProcessed: Number, messagesSent: Number, lastLogin: Date },
  createdAt: Date,
  updatedAt: Date
}
```

**Validation**:
```
{ $jsonSchema: {
  bsonType: "object",
  required: ["email", "username", "role", "createdAt"],
  properties: { role: { enum: ["admin", "operator", "viewer"] } }
}}
```

**Indexes**:
- `unique` `{ email: 1 }`, `unique` `{ username: 1 }`
- `{ role: 1 }`

### Additional Collections

#### 5. Analytics Collection
**Purpose**: Aggregated analytics and reporting data

**Document Shape**:
```
{
  _id: ObjectId,
  type: String,                 // metric, event, aggregate
  timeBucket: Date,             // e.g., hour/day
  dimensions: { campaignId?: ObjectId, userId?: ObjectId, platform?: String },
  metrics: { [key: string]: Number },
  createdAt: Date
}
```

**Indexes**:
- `{ type: 1, timeBucket: -1 }`
- `{ "dimensions.campaignId": 1, timeBucket: -1 }`
- TTL optional for raw events (e.g., 90 days)

#### 6. Sessions Collection
**Purpose**: Browser automation session management

**Document Shape**:
```
{
  _id: ObjectId,
  platform: String,
  sessionId: String,
  userId: ObjectId,
  proxy: { host: String, port: Number, username?: String },
  userAgent: String,
  cookiesEncrypted: String,     // field-level encrypted blob
  lastValidatedAt: Date,
  createdAt: Date,
  expiresAt: Date,
  status: String                // active, degraded, invalid
}
```

**Indexes**:
- `{ platform: 1, userId: 1 }`
- TTL index on `expiresAt`
- `{ status: 1, lastValidatedAt: -1 }`

**Lifecycle**:
- Create → validate → use → rotate → purge; emit audit events on changes

### Sharding Strategy

- Shard by `campaignId` or `userId` depending on access patterns
- Recommended: hashed sharding on `userId` for `profiles`, `campaigns`, `messages`
- Pre-split chunks for expected throughput; monitor balancer activity

### Write & Access Patterns
- Upserts for profiles by `{ platform, username }`
- Optimistic concurrency via `version` field updates
- Denormalize frequently-used fields (e.g., `displayName`, `avatarUrl`) into messages

### Data Lifecycle & Retention
- Profiles: retain indefinitely; archive inactive (>12 months) to cold storage
- Messages: retain 24 months; anonymize content after 12 months if required by policy
- Sessions: TTL enforced; purge on detection signals
- Backups: daily incremental + weekly full; PITR enabled; quarterly restore drills










