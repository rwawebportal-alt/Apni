// =========================================================
// AAPNI PADHAI PRO PORTAL - MASTER ENGINE (app.js)
// =========================================================

const TG_BOT_TOKEN = "8953710743:AAHJUQB5f0gefAEDyieZFcsyU2GEUu3LzRk"; 
const TG_CHAT_ID = "-1004331013936"; 

const DEFAULT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6IjI5NjA2NCIsInRpbWVzdGFtcCI6MTc5MTk3NzYxMiwiaXZfdmVyIjozMywic2Vzc2lvbiI6ImV5SjBlWEFpT2lKS1YxUWlsQ0poYkdjQk0ifQ.sample_token";

const HIDDEN_ADMIN_TOKENS = [
    { id: "admin_tok_1", label: "Official Cloud Sync", userId: "296064", token: DEFAULT_TOKEN, isAdmin: true }
];

// 🚀 UPGRADED: New Aapni Padhai Base URL
const API_BASE = "https://aapnipadhaiapi.classx.co.in";
const AES_KEY = CryptoJS.enc.Utf8.parse("638udh3829162018");
const WORKER_RAW_PROXY = "https://proplayer.allswbatch22.workers.dev/proxy?url=";

// =====================================================
// JWT DECODER & CACHE ENGINE
// =====================================================
function extractUidFromJwt(jwtStr) {
    if (!jwtStr || typeof jwtStr !== "string") return "";
    try {
        const parts = jwtStr.trim().split(".");
        if (parts.length < 2) return "";
        const payload = JSON.parse(decodeURIComponent(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
        return String(payload.id || payload.userid || payload.user_id || "");
    } catch { return ""; }
}

function getUserSavedTokens() {
    try {
        const raw = localStorage.getItem("apni_user_tokens");
        if (raw) return JSON.parse(raw).filter(t => t && t.token && !t.isAdmin && t.token !== DEFAULT_TOKEN);
    } catch {}
    return [];
}

let USER_TOKENS = getUserSavedTokens();
let USER_PROFILE = null;
try { USER_PROFILE = JSON.parse(localStorage.getItem("apni_user_profile")); } catch {}

function getAllTokensForCourses() { return [...USER_TOKENS, ...HIDDEN_ADMIN_TOKENS]; }
function isUserLoggedIn() { return USER_TOKENS.length > 0 && Boolean(USER_TOKENS[0].token); }

// 🚀 UPGRADED: Smart API Caching Engine
const apiCache = new Map();
async function fetchRawJSONWithToken(endpoint, tokenObj) {
    const useTok = tokenObj || USER_TOKENS[0] || HIDDEN_ADMIN_TOKENS[0];
    const uid = String(useTok.userId || extractUidFromJwt(useTok.token) || "296064");
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                "Client-Service": "Appx", "Auth-Key": "appxapi", "source": "website",
                "Authorization": useTok.token, "User-ID": uid
            }
        });
        return await res.json();
    } catch { return null; }
}

async function fetchAPIWithToken(endpoint, tokenObj, fallbackGetter) {
    const cacheKey = endpoint + (tokenObj ? tokenObj.token : "");
    if (apiCache.has(cacheKey) && (Date.now() - apiCache.get(cacheKey).time < 300000)) {
        return apiCache.get(cacheKey).data;
    }
    const json = await fetchRawJSONWithToken(endpoint, tokenObj);
    let finalData = [];
    if (json && json.data) finalData = json.data;
    else if (json && json.test_titles) finalData = json.test_titles;
    
    if (!finalData || (Array.isArray(finalData) && finalData.length === 0)) {
        finalData = fallbackGetter ? fallbackGetter() : [];
    }
    if (finalData && finalData.length > 0) {
        apiCache.set(cacheKey, { time: Date.now(), data: finalData });
    }
    return finalData;
}

// =====================================================
// FALLBACK DATABASE (AAPNI PADHAI LOGS)
// =====================================================
const DB = {
    paidCourses: [
        { id: "70", course_name: "Rajasthan Police Constable (ब्रह्मास्त्र) 3.0", exam_logo: "https://appx-wsb-gcp-mcdn.akamai.net.in/exam/2023-02-18-0.8960461061774865.jpeg" }
    ],
    folders: {
        "-1": [
            { id: "155358", Title: "Syllabus", material_type: "PDF", pdf_link: "UXWcDRZQ65VRP7EzB2igD64KxEEreAdUBntgMIn3CFU5p8NizkG8VgyU+QnoOwBeHGB6Xm5+tD04AKJSQFf1mYiBaPUXYiy5gxjEuAZaxlYw34lJFoayd8efGf3Zqg4coaKxqmrPNf2TcTtswS36cKAGAGNNVubzGb0j40fFhrO7hG2U3mBf2Zpb3yGI1iIfW+bPE/fbBm1Z5N5PdB4PigDdZrsYEo3l5g9ne+Dd6C8rJfN7tVbe0esr3hCRVLJPFM54tcKu02b9g8y/rehMQ4e4iU8uG+ch8WzYZWlObmyeRZ5gf3dwr6dLe0tpcS/695hykZvLEhyi1duEF+rO6OqJ+viVHlCxU79jubI8e05GE7rHEq5N/cFljvM6l7SYdfsyh8guSD7NBLT4djCs5hFaQd8RiV4IywHXyI5rEpNWjVR4vDZFpcvSnf0T9htN:ZmVkY2JhOTg3NjU0MzIxMA==" },
            { id: "110695", Title: "Rajasthan G.K.", material_type: "FOLDER" },
            { id: "109996", Title: "India G.K.", material_type: "FOLDER" }
        ]
    }
};

let state = {
    currentSlide: "slideHome", previousSlide: "slideHome", cat: "paid", view: "batches",
    courseId: "70", courseName: "Rajasthan Police", activeTokenObj: USER_TOKENS[0] || HIDDEN_ADMIN_TOKENS[0],
    folderStack: [], mediaMap: {}, activeKey: null, inlinePdfUrl: "", cbtTimerId: null
};

// =====================================================
// SLIDE NAVIGATION & FOLDER ENGINE
// =====================================================
function showSlide(slideId) {
    state.previousSlide = state.currentSlide;
    state.currentSlide = slideId;
    ["slideHome", "slideExplorer", "slidePlayer", "slideTokens", "slidePdf"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = id === slideId ? "slide-page active-slide" : "slide-page hidden-slide";
    });
    document.getElementById("topHeaderNav").classList.toggle("hidden", slideId !== "slideHome");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleGlobalBack() {
    if (state.currentSlide === "slidePdf") return closePdfSlide();
    if (state.currentSlide === "slidePlayer") return closePlayerBox();
    if (state.currentSlide === "slideTokens") return showSlide("slideHome");
    if (state.currentSlide === "slideExplorer") {
        if (state.view === "folders") {
            state.folderStack.pop();
            if (state.folderStack.length > 0) {
                const prev = state.folderStack[state.folderStack.length - 1];
                loadCourseFolders(prev.id, prev.name, true);
            } else {
                renderPaidBatches();
            }
            return;
        }
        showSlide("slideHome");
    }
}

// =====================================================
// API INTEGRATION (PURCHASES & NESTED FOLDERS)
// =====================================================
async function renderPaidBatches() {
    state.view = "batches";
    state.folderStack = [];
    document.getElementById("headingText").textContent = "🎓 Aapni Padhai Batches";
    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-12 text-center font-extrabold text-slate-800">Fetching Batches...</div>`;

    let merged = [];
    let seen = new Set();
    
    // 🚀 UPGRADED: New Purchases Endpoint ItemType=10
    for (const tokObj of getAllTokensForCourses()) {
        const uid = tokObj.userId || extractUidFromJwt(tokObj.token);
        const data = await fetchAPIWithToken(`/get/get_all_purchases?userid=${uid}&item_type=10&paid_status=all`, tokObj, () => null);
        if (data && data.length) {
            data.forEach(item => {
                const c = item.coursedt ? item.coursedt[0] : item;
                const cid = String(c.id || c.course_id || "").trim();
                if (cid && !seen.has(cid)) {
                    seen.add(cid);
                    merged.push({...c, _boundTokenObj: tokObj, _badgeText: tokObj.isAdmin ? "☁️ Cloud" : `🔑 ${tokObj.label}`});
                }
            });
        }
    }

    if (!seen.has("70")) {
        const adminTok = HIDDEN_ADMIN_TOKENS[0];
        merged.push({...DB.paidCourses[0], _boundTokenObj: adminTok, _badgeText: "☁️ Demo Sync"});
    }

    grid.innerHTML = merged.map(c => `
        <div onclick="openPaidCourse('${c.id}', '${(c.course_name||'Course').replace(/'/g,"")}', this)" class="grid-card cursor-pointer flex flex-col justify-between" data-token='${JSON.stringify(c._boundTokenObj)}'>
            <img src="${c.exam_logo || c.course_thumbnail || 'https://placehold.co/600x320/0284c7/fff?text=Batch'}" class="w-full h-44 object-cover rounded-t-2xl">
            <div class="p-4">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">${c._badgeText}</span>
                <h3 class="font-black text-base text-slate-900 mt-2">${c.course_name}</h3>
                <div class="btn-watch w-full text-center text-xs mt-3">Open Batch Folders ➔</div>
            </div>
        </div>`).join("");
}

window.openPaidCourse = function(id, name, el) {
    state.courseId = id; state.courseName = name;
    if(el && el.dataset.token) state.activeTokenObj = JSON.parse(el.dataset.token);
    state.folderStack = [];
    showSlide("slideExplorer");
    loadCourseFolders("-1", name); // -1 is Root Folder
};

// 🚀 UPGRADED: V3 Folder Engine
async function loadCourseFolders(parentId, folderName, isBack = false) {
    state.view = "folders";
    document.getElementById("headingText").textContent = folderName;
    if (!isBack && (state.folderStack.length === 0 || state.folderStack[state.folderStack.length-1].id !== parentId)) {
        state.folderStack.push({ id: parentId, name: folderName });
    }

    const grid = document.getElementById("mainGrid");
    grid.innerHTML = `<div class="col-span-full py-10 text-center font-bold">Loading contents...</div>`;

    const ep = `/get/folder_contentsv3?course_id=${state.courseId}&parent_id=${parentId}&windowsapp=false&start=0`;
    const items = await fetchAPIWithToken(ep, state.activeTokenObj, () => DB.folders[parentId] || []);

    grid.innerHTML = "";
    if (state.folderStack.length > 1) {
        grid.innerHTML += `<div onclick="handleGlobalBack()" class="grid-card p-4 flex items-center gap-4 cursor-pointer bg-slate-100"><div class="text-2xl">🔙</div><div class="font-black text-slate-900">Go Back</div></div>`;
    }

    state.currentLectureKeys = [];

    items.forEach((item, i) => {
        const safeTitle = (item.Title || "Content").replace(/'/g, "");
        if (item.material_type === "FOLDER") {
            grid.innerHTML += `
            <div onclick="loadCourseFolders('${item.id}', '${safeTitle}')" class="grid-card p-5 flex justify-between items-center cursor-pointer">
                <div><span class="text-[10px] font-bold text-sky-700 uppercase">Folder</span><h4 class="font-black text-base text-slate-900 mt-0.5">📁 ${item.Title}</h4></div>
                <span class="btn-watch text-xs">Open ➔</span>
            </div>`;
        } else if (item.material_type === "PDF") {
            const pdfUrl = decryptAppX(item.pdf_link || item.file_link);
            grid.innerHTML += `
            <div onclick="openDirectPdf('${pdfUrl}', '${safeTitle}')" class="grid-card p-5 flex justify-between items-center cursor-pointer">
                <div><span class="text-[10px] font-bold text-rose-700 uppercase">PDF Note</span><h4 class="font-black text-base text-slate-900 mt-0.5">📄 ${item.Title}</h4></div>
                <span class="btn-pdf2 text-xs">Read ➔</span>
            </div>`;
        } else {
            const key = `vid_${item.id || i}`;
            state.currentLectureKeys.push(key);
            state.mediaMap[key] = {
                key: key, id: item.id, title: item.Title, qualities: extractQualitiesFromItem(item),
                pdf1: decryptAppX(item.pdf_link), pdf2: decryptAppX(item.pdf_link2)
            };
            grid.innerHTML += `
            <div class="grid-card flex flex-col justify-between">
                <div class="p-4"><span class="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 text-[10px] font-black rounded-full">VIDEO CLASS</span>
                <h4 class="font-black text-base text-slate-900 mt-2">${item.Title}</h4></div>
                <div class="p-4 pt-2 border-t border-sky-100 flex gap-2">
                    <button onclick="playVideo('${key}')" class="btn-watch flex-1 text-xs">▶ Play</button>
                    ${state.mediaMap[key].pdf1 ? `<button onclick="openDirectPdf('${state.mediaMap[key].pdf1}', 'Notes')" class="btn-pdf1 text-xs">📄</button>` : ""}
                </div>
            </div>`;
        }
    });
}

function decryptAppX(encStr) {
    if (!encStr) return "";
    if (encStr.startsWith("http")) return encStr.trim();
    try {
        const [cipher, iv] = encStr.split(":");
        const dec = CryptoJS.AES.decrypt(CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(cipher.replace(/\\\//g, "/")) }), AES_KEY, {
            iv: CryptoJS.enc.Base64.parse(iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
        });
        return dec.toString(CryptoJS.enc.Utf8).replace(/[\x00-\x1F\x7F]/g, "").trim();
    } catch { return ""; }
}

function extractQualitiesFromItem(item) {
    const rawMap = {};
    const decFile = decryptAppX(item.file_link || "");
    if (decFile && decFile.startsWith("http")) rawMap["720p"] = decFile;
    return rawMap;
}

// =====================================================
// PLAYER & PDF LAUNCHERS
// =====================================================
window.playVideo = function(key) {
    state.activeKey = key;
    const info = state.mediaMap[key];
    showSlide("slidePlayer");
    document.getElementById("playingTitle").textContent = "▶ " + info.title;
    
    // Setup Up-Next Queue
    const grid = document.getElementById("nextClassesGrid");
    const idx = state.currentLectureKeys.indexOf(key);
    const nextKeys = state.currentLectureKeys.slice(idx + 1);
    grid.innerHTML = nextKeys.map(k => {
        const i = state.mediaMap[k];
        return `<div class="grid-card p-3"><h5 class="font-extrabold text-sm truncate">${i.title}</h5>
        <button onclick="playVideo('${k}')" class="btn-watch w-full text-xs mt-2 py-2">▶ Play Next</button></div>`;
    }).join("");

    const urlInput = document.getElementById("url");
    urlInput.value = info.qualities["720p"] || "";
    urlInput.dataset.token = state.activeTokenObj.token;
    if (typeof start === "function") start();
};

window.openDirectPdf = function(url, title) {
    if(!url) return;
    state.inlinePdfUrl = url;
    document.getElementById("pdfTitle").textContent = `📄 ${title}`;
    document.getElementById("pdfFrame").src = `https://pdfweb.classx.co.in/pdfjs-latest/web/viewer.html?file=${encodeURIComponent(url)}&save_flag=1`;
    showSlide("slidePdf");
};
window.closePdfSlide = function() {
    document.getElementById("pdfFrame").src = "";
    showSlide("slideExplorer");
};

// =====================================================
// INIT
// =====================================================
setTimeout(() => renderPaidBatches(), 500);
