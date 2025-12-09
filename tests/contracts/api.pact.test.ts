import { PactV3 } from "@pact-foundation/pact";
import { expect, test } from "vitest";

test("health contract", async () => {
  const provider = new PactV3({ consumer: "dashboard", provider: "api" });
  provider.given("server up").uponReceiving("GET /health").withRequest({ method: "GET", path: "/health/" }).willRespondWith({ status: 200 });
  await provider.executeTest(async (mock) => {
    const res = await fetch(mock.url + "/health/");
    expect(res.status).toBe(200);
  });
});