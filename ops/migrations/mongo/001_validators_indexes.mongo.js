db.createCollection("profiles", {
  validator: {
    $jsonSchema: {
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
    }
  },
  validationLevel: "moderate"
});
db.profiles.createIndex({ platform: 1, username: 1 }, { unique: true });
db.profiles.createIndex({ status: 1, createdAt: -1 });
db.profiles.createIndex({ interests: 1 });
db.profiles.createIndex({ bio: "text", "posts.content": "text" });
db.profiles.createIndex({ status: 1 }, { partialFilterExpression: { status: "approved" } });

db.createCollection("campaigns", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "name", "status", "createdAt"],
      properties: { status: { enum: ["draft", "active", "paused", "completed"] } }
    }
  },
  validationLevel: "moderate"
});
db.campaigns.createIndex({ userId: 1, createdAt: -1 });
db.campaigns.createIndex({ status: 1 });
db.campaigns.createIndex({ "stats.conversionRate": -1 });

db.createCollection("messages", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["campaignId", "profileId", "type", "status", "createdAt"],
      properties: { status: { enum: ["pending", "sent", "delivered", "failed"] } }
    }
  },
  validationLevel: "moderate"
});
db.messages.createIndex({ campaignId: 1, profileId: 1 });
db.messages.createIndex({ status: 1, scheduledFor: 1 });
db.messages.createIndex({ sentAt: -1 });

db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "username", "role", "createdAt"],
      properties: { role: { enum: ["admin", "operator", "viewer"] } }
    }
  },
  validationLevel: "moderate"
});
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

db.createCollection("analytics");
db.analytics.createIndex({ type: 1, timeBucket: -1 });
db.analytics.createIndex({ "dimensions.campaignId": 1, timeBucket: -1 });

db.createCollection("sessions");
db.sessions.createIndex({ platform: 1, userId: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.sessions.createIndex({ status: 1, lastValidatedAt: -1 });