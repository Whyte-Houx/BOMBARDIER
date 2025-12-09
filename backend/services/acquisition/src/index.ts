export type AcquisitionCriteria = { platforms: string[] };
export async function startAcquisition(_campaignId: string, _criteria: AcquisitionCriteria) {
  return { jobId: "dev" };
}