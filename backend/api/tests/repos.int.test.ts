import { expect, test, beforeAll, afterEach } from "vitest";
import { connectMongo, Profile } from "../src/lib/mongo";
import { ProfileRepo } from "../src/repos";

beforeAll(async () => {
  const uri = process.env.MONGO_URL || "mongodb://localhost:27017/bombardier_test";
  await connectMongo(uri);
});

afterEach(async () => {
  await Profile.deleteMany({});
});

test("upsert and find profiles by status", async () => {
  await ProfileRepo.upsertByPlatformUsername({ platform: "twitter", username: "alice", status: "pending" });
  await ProfileRepo.upsertByPlatformUsername({ platform: "twitter", username: "bob", status: "approved" });
  const pending = await ProfileRepo.findByStatus("pending", 10);
  expect(pending.length).toBe(1);
  expect(pending[0].username).toBe("alice");
});