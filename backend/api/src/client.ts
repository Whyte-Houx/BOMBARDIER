import { CampaignStartSchema } from "./dto.js";

export async function startPipeline(baseUrl: string, body: unknown) {
  const parsed = CampaignStartSchema.parse(body);
  const res = await fetch(baseUrl + "/pipeline/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}