export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (OPTIONS request) - ताकि ब्राउज़र ब्लॉक न करे
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
      return new Response("Error: URL parameter is missing. Example: ?url=https://example.com/video.m3u8", { status: 400 });
    }

    // 2. Hardcoded Secure Headers (UPGRADED FROM LOGS)
    const modifiedHeaders = new Headers();
    modifiedHeaders.set("sec-ch-ua", '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"');
    modifiedHeaders.set("sec-ch-ua-mobile", "?0");
    modifiedHeaders.set("Accept", "*/*");
    modifiedHeaders.set("sec-ch-ua-platform", '"Windows"');
    modifiedHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36");
    
    // Origin और Referer को new endpoints के हिसाब से सेट किया है
    modifiedHeaders.set("Origin", "https://apnipadhai.org");
    modifiedHeaders.set("Referer", "https://apnipadhai.org/");
    modifiedHeaders.set("auth-key", "appxapi");
    modifiedHeaders.set("client-service", "Appx");

    try {
      // 3. Akamai/Target Server को रिक्वेस्ट भेजें (With proper Body forwarding for POST logins)
      const fetchOptions = {
        method: request.method,
        headers: modifiedHeaders,
        redirect: "follow"
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        fetchOptions.body = request.body;
      }

      const targetResponse = await fetch(targetUrl, fetchOptions);

      // 4. Response Headers को मॉडिफाई करें ताकि ब्राउज़र ब्लॉक न करे
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
