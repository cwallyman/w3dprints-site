const SEPTA_BASE_URL = "http://www3.septa.org/hackathon/NextToArrive/";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function textResponse(message, status = 400) {
  return new Response(message, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/api/next-trains") {
      return textResponse("Not found.", 404);
    }

    const origin = (url.searchParams.get("origin") || "").trim();
    const destination = (url.searchParams.get("destination") || "").trim();

    if (!origin || !destination) {
      return textResponse("Missing origin or destination.", 400);
    }

    const septaUrl = new URL(SEPTA_BASE_URL);
    septaUrl.searchParams.set("req1", origin);
    septaUrl.searchParams.set("req2", destination);
    septaUrl.searchParams.set("req3", "3");

    let response;
    try {
      response = await fetch(septaUrl.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "w3dprints-next-trains-proxy",
        },
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        },
      });
    } catch (error) {
      return textResponse(`Could not reach the SEPTA API: ${error.message}`, 502);
    }

    if (!response.ok) {
      return textResponse(`SEPTA returned ${response.status}.`, 502);
    }

    let trains;
    try {
      trains = await response.json();
    } catch (_error) {
      return textResponse("SEPTA returned an unreadable response.", 502);
    }

    return jsonResponse(trains);
  },
};
