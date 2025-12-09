import { expect, test } from "vitest";
import { CampaignStartSchema } from "../../../app/backend/api/src/dto";

test("campaign dto valid", () => {
  const res = CampaignStartSchema.safeParse({ name: "Test", targetCriteria: { platforms: ["twitter"] } });
  expect(res.success).toBe(true);
});

test("campaign dto invalid", () => {
  const res = CampaignStartSchema.safeParse({ name: "Test", targetCriteria: { platforms: "twitter" } as any });
  expect(res.success).toBe(false);
});