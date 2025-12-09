export type RawProfile = { username: string };
export async function filterProfiles(_profiles: RawProfile[]) {
  return { approved: [], rejected: [] };
}