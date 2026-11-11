export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (OPTIONS request) 
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Error: URL parameter is missing.", { status: 400 });
    }

    // 2. Clone ALL incoming headers (like Authorization, User-ID from client)
    const modifiedHeaders = new Headers(request.headers);

    // 3. Override STRICT Security Headers matching ApniPadhai App/Web logs
    modifiedHeaders.set("sec-ch-ua", '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"');
    modifiedHeaders.set("sec-ch-ua-mobile", "?0");
    modifiedHeaders.set("Accept", "*/*");
    modifiedHeaders.set("sec-ch-ua-platform", '"Windows"');
    modifiedHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36");
    
    // FORBIDDEN HEADERS SPOOFING
    modifiedHeaders.set("Origin", "https://apnipadhai.org");
    modifiedHeaders.set("Referer", "https://apnipadhai.org/");

    try {
      // 4. Send request to Actual Server (Supporting POST body for Login)
      const fetchOptions = {
        method: request.method,
        headers: modifiedHeaders,
        redirect: "follow"
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        fetchOptions.body = request.body;
      }

      const targetResponse = await fetch(targetUrl, fetchOptions);

      // 5. Rewrite Response Headers so Browser doesn't block video & JSON
      const responseHeaders = new Headers(targetResponse.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "*");

      return new Response(targetResponse.body, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: responseHeaders
      });
    } catch (e) {
      return new Response("Worker Fetch Error: " + e.message, { status: 500 });
    }
  }
};
