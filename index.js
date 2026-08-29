/* =========================================================
   SNAP-TO-STOP ALARM - FIXED VERSION
   (Detection + Theme fixed)
========================================================= */

sessionStorage.removeItem("snapGuestSession");
sessionStorage.removeItem("snapAlarms");
sessionStorage.removeItem("snapCompleted");
let alarms = JSON.parse(localStorage.getItem("snapAlarms")) || [];
let completed = JSON.parse(localStorage.getItem("snapCompleted")) || [];
let currentAlarm = null;
let cameraStream = null;
let practiceStream = null;
let alarmAudio = null;
let volume = Number(localStorage.getItem("alarmVolume")) || 0.8;
let selectedAlarmSound = localStorage.getItem("alarmSound") || "extreme";
const alarmSounds = {
    classic: { tones: [880, 660], noteDuration: 400, pause: 650 },
    gentle: { tones: [523, 659, 784], noteDuration: 260, pause: 520 },
    digital: { tones: [1047, 1047, 784], noteDuration: 150, pause: 360 },
    extreme: { tones: [1047, 880, 1047, 880], noteDuration: 180, pause: 280 },
    "super-extreme": { tones: [1319, 1047, 1568, 1047], noteDuration: 120, pause: 210, maxVolume: 0.65 }
};
let cocoModel = null;
let isDetecting = false;

const introVideo = document.getElementById("introVideo");
const introVideoPlayer = document.getElementById("introVideoPlayer");
const introFeaturePlayer = document.querySelector(".intro-feature-player");
const watchIntroButton = document.getElementById("watchIntroButton");
const introGoogleButton = document.getElementById("introGoogleButton");
const introFacebookButton = document.getElementById("introFacebookButton");
const guestIntroButton = document.getElementById("guestIntroButton");
const guestInfoModal = document.getElementById("guestInfoModal");
const guestInfoForm = document.getElementById("guestInfoForm");
const guestBackBtn = document.getElementById("guestBackBtn");
const videoPlaybackRate = 1.5;

[introVideoPlayer, introFeaturePlayer].forEach((video) => {
    if (video) {
        video.defaultPlaybackRate = videoPlaybackRate;
        video.playbackRate = videoPlaybackRate;
    }
});

function isGuestSession() {
    return sessionStorage.getItem("snapGuestSession") === "true";
}

function closeIntro() {
    if (introVideoPlayer) {
        introVideoPlayer.pause();
        introVideoPlayer.currentTime = 0;
    }
    document.body.classList.remove("intro-active");
    introVideo.classList.add("hidden");
    introVideo.setAttribute("aria-hidden", "true");
}

function startIntro() {
    document.body.classList.add("intro-active");
    introVideo.classList.remove("hidden");
    introVideo.setAttribute("aria-hidden", "false");
    if (introVideoPlayer) {
        introVideoPlayer.currentTime = 0;
        introVideoPlayer.playbackRate = videoPlaybackRate;
        introVideoPlayer.play().catch(() => { });
    }
}

function replayIntro() {
    startIntro();
}

function chooseIntroAccess(provider) {
    if (provider === "Guest") {
        localStorage.removeItem("snapLoggedIn");
        localStorage.removeItem("snapAuthProvider");
        sessionStorage.removeItem("snapGuestSession");
        if (guestInfoModal) {
            document.body.classList.add("intro-active");
            prefillGuestForm();
            guestInfoModal.classList.remove("hidden");
        }
    } else {
        sessionStorage.removeItem("snapGuestSession");
        localStorage.setItem("snapAuthProvider", provider);
        setLoggedInState(true);
    }
    updateAccountAuthUI();
    renderAlarms();
    updateDashboard();
    closeIntro();
}

function openFacebookLogin() {
    window.open("https://www.facebook.com/login.php", "_blank", "noopener,noreferrer");
}

function openGoogleLogin() {
    window.open("https://accounts.google.com/ServiceLogin", "_blank", "noopener,noreferrer");
}

introGoogleButton.addEventListener("click", openGoogleLogin);
introFacebookButton.addEventListener("click", openFacebookLogin);
guestIntroButton.addEventListener("click", () => chooseIntroAccess("Guest"));
watchIntroButton.addEventListener("click", replayIntro);
startIntro();

/* Objects that COCO-SSD detects well + aliases */
const objects = [
    { name: "PERSON", emoji: "\uD83D\uDC64", classes: ["person"] },
    { name: "BOTTLE", emoji: "\uD83E\uDDF4", classes: ["bottle"] },
    { name: "CHAIR", emoji: "\uD83E\uDE91", classes: ["chair"] },
    { name: "LAPTOP", emoji: "\uD83D\uDCBB", classes: ["laptop"] },
    { name: "CELL PHONE", emoji: "\uD83D\uDCF1", classes: ["cell phone", "cellphone", "phone", "mobile phone"] },
    { name: "BACKPACK", emoji: "\uD83C\uDF92", classes: ["backpack"] },
    { name: "CLOCK", emoji: "\u23F0", classes: ["clock"] },
    { name: "KEYBOARD", emoji: "\u2328\uFE0F", classes: ["keyboard"] },
    { name: "MOUSE", emoji: "\uD83D\uDDB1\uFE0F", classes: ["mouse"] },
    { name: "BOOK", emoji: "\uD83D\uDCD5", classes: ["book"] },
    { name: "CUP", emoji: "\u2615", classes: ["cup", "mug"] },
    { name: "SCISSORS", emoji: "\u2702\uFE0F", classes: ["scissors"] },
    { name: "SPOON", emoji: "\uD83E\uDD44", classes: ["spoon"] }
];

/* ================= DOM ================= */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarThemeButton = document.getElementById("sidebarThemeButton");
const sidebarHelpButton = document.getElementById("sidebarHelpButton");
const topHelpButton = document.getElementById("topHelpButton");
const themeButton = document.getElementById("themeButton");
const mobileThemeButton = document.getElementById("mobileThemeButton");
const searchButton = document.getElementById("searchButton");
const helpButton = document.getElementById("helpButton");
const chatbotButton = document.getElementById("chatbotButton");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const feedbackButton = document.getElementById("feedbackButton");
const notificationButton = document.getElementById("notificationButton");
const notificationPanel = document.getElementById("notificationPanel");
const notificationBadge = document.getElementById("notificationBadge");
const notificationSummary = document.getElementById("notificationSummary");
const headerNotificationList = document.getElementById("headerNotificationList");
const clearNotificationsButton = document.getElementById("clearNotificationsButton");
const searchPanel = document.getElementById("searchPanel");
const helpPanel = document.getElementById("helpPanel");
const profileButton = document.getElementById("profileButton");
const profilePanel = document.getElementById("profilePanel");
const feedbackModal = document.getElementById("feedbackModal");
const feedbackForm = document.getElementById("feedbackForm");
const feedbackToast = document.getElementById("feedbackToast");
const panelFeedbackBtn = document.getElementById("panelFeedbackBtn");
const accountLoginBtn = document.getElementById("accountLoginBtn");
const accountSignupBtn = document.getElementById("accountSignupBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const facebookLoginBtn = document.getElementById("facebookLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const accountAuthTitle = document.getElementById("accountAuthTitle");
const accountAuthMessage = document.getElementById("accountAuthMessage");
const alarmLoginAlert = document.getElementById("alarmLoginAlert");
const panelGoogleBtn = document.getElementById("panelGoogleBtn");
const panelFacebookBtn = document.getElementById("panelFacebookBtn");
const panelGuestBtn = document.getElementById("panelGuestBtn");
const settingsTheme = document.getElementById("settingsTheme");
const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authModalTitle = document.getElementById("authModalTitle");
const authNameGroup = document.getElementById("authNameGroup");
const authConfirmGroup = document.getElementById("authConfirmGroup");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const openSignupBtn = document.getElementById("openSignupBtn");
const openLoginBtn = document.getElementById("openLoginBtn");
const openForgotBtn = document.getElementById("openForgotBtn");
const openChangePasswordBtn = document.getElementById("openChangePasswordBtn");
const profilePictureInput = document.getElementById("profilePictureInput");
const profileRole = document.getElementById("profileRole");
const activityHistory = document.getElementById("activityHistory");
const notificationList = document.getElementById("notificationList");
const markNotificationsRead = document.getElementById("markNotificationsRead");
const loadingOverlay = document.getElementById("loadingOverlay");
const backToTop = document.getElementById("backToTop");
let authMode = "signup";
const profileForm = document.getElementById("profileForm");
const profilePanelForm = document.getElementById("profilePanelForm");
const siteSearchInput = document.getElementById("siteSearchInput");
const searchResults = document.getElementById("searchResults");
const panelCloseButtons = document.querySelectorAll(".panel-close");
const alarmForm = document.getElementById("alarmForm");
const alarmList = document.getElementById("alarmList");
const alarmOverlay = document.getElementById("alarmOverlay");
const successOverlay = document.getElementById("successOverlay");
const ringingActivity = document.getElementById("ringingActivity");
const targetObjectEl = document.getElementById("targetObject");
const targetName = document.getElementById("targetName");
const camera = document.getElementById("camera");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const startCameraBtn = document.getElementById("startCamera");
const captureButton = document.getElementById("captureButton");
const verificationMessage = document.getElementById("verificationMessage");
const snoozeButton = document.getElementById("snoozeButton");
const closeSuccess = document.getElementById("closeSuccess");
const testSound = document.getElementById("testSound");
const alarmSoundSelect = document.getElementById("alarmSoundSelect");
const volumeControl = document.getElementById("volumeControl");
const canvas = document.getElementById("canvas");
const challengeDifficulty = document.getElementById("challengeDifficulty");
const alarmDifficulty = document.getElementById("alarmDifficulty");
const alarmTimerPreview = document.getElementById("alarmTimerPreview");
const challengeTimerMessage = document.getElementById("challengeTimerMessage");
const practiceTimer = document.getElementById("practiceTimer");
const alarmTimer = document.getElementById("alarmTimer");
const calendarView = document.getElementById("calendarView");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const xpCurrent = document.getElementById("xpCurrent");
const xpProgressFill = document.getElementById("xpProgressFill");
const xpCaption = document.getElementById("xpCaption");
const levelBadge = document.getElementById("levelBadge");
const levelTitle = document.getElementById("levelTitle");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

let xp = Number(localStorage.getItem("snapXP")) || 750;
let currentCalendarMonth = new Date();
let challengeCountdown = null;
let challengeSecondsLeft = 60;
const challengeLevels = {
    relaxed: { label: "Relaxed", seconds: 90, xp: 70 },
    easy: { label: "Easy", seconds: 60, xp: 90 },
    normal: { label: "Normal", seconds: 45, xp: 120 },
    hard: { label: "Hard", seconds: 35, xp: 170 },
    extreme: { label: "Extreme", seconds: 25, xp: 220 }
};
const levelTitles = [
    "New Student",
    "Focused Student",
    "Homework Hero",
    "Reliable Planner",
    "Goal Setter",
    "Discipline Master",
    "Productivity Star",
    "Focused Student",
    "Daily Champion",
    "Master of Routine"
];

/* ================= NAVIGATION ================= */
document.querySelectorAll("[data-section]").forEach(btn => {
    btn.addEventListener("click", () => {
        showSection(btn.dataset.section);
        closeSidebar();
    });
});

function showSection(id) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");

    document.querySelectorAll(".menu-item").forEach(item => {
        item.classList.toggle("active", item.dataset.section === id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ================= SIDEBAR ================= */
sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("show");
});
sidebarOverlay.addEventListener("click", closeSidebar);

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
}

/* ================= THEME (FIXED) ================= */
function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.add("dark");
    } else {
        document.body.classList.remove("dark");
    }
    localStorage.setItem("snapTheme", isDark ? "dark" : "light");
    updateThemeButton();
}

function updateThemeButton() {
    const isDark = document.body.classList.contains("dark");
    const icon = isDark ? "\u2600\uFE0F" : "\uD83C\uDF19";
    const text = isDark ? "Light Mode" : "Dark Mode";

    const themeIcon = document.getElementById("themeIcon");
    const sidebarThemeIcon = document.getElementById("sidebarThemeIcon");
    const sidebarThemeText = document.getElementById("sidebarThemeText");

    if (themeIcon) themeIcon.textContent = icon;
    if (sidebarThemeIcon) sidebarThemeIcon.textContent = icon;
    if (sidebarThemeText) sidebarThemeText.textContent = text;
    if (mobileThemeButton) mobileThemeButton.textContent = icon;
}

function toggleTheme() {
    const isDark = !document.body.classList.contains("dark");
    applyTheme(isDark);
}

function applyColorPalette(palette) {
    const palettes = {
        classic: { primary: "#6366f1", primaryDark: "#4f46e5", success: "#10b981" },
        ocean: { primary: "#0e7490", primaryDark: "#155e75", success: "#14b8a6" },
        sunset: { primary: "#c2410c", primaryDark: "#9a3412", success: "#f59e0b" },
        forest: { primary: "#166534", primaryDark: "#14532d", success: "#84cc16" }
    };
    const selectedPalette = palettes[palette] ? palette : "classic";
    const colors = palettes[selectedPalette];
    document.documentElement.style.setProperty("--primary", colors.primary);
    document.documentElement.style.setProperty("--primary-dark", colors.primaryDark);
    document.documentElement.style.setProperty("--success", colors.success);
    document.querySelectorAll("[data-palette]").forEach((button) => {
        const selected = button.dataset.palette === selectedPalette;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    localStorage.setItem("snapColorPalette", selectedPalette);
}

function toggleUtilityPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const allPanels = [searchPanel, helpPanel, profilePanel, feedbackModal, notificationPanel];
    allPanels.forEach((item) => {
        if (item && item !== panel) item.classList.add("hidden");
    });

    panel.classList.toggle("hidden");
}

function showFeedbackToast(message = "Feedback sent successfully.") {
    if (!feedbackToast) return;

    feedbackToast.querySelector("p").textContent = message;
    feedbackToast.classList.remove("hidden");

    clearTimeout(showFeedbackToast.timeoutId);
    showFeedbackToast.timeoutId = setTimeout(() => {
        feedbackToast.classList.add("hidden");
    }, 2600);
}

function closeAllUtilityPanels() {
    [searchPanel, helpPanel, profilePanel, feedbackModal, notificationPanel].forEach((item) => item && item.classList.add("hidden"));
    if (chatbotButton) chatbotButton.setAttribute("aria-expanded", "false");
    if (notificationButton) notificationButton.setAttribute("aria-expanded", "false");
}

function openChatbot() {
    closeAllUtilityPanels();
    if (helpPanel) helpPanel.classList.remove("hidden");
    if (chatbotButton) chatbotButton.setAttribute("aria-expanded", "true");
    if (chatInput) chatInput.focus();
}

function addChatMessage(message, sender) {
    const messageElement = document.createElement("div");
    messageElement.className = `chat-message ${sender}-message`;
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function answerChatQuestion(question) {
    const normalizedQuestion = question.toLowerCase();
    if (normalizedQuestion.includes("alarm") && (normalizedQuestion.includes("create") || normalizedQuestion.includes("set"))) {
        return { message: "Open Alarms, enter the activity, date, time, and target object, then select Create Alarm.", section: "alarms" };
    }
    if (normalizedQuestion.includes("stop") || normalizedQuestion.includes("camera")) {
        return { message: "When an alarm rings, open the camera and capture the required object. The alarm stops when the object matches.", section: "challenge" };
    }
    if (normalizedQuestion.includes("progress") || normalizedQuestion.includes("statistic") || normalizedQuestion.includes("completed")) {
        return { message: "Dashboard shows your level and streak. Statistics shows your longer-term activity and completion progress.", section: "statistics" };
    }
    if (normalizedQuestion.includes("profile") || normalizedQuestion.includes("account")) {
        return { message: "Open Accounts or select the profile icon to update your personal and study details.", section: "accounts" };
    }
    if (normalizedQuestion.includes("activity") || normalizedQuestion.includes("homework")) {
        return { message: "Use Activities to review your study tasks and keep track of what you need to complete.", section: "activities" };
    }
    if (normalizedQuestion.includes("theme") || normalizedQuestion.includes("dark") || normalizedQuestion.includes("light")) {
        return { message: "Use the moon or sun button in the header, or the theme button at the bottom of the sidebar, to switch themes." };
    }
    return { message: "I can help with alarms, camera challenges, activities, profiles, progress, and themes. Try asking about one of those topics." };
}

function submitChatQuestion(question) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !chatMessages) return;
    addChatMessage(trimmedQuestion, "user");
    const answer = answerChatQuestion(trimmedQuestion);
    addChatMessage(answer.message, "assistant");
    if (answer.section) {
        const action = document.createElement("button");
        action.className = "chat-section-link";
        action.type = "button";
        action.textContent = `Open ${answer.section}`;
        action.addEventListener("click", () => {
            showSection(answer.section);
            closeAllUtilityPanels();
        });
        chatMessages.appendChild(action);
    }
}

function openProfilePanel() {
    toggleUtilityPanel("profilePanel");
    renderProfileFields();
    if (profileButton && profilePanel) {
        profileButton.setAttribute("aria-expanded", String(!profilePanel.classList.contains("hidden")));
    }
}

function setLoggedInState(isLoggedIn) {
    localStorage.setItem("snapLoggedIn", isLoggedIn ? "true" : "false");
    updateFeedbackUI();
}

function updateFeedbackUI() {
    const isLoggedIn = localStorage.getItem("snapLoggedIn") === "true";
    const feedbackSubmitBtn = document.getElementById("feedbackSubmitBtn");
    const feedbackLoginAlert = document.getElementById("feedbackLoginAlert");

    if (feedbackSubmitBtn) {
        feedbackSubmitBtn.disabled = false;
        feedbackSubmitBtn.textContent = "Send Feedback";
    }

    if (feedbackLoginAlert) {
        feedbackLoginAlert.classList.toggle("hidden", isLoggedIn);
        const alertText = feedbackLoginAlert.querySelector("p");
        if (alertText) {
            alertText.textContent = isLoggedIn
                ? "Your feedback will be saved to this account."
                : "You can submit feedback as a guest. Sign in if you want it connected to your account.";
        }
    }
}

function updateFeedbackFormDefaults() {
    const profile = getProfileData();
    const nameField = document.getElementById("feedbackName");
    const emailField = document.getElementById("feedbackEmail");

    if (nameField) nameField.value = profile.fullName || "";
    if (emailField) emailField.value = profile.email || "";
}

function openFeedbackModal() {
    updateFeedbackFormDefaults();
    closeAllUtilityPanels();
    if (feedbackModal) feedbackModal.classList.remove("hidden");
    updateFeedbackUI();

    // Load draft feedback if exists
    const draftFeedback = JSON.parse(localStorage.getItem("feedbackDraft") || "{}");
    if (draftFeedback.name) document.getElementById("feedbackName").value = draftFeedback.name;
    if (draftFeedback.email) document.getElementById("feedbackEmail").value = draftFeedback.email;
    if (draftFeedback.rating) {
        document.getElementById("feedbackRating").value = draftFeedback.rating;
        updateStarDisplay(draftFeedback.rating);
    }
    if (draftFeedback.message) document.getElementById("feedbackMessage").value = draftFeedback.message;
}

function saveFeedbackDraft() {
    const draft = {
        name: document.getElementById("feedbackName").value,
        email: document.getElementById("feedbackEmail").value,
        rating: document.getElementById("feedbackRating").value,
        message: document.getElementById("feedbackMessage").value
    };
    localStorage.setItem("feedbackDraft", JSON.stringify(draft));
}

function updateStarDisplay(value) {
    const ratingText = document.getElementById("ratingText");
    const starButtons = document.querySelectorAll(".star");

    const ratingLabels = {
        1: "Very poor",
        2: "Needs improvement",
        3: "Average",
        4: "Good",
        5: "Excellent"
    };

    if (ratingText) {
        ratingText.textContent = value > 0 ? `Your rating: ${ratingLabels[value]} (${value}/5)` : "Tap a star to rate your experience";
    }
    starButtons.forEach((star) => star.classList.toggle("active", Number(star.dataset.value) <= value));
}

function handleAuthAction(type) {
    const userType = type === "login" ? "Log in" : "Sign up";
    sessionStorage.removeItem("snapGuestSession");
    sessionStorage.removeItem("snapGuestProfile");
    setLoggedInState(true);
    updateFeedbackUI();
    closeAllUtilityPanels();
    alert(`${userType} successful. You can now submit your feedback.`);
}

function signInWithProvider(provider) {
    sessionStorage.removeItem("snapGuestSession");
    sessionStorage.removeItem("snapGuestProfile");
    localStorage.setItem("snapAuthProvider", provider);
    setLoggedInState(true);
    updateAccountAuthUI();
    alert(`Demo ${provider} sign-in successful. You can now create alarms.`);
}

function signOut() {
    setLoggedInState(false);
    localStorage.removeItem("snapAuthProvider");
    sessionStorage.removeItem("snapGuestSession");
    sessionStorage.removeItem("snapGuestProfile");
    updateAccountAuthUI();
    renderAlarms();
    updateDashboard();
}

function updateAccountAuthUI() {
    const isLoggedIn = localStorage.getItem("snapLoggedIn") === "true";
    const isGuest = isGuestSession();
    const provider = localStorage.getItem("snapAuthProvider");
    const providerName = provider === "Google" || provider === "Facebook" ? provider : "your account";
    const guestProfile = isGuest ? getGuestProfileData() : {};
    const guestName = guestProfile.fullName || "Guest";

    if (accountAuthTitle) accountAuthTitle.textContent = isGuest ? `Using Guest mode (${guestName})` : isLoggedIn ? `Signed in with ${providerName}` : "Sign in before creating an alarm";
    if (accountAuthMessage) accountAuthMessage.textContent = isGuest ? "Guest alarms are available now, but they will be cleared when you refresh." : isLoggedIn ? "Your alarm data is ready to be saved to this account." : "Use Google or Facebook to save your alarms to your account.";
    if (googleLoginBtn) googleLoginBtn.classList.toggle("hidden", isLoggedIn || isGuest);
    if (facebookLoginBtn) facebookLoginBtn.classList.toggle("hidden", isLoggedIn || isGuest);
    if (logoutBtn) logoutBtn.classList.toggle("hidden", !isLoggedIn && !isGuest);
    if (alarmLoginAlert) alarmLoginAlert.classList.toggle("hidden", isLoggedIn || isGuest);
    if (profileButton) {
        profileButton.classList.toggle("account-signed-in", isLoggedIn || isGuest);
        profileButton.title = isGuest ? `Account: Guest (${guestName})` : isLoggedIn ? `Account: ${providerName}` : "Open account";
        profileButton.setAttribute("aria-label", isGuest ? `Account: Guest (${guestName})` : isLoggedIn ? `Account: signed in with ${providerName}` : "Open account panel");
    }
    if (panelGoogleBtn) panelGoogleBtn.classList.toggle("hidden", isLoggedIn || isGuest);
    if (panelFacebookBtn) panelFacebookBtn.classList.toggle("hidden", isLoggedIn || isGuest);
    if (panelGuestBtn) panelGuestBtn.classList.toggle("hidden", isLoggedIn || isGuest);
}

function getGuestProfileData() {
    try {
        return JSON.parse(sessionStorage.getItem("snapGuestProfile") || "null") || {};
    } catch {
        return {};
    }
}

function saveGuestProfileData(data) {
    sessionStorage.setItem("snapGuestProfile", JSON.stringify(data));
}

function getDefaultProfile() {
    return {
        fullName: "Jordan Smith",
        email: "jordan@student.com",
        phone: "+63 912 345 6789",
        course: "Computer Science",
        school: "University of the Philippines",
        bio: "Focused student who likes staying productive and organized.",
        role: "student",
        avatar: ""
    };
}

function getProfileData() {
    const stored = JSON.parse(localStorage.getItem("snapProfile") || "null");
    if (isGuestSession()) {
        const guest = getGuestProfileData();
        return {
            ...getDefaultProfile(),
            ...(stored || {}),
            ...guest,
            email: stored?.email || guest.email || getDefaultProfile().email
        };
    }
    return { ...getDefaultProfile(), ...(stored || {}) };
}

function renderProfileFields() {
    const profile = getProfileData();

    const nameInputs = [
        document.getElementById("profileName"),
        document.getElementById("panelProfileName")
    ].filter(Boolean);
    const emailInputs = [
        document.getElementById("profileEmail"),
        document.getElementById("panelProfileEmail")
    ].filter(Boolean);
    const phoneInputs = [
        document.getElementById("profilePhone"),
        document.getElementById("panelProfilePhone")
    ].filter(Boolean);
    const majorInputs = [
        document.getElementById("profileMajor"),
        document.getElementById("panelProfileMajor")
    ].filter(Boolean);
    const schoolInputs = [
        document.getElementById("profileSchool"),
        document.getElementById("panelProfileSchool")
    ].filter(Boolean);
    const bioInputs = [
        document.getElementById("profileBio"),
        document.getElementById("panelProfileBio")
    ].filter(Boolean);

    nameInputs.forEach((input) => input.value = profile.fullName || "");
    emailInputs.forEach((input) => input.value = profile.email || "");
    phoneInputs.forEach((input) => input.value = profile.phone || "");
    majorInputs.forEach((input) => input.value = profile.course || "");
    schoolInputs.forEach((input) => input.value = profile.school || "");
    bioInputs.forEach((input) => input.value = profile.bio || "");

    const avatar = document.getElementById("accountAvatar");
    const profileIcon = profileButton?.querySelector("span");
    const accountDisplayName = document.getElementById("accountDisplayName");
    const accountSummaryEmail = document.getElementById("accountSummaryEmail");
    const developerPhoto = document.getElementById("developerPhoto");

    const initials = (profile.fullName || "Student").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

    if (avatar) {
        avatar.textContent = initials || "ST";
    }

    if (accountDisplayName) accountDisplayName.textContent = profile.fullName || "Student Account";
    if (accountSummaryEmail) accountSummaryEmail.textContent = profile.email || "you@example.com";
    if (developerPhoto && profile.avatar) {
        developerPhoto.src = profile.avatar;
        developerPhoto.alt = `${profile.fullName || "Developer"} profile photo`;
    }
    if (profileRole) profileRole.value = profile.role || "student";
    if (avatar) avatar.style.backgroundImage = profile.avatar ? `url(${profile.avatar})` : "";
    if (avatar) avatar.style.backgroundSize = "cover";
    if (profileIcon) {
        profileIcon.textContent = initials || "ST";
        profileIcon.classList.toggle("has-profile-image", Boolean(profile.avatar));
        profileIcon.style.backgroundImage = profile.avatar ? `url(${profile.avatar})` : "";
    }
}

function saveProfileFromForm(form) {
    if (!form) return;
    if (!form.reportValidity()) return;

    const existingProfile = getProfileData();
    const profile = {
        fullName: form.querySelector("#profileName")?.value || form.querySelector("#panelProfileName")?.value || "",
        email: form.querySelector("#profileEmail")?.value || form.querySelector("#panelProfileEmail")?.value || "",
        phone: form.querySelector("#profilePhone")?.value || form.querySelector("#panelProfilePhone")?.value || "",
        course: form.querySelector("#profileMajor")?.value || form.querySelector("#panelProfileMajor")?.value || "",
        school: form.querySelector("#profileSchool")?.value || form.querySelector("#panelProfileSchool")?.value || "",
        bio: form.querySelector("#profileBio")?.value || form.querySelector("#panelProfileBio")?.value || "",
        role: profileRole?.value || getProfileData().role || "student",
        avatar: existingProfile.avatar
    };

    if (isGuestSession()) {
        saveGuestProfileData(profile);
        recordAccountEvent("Updated guest profile");
        alert("Guest profile saved successfully.");
    } else {
        localStorage.setItem("snapProfile", JSON.stringify(profile));
        localStorage.setItem("snapAuthProvider", "Profile");
        setLoggedInState(true);
        saveData();
        recordAccountEvent("Completed profile setup and logged in");
        alert("Profile saved successfully. You are now logged in.");
    }
    updateAccountAuthUI();
    renderProfileFields();
}

function recordAccountEvent(message) {
    const history = JSON.parse(localStorage.getItem("snapAccountHistory") || "[]");
    history.unshift({ message, createdAt: new Date().toISOString() });
    localStorage.setItem("snapAccountHistory", JSON.stringify(history.slice(0, 8)));
    addNotification(message);
    renderAccountTools();
}

function addNotification(message) {
    const notifications = JSON.parse(localStorage.getItem("snapNotifications") || "[]");
    notifications.unshift({ message, createdAt: new Date().toISOString(), read: false });
    localStorage.setItem("snapNotifications", JSON.stringify(notifications.slice(0, 12)));
    renderAccountTools();
}

function renderNotifications() {
    const notifications = JSON.parse(localStorage.getItem("snapNotifications") || "[]");
    const unreadCount = notifications.filter((item) => !item.read).length;
    if (notificationBadge) {
        notificationBadge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
        notificationBadge.classList.toggle("hidden", unreadCount === 0);
    }
    if (notificationSummary) notificationSummary.textContent = unreadCount ? `${unreadCount} unread` : "All caught up";
    if (headerNotificationList) {
        headerNotificationList.innerHTML = notifications.length ? notifications.map((item) => `
            <button class="header-notification-item ${item.read ? "read" : "unread"}" type="button" data-notification-time="${escapeHTML(item.createdAt || "")}">
                <span class="notification-dot"></span>
                <span><strong>${escapeHTML(item.message)}</strong><small>${new Date(item.createdAt || Date.now()).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></span>
            </button>
        `).join("") : `<p class="notification-empty">You're all caught up.</p>`;
    }
}

function markNotificationsAsRead() {
    const notifications = JSON.parse(localStorage.getItem("snapNotifications") || "[]").map((item) => ({ ...item, read: true }));
    localStorage.setItem("snapNotifications", JSON.stringify(notifications));
    renderAccountTools();
}

function renderAccountTools() {
    const history = JSON.parse(localStorage.getItem("snapAccountHistory") || "[]");
    const notifications = JSON.parse(localStorage.getItem("snapNotifications") || "[]");
    const formatDate = (value) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    if (activityHistory) activityHistory.innerHTML = history.length ? history.map((item) => `<div class="history-item">${escapeHTML(item.message)}<small>${formatDate(item.createdAt)}</small></div>`).join("") : `<p>No account activity yet.</p>`;
    if (notificationList) notificationList.innerHTML = notifications.length ? notifications.map((item) => `<div class="history-item">${escapeHTML(item.message || item)}<small>${item.createdAt ? formatDate(item.createdAt) : "Snap-to-Stop"}</small></div>`).join("") : `<p>You're all caught up.</p>`;
    renderNotifications();
}

function openAuthModal(mode) {
    authMode = mode;
    if (!authModal) return;
    const titles = { signup: "Create your account", login: "Welcome back", forgot: "Recover your account", change: "Change your password" };
    authModalTitle.textContent = titles[mode];
    authNameGroup.classList.toggle("hidden", mode !== "signup");
    authConfirmGroup.classList.toggle("hidden", mode === "forgot");
    authSubmitBtn.textContent = mode === "signup" ? "Create account" : mode === "login" ? "Log in" : mode === "forgot" ? "Send recovery link" : "Update password";
    authSwitchBtn.textContent = mode === "signup" ? "Log in instead" : "Create an account";
    authModal.classList.remove("hidden");
    authForm.reset();
    if (mode === "change") document.getElementById("authEmail").value = getProfileData().email || "";
}

function getLocalAccount() { return JSON.parse(localStorage.getItem("snapAccount") || "null"); }

function submitAuthForm(event) {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    const password = document.getElementById("authPassword").value;
    const confirm = document.getElementById("authConfirm").value;
    const account = getLocalAccount();
    if (authMode === "signup") {
        if (password !== confirm) return alert("Passwords do not match.");
        localStorage.setItem("snapAccount", JSON.stringify({ email, password, fullName: document.getElementById("authName").value.trim() }));
        localStorage.setItem("snapProfile", JSON.stringify({ ...getProfileData(), email, fullName: document.getElementById("authName").value.trim() }));
        sessionStorage.removeItem("snapGuestSession");
        sessionStorage.removeItem("snapGuestProfile");
        setLoggedInState(true); recordAccountEvent("Created an account");
    } else if (authMode === "login") {
        if (!account || account.email !== email || account.password !== password) return alert("Email or password is incorrect.");
        setLoggedInState(true); recordAccountEvent("Logged in");
    } else if (authMode === "forgot") {
        if (!account || account.email !== email) return alert("No local account was found for that email.");
        alert("Recovery link simulated. You can now use Change password."); recordAccountEvent("Requested password recovery");
    } else {
        if (!account || account.email !== email || account.password !== password) return alert("Enter your current account email and password.");
        if (confirm.length < 6) return alert("Your new password must be at least 6 characters.");
        account.password = confirm; localStorage.setItem("snapAccount", JSON.stringify(account));
        recordAccountEvent("Changed password");
    }
    updateAccountAuthUI(); renderProfileFields(); authModal.classList.add("hidden");
}

function resetProfileForm() {
    if (isGuestSession()) {
        saveGuestProfileData({
            fullName: "",
            email: "",
            phone: "",
            course: "",
            school: "",
            bio: "",
            role: "student",
            avatar: ""
        });
        alert("Guest profile reset.");
    } else {
        localStorage.setItem("snapProfile", JSON.stringify(getDefaultProfile()));
        alert("Profile reset to default values.");
    }
    renderProfileFields();
    if (profileForm) profileForm.reset();
    if (profilePanelForm) profilePanelForm.reset();
}

function createSearchIndex() {
    const baseResults = [
        { label: "Dashboard", section: "dashboard", description: "Overview of alarms, activity counts, and progress." },
        { label: "Accounts", section: "accounts", description: "Edit name, email, phone, school, and bio." },
        { label: "Alarms", section: "alarms", description: "Schedule and create new reminders." },
        { label: "Activities", section: "activities", description: "Track homework and tasks." },
        { label: "Snap Challenge", section: "challenge", description: "Practice the camera challenge." },
        { label: "Completed", section: "completed", description: "View finished tasks and challenges." },
        { label: "Statistics", section: "statistics", description: "Track productivity and success rate." },
        { label: "Settings", section: "settings", description: "Theme, sound, volume, and snooze settings." },
        { label: "About", section: "about", description: "Project information and help details." }
    ];

    const dynamicResults = [
        ...alarms.map((alarm) => ({
            label: alarm.name,
            section: "alarms",
            description: `Alarm for ${alarm.date} at ${alarm.time}`
        })),
        ...completed.map((item) => ({
            label: item.name,
            section: "completed",
            description: `Completed challenge on ${item.date}`
        })),
        ...statefulActivities().map((item) => ({
            label: item.name,
            section: "activities",
            description: item.type
        }))
    ];

    return [...baseResults, ...dynamicResults];
}

function statefulActivities() {
    return [...alarms, ...completed].map((item) => ({
        name: item.name || "Activity",
        type: item.target ? "Completed challenge" : "Scheduled task"
    }));
}

function renderSearchResults(query) {
    if (!searchResults) return;

    const trimmed = query.trim().toLowerCase();
    const source = createSearchIndex();

    if (!trimmed) {
        searchResults.innerHTML = source.slice(0, 6).map((item) => `
            <button class="search-result" data-section="${item.section}">
                <strong>${item.label}</strong>
                <small>${item.description}</small>
            </button>
        `).join("");
    } else {
        const filtered = source.filter((item) => {
            return item.label.toLowerCase().includes(trimmed) || item.description.toLowerCase().includes(trimmed);
        });

        searchResults.innerHTML = filtered.slice(0, 10).map((item) => `
            <button class="search-result" data-section="${item.section}">
                <strong>${item.label}</strong>
                <small>${item.description}</small>
            </button>
        `).join("");
    }

    searchResults.querySelectorAll(".search-result").forEach((button) => {
        button.addEventListener("click", () => {
            const section = button.dataset.section;
            showSection(section);
            closeAllUtilityPanels();
        });
    });
}

// Event listeners
themeButton.addEventListener("click", toggleTheme);
if (sidebarThemeButton) sidebarThemeButton.addEventListener("click", toggleTheme);
if (mobileThemeButton) mobileThemeButton.addEventListener("click", toggleTheme);
if (settingsTheme) settingsTheme.addEventListener("click", toggleTheme);
document.querySelectorAll("[data-palette]").forEach((button) => {
    button.addEventListener("click", () => applyColorPalette(button.dataset.palette));
});
applyColorPalette(localStorage.getItem("snapColorPalette"));
if (openSignupBtn) openSignupBtn.addEventListener("click", () => openAuthModal("signup"));
if (openLoginBtn) openLoginBtn.addEventListener("click", () => openAuthModal("login"));
if (openForgotBtn) openForgotBtn.addEventListener("click", () => openAuthModal("forgot"));
if (openChangePasswordBtn) openChangePasswordBtn.addEventListener("click", () => openAuthModal("change"));
if (authForm) authForm.addEventListener("submit", submitAuthForm);
if (authSwitchBtn) authSwitchBtn.addEventListener("click", () => openAuthModal(authMode === "signup" ? "login" : "signup"));
if (profileRole) profileRole.addEventListener("change", () => {
    const profile = getProfileData();
    profile.role = profileRole.value;
    if (isGuestSession()) {
        saveGuestProfileData(profile);
        recordAccountEvent(`Updated role to ${profileRole.options[profileRole.selectedIndex].text}`);
    } else {
        localStorage.setItem("snapProfile", JSON.stringify(profile));
        recordAccountEvent(`Updated role to ${profileRole.options[profileRole.selectedIndex].text}`);
    }
});
if (profilePictureInput) profilePictureInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const profile = getProfileData(); profile.avatar = reader.result;
        if (isGuestSession()) {
            saveGuestProfileData(profile);
        } else {
            localStorage.setItem("snapProfile", JSON.stringify(profile));
        }
        renderProfileFields(); recordAccountEvent("Updated profile picture");
    };
    reader.readAsDataURL(file);
});
if (markNotificationsRead) markNotificationsRead.addEventListener("click", () => { localStorage.setItem("snapNotifications", "[]"); renderAccountTools(); });
if (clearNotificationsButton) clearNotificationsButton.addEventListener("click", () => { localStorage.setItem("snapNotifications", "[]"); renderAccountTools(); });
if (notificationButton) notificationButton.addEventListener("click", () => {
    const isOpen = notificationPanel?.classList.contains("hidden");
    closeAllUtilityPanels();
    notificationPanel?.classList.toggle("hidden", !isOpen);
    notificationButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) markNotificationsAsRead();
});
if (profileButton) profileButton.addEventListener("click", openProfilePanel);
if (accountLoginBtn) accountLoginBtn.addEventListener("click", () => handleAuthAction("login"));
if (accountSignupBtn) accountSignupBtn.addEventListener("click", () => handleAuthAction("signup"));
if (googleLoginBtn) googleLoginBtn.addEventListener("click", openGoogleLogin);
if (facebookLoginBtn) facebookLoginBtn.addEventListener("click", openFacebookLogin);
if (logoutBtn) logoutBtn.addEventListener("click", signOut);
if (searchButton) searchButton.addEventListener("click", () => toggleUtilityPanel("searchPanel"));
if (chatbotButton) chatbotButton.addEventListener("click", openChatbot);
if (helpButton) helpButton.addEventListener("click", openChatbot);
if (sidebarHelpButton) sidebarHelpButton.addEventListener("click", openChatbot);
if (topHelpButton) topHelpButton.addEventListener("click", openChatbot);
if (chatForm) {
    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitChatQuestion(chatInput.value);
        chatInput.value = "";
    });
}
document.querySelectorAll("[data-chat-question]").forEach((button) => {
    button.addEventListener("click", () => submitChatQuestion(button.dataset.chatQuestion));
});
if (feedbackButton) feedbackButton.addEventListener("click", openFeedbackModal);
if (panelFeedbackBtn) panelFeedbackBtn.addEventListener("click", openFeedbackModal);
if (panelCloseButtons) {
    panelCloseButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const panelId = button.dataset.panel;
            if (panelId) {
                const panel = document.getElementById(panelId);
                if (panel) panel.classList.add("hidden");
                if (panelId === "profilePanel" && profileButton) profileButton.setAttribute("aria-expanded", "false");
            }
        });
    });
}
if (siteSearchInput) {
    siteSearchInput.addEventListener("input", (event) => renderSearchResults(event.target.value));
}
if (feedbackForm) {
    const ratingText = document.getElementById("ratingText");
    const starButtons = document.querySelectorAll(".star");
    const ratingInput = document.getElementById("feedbackRating");

    const ratingLabels = {
        1: "Very poor",
        2: "Needs improvement",
        3: "Average",
        4: "Good",
        5: "Excellent"
    };

    function updateStarDisplay(value) {
        ratingText.textContent = value > 0 ? `Your rating: ${ratingLabels[value]} (${value}/5)` : "Tap a star to rate your experience";
        starButtons.forEach((star) => star.classList.toggle("active", Number(star.dataset.value) <= value));
    }

    function saveFeedbackDraft() {
        const draft = {
            name: document.getElementById("feedbackName").value,
            email: document.getElementById("feedbackEmail").value,
            rating: document.getElementById("feedbackRating").value,
            message: document.getElementById("feedbackMessage").value
        };
        localStorage.setItem("feedbackDraft", JSON.stringify(draft));
    }

    starButtons.forEach((button) => {
        button.addEventListener("click", (e) => {
            e.preventDefault();
            const value = Number(button.dataset.value);
            ratingInput.value = value;
            updateStarDisplay(value);
            saveFeedbackDraft();
        });
    });

    // Save draft on input changes
    document.getElementById("feedbackName")?.addEventListener("input", saveFeedbackDraft);
    document.getElementById("feedbackEmail")?.addEventListener("input", saveFeedbackDraft);
    document.getElementById("feedbackMessage")?.addEventListener("input", saveFeedbackDraft);

    feedbackForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!feedbackForm.reportValidity()) {
            return;
        }

        const ratingValue = Number(ratingInput?.value || 0);

        if (ratingValue < 1) {
            showFeedbackToast("Please select a star rating before submitting.");
            return;
        }

        const feedback = {
            name: document.getElementById("feedbackName")?.value.trim() || "",
            email: document.getElementById("feedbackEmail")?.value.trim() || "",
            rating: ratingValue,
            ratingLabel: ratingLabels[ratingValue] || "Excellent",
            message: document.getElementById("feedbackMessage")?.value.trim() || "",
            account: localStorage.getItem("snapLoggedIn") === "true" ? "account" : "guest",
            createdAt: new Date().toISOString()
        };

        const existing = JSON.parse(localStorage.getItem("snapFeedbacks") || "[]");
        existing.push(feedback);
        localStorage.setItem("snapFeedbacks", JSON.stringify(existing));
        addNotification("Feedback submitted successfully.");
        localStorage.removeItem("feedbackDraft");

        feedbackForm.reset();
        if (ratingInput) ratingInput.value = "0";
        if (ratingText) ratingText.textContent = "Tap a star to rate your experience";
        starButtons.forEach((star) => star.classList.remove("active"));
        if (feedbackModal) feedbackModal.classList.add("hidden");
        showFeedbackToast("Thank you! Your feedback has been submitted.");
    });
}
function submitGuestInfo(event) {
    event.preventDefault();
    if (!guestInfoForm) return;

    const name = document.getElementById("guestName").value.trim();
    const email = document.getElementById("guestEmail").value.trim();
    const phone = document.getElementById("guestPhone").value.trim();
    const address = document.getElementById("guestAddress").value.trim();
    const role = document.getElementById("guestRole").value;

    if (!name || !email || !phone || !address || !role) {
        alert("Please fill in all required fields.");
        return;
    }

    if (!email || !email.endsWith("@gmail.com")) {
        alert("Please enter a valid Gmail address (e.g., example@gmail.com).");
        return;
    }

    saveGuestProfileData({
        fullName: name,
        email,
        phone,
        address,
        role,
        course: "",
        school: address,
        bio: "",
        avatar: ""
    });

    sessionStorage.setItem("snapGuestSession", "true");
    alarms = [];
    completed = [];
    saveData();

    if (guestInfoModal) {
        guestInfoModal.classList.add("hidden");
    }
    document.body.classList.remove("intro-active");
    if (guestInfoForm) {
        guestInfoForm.reset();
    }

    updateAccountAuthUI();
    renderAlarms();
    updateDashboard();
    renderProfileFields();
    recordAccountEvent("Joined as guest");
    alert("Welcome! You are now in guest mode.");
}

function prefillGuestForm() {
    const guest = getGuestProfileData();
    if (document.getElementById("guestName")) document.getElementById("guestName").value = guest.fullName || "";
    if (document.getElementById("guestEmail")) document.getElementById("guestEmail").value = guest.email || "";
    if (document.getElementById("guestPhone")) document.getElementById("guestPhone").value = guest.phone || "";
    if (document.getElementById("guestAddress")) document.getElementById("guestAddress").value = guest.address || guest.school || "";
    if (document.getElementById("guestRole")) document.getElementById("guestRole").value = guest.role || "";
}

if (guestBackBtn) {
    guestBackBtn.addEventListener("click", () => {
        if (guestInfoModal) guestInfoModal.classList.add("hidden");
        document.body.classList.remove("intro-active");
        startIntro();
    });
}

if (guestInfoForm) {
    guestInfoForm.addEventListener("submit", submitGuestInfo);
}

if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveProfileFromForm(profileForm);
    });
}
if (profilePanelForm) {
    profilePanelForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveProfileFromForm(profilePanelForm);
    });
}
const resetProfileBtn = document.getElementById("resetProfileBtn");
if (resetProfileBtn) resetProfileBtn.addEventListener("click", resetProfileForm);
const panelLoginBtn = document.getElementById("panelLoginBtn");
const panelSignupBtn = document.getElementById("panelSignupBtn");
if (panelLoginBtn) panelLoginBtn.addEventListener("click", () => handleAuthAction("login"));
if (panelSignupBtn) panelSignupBtn.addEventListener("click", () => handleAuthAction("signup"));
if (panelGoogleBtn) panelGoogleBtn.addEventListener("click", openGoogleLogin);
if (panelFacebookBtn) panelFacebookBtn.addEventListener("click", openFacebookLogin);
if (panelGuestBtn) panelGuestBtn.addEventListener("click", () => chooseIntroAccess("Guest"));
document.addEventListener("click", (event) => {
    const clickedInsideUtility = event.target.closest(".utility-panel") || event.target.closest(".feedback-panel") || event.target.closest(".feedback-box") || event.target.closest(".header-icon-btn") || event.target.closest("#profileButton") || event.target.closest("#themeButton") || event.target.closest("#sidebarThemeButton") || event.target.closest("#topHelpButton") || event.target.closest("#sidebarHelpButton") || event.target.closest("#chatbotButton");
    if (!clickedInsideUtility) {
        closeAllUtilityPanels();
        if (profileButton) profileButton.setAttribute("aria-expanded", "false");
    }
});

if (localStorage.getItem("snapLoggedIn") === "true") {
    setLoggedInState(true);
}
updateAccountAuthUI();
if (!localStorage.getItem("snapNotifications")) localStorage.setItem("snapNotifications", JSON.stringify(["Your account workspace is ready.", "Remember to complete your next Snap Challenge."]));
renderAccountTools();

function updateBackToTop() {
    if (!backToTop) return;
    const isVisible = window.scrollY >= 120;
    backToTop.classList.toggle("hidden", !isVisible);
    backToTop.setAttribute("aria-hidden", String(!isVisible));
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

window.addEventListener("scroll", updateBackToTop, { passive: true });
if (backToTop) backToTop.addEventListener("click", scrollToTop);
updateBackToTop();
if (loadingOverlay) {
    window.addEventListener("load", () => setTimeout(() => loadingOverlay.classList.add("hidden"), 350));
    setTimeout(() => loadingOverlay.classList.add("hidden"), 1800);
}

// Load saved theme on start
const savedTheme = localStorage.getItem("snapTheme");
applyTheme(savedTheme === "dark");

/* ================= CLOCK ================= */
function updateClock() {
    document.getElementById("currentClock").textContent =
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
setInterval(updateClock, 1000);
updateClock();

/* ================= DEFAULT DATE ================= */
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const alarmDateInput = document.getElementById("alarmDate");
const alarmTimeInput = document.getElementById("alarmTime");
let today = formatLocalDate(new Date());
if (alarmDateInput) alarmDateInput.min = today;

document.querySelectorAll("[data-date-offset]").forEach((button) => {
    button.addEventListener("click", () => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + Number(button.dataset.dateOffset));
        if (alarmDateInput) alarmDateInput.value = formatLocalDate(date);
        document.querySelectorAll("[data-date-offset]").forEach((item) => item.classList.toggle("selected", item === button));
    });
});

document.querySelectorAll("[data-time-offset]").forEach((button) => {
    button.addEventListener("click", () => {
        const time = new Date(Date.now() + Number(button.dataset.timeOffset) * 60000);
        if (alarmDateInput) alarmDateInput.value = formatLocalDate(time);
        if (alarmTimeInput) alarmTimeInput.value = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
        document.querySelectorAll("[data-time-offset]").forEach((item) => item.classList.toggle("selected", item === button));
    });
});

/* ================= CREATE ALARM ================= */
alarmForm.addEventListener("submit", e => {
    e.preventDefault();
    if (localStorage.getItem("snapLoggedIn") !== "true" && !isGuestSession()) {
        alert("Please choose Google, Facebook, or Guest access in the introduction first.");
        showSection("accounts");
        return;
    }
    const name = document.getElementById("activityName").value.trim();
    const date = document.getElementById("alarmDate").value;
    const time = document.getElementById("alarmTime").value;
    const priority = document.getElementById("alarmPriority").value;
    const notes = document.getElementById("alarmNotes").value.trim();
    const difficulty = document.getElementById("alarmDifficulty").value || "normal";

    if (new Date(`${date}T${time}`) <= new Date()) {
        alert("Please select a future date and time.");
        return;
    }

    alarms.push({
        id: Date.now(),
        name, date, time, priority, notes,
        difficulty,
        triggered: false,
        completed: false
    });

    saveData();
    addNotification(`Alarm scheduled: ${name}`);
    renderAlarms();
    updateDashboard();
    alarmForm.reset();
    if (alarmDateInput) alarmDateInput.min = today;
    showSection("alarms");
    alert("Alarm created successfully!");
});

/* ================= SAVE / RENDER ================= */
function saveData() {
    const storage = isGuestSession() ? sessionStorage : localStorage;
    storage.setItem("snapAlarms", JSON.stringify(alarms));
    storage.setItem("snapCompleted", JSON.stringify(completed));
}

function renderAlarms() {
    if (!alarmList) return;
    if (alarms.length === 0) {
        alarmList.innerHTML = `<div class="empty-state"><h3>No alarms yet</h3><p>Create your first activity alarm.</p></div>`;
        return;
    }

    const sorted = [...alarms].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    alarmList.innerHTML = "";

    sorted.forEach(alarm => {
        const item = document.createElement("div");
        item.className = "alarm-item";
        const name = getActivityName(alarm);
        const date = alarm.date || "Date not set";
        const time = alarm.time || "Time not set";
        const priority = ["low", "medium", "high"].includes(String(alarm.priority).toLowerCase())
            ? String(alarm.priority).toLowerCase()
            : "medium";
        item.innerHTML = `
      <div class="alarm-info">
                <h3>${escapeHTML(name)}</h3>
                <p>${escapeHTML(date)} &nbsp; ${escapeHTML(time)}</p>
            ${alarm.notes ? `<p>${escapeHTML(alarm.notes)}</p>` : ""}
                <span class="priority ${priority}">${priority.toUpperCase()}</span>
      </div>
      <div class="alarm-actions">
        <button class="secondary-btn" onclick="testAlarm(${alarm.id})">Test</button>
        <button class="delete-btn" onclick="deleteAlarm(${alarm.id})">Delete</button>
      </div>`;
        alarmList.appendChild(item);
    });
}

window.deleteAlarm = function (id) {
    alarms = alarms.filter(a => a.id !== id);
    saveData();
    renderAlarms();
    updateDashboard();
};

window.testAlarm = function (id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm) triggerAlarm(alarm);
};

/* ================= CHECK ALARMS ================= */
function checkAlarms() {
    const now = new Date();
    alarms.forEach(alarm => {
        if (alarm.triggered || alarm.completed) return;
        if (now >= new Date(`${alarm.date}T${alarm.time}`)) {
            alarm.triggered = true;
            saveData();
            triggerAlarm(alarm);
        }
    });
}
setInterval(checkAlarms, 1000);

/* ================= RANDOM OBJECT ================= */
function randomObject() {
    return objects[Math.floor(Math.random() * objects.length)];
}

function normalizeObjectName(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function matchesRequiredTarget(requiredTarget, detectedLabel) {
    if (!requiredTarget || !detectedLabel) return false;

    const labels = [requiredTarget.name, ...(requiredTarget.classes || [])];
    const detected = normalizeObjectName(detectedLabel);

    if (!detected) return false;

    return labels.some(label => {
        const normalizedLabel = normalizeObjectName(label);
        return !normalizedLabel
            ? false
            : detected === normalizedLabel ||
            detected.includes(normalizedLabel) ||
            normalizedLabel.includes(detected);
    });
}

/* ================= TRIGGER ALARM ================= */
function setChallengeDifficulty(level) {
    const difficulty = challengeLevels[level] || challengeLevels.normal;
    challengeSecondsLeft = difficulty.seconds;
    if (challengeTimerMessage) {
        challengeTimerMessage.textContent = `You have ${difficulty.seconds} seconds to stop the alarm.`;
    }
    if (practiceTimer) {
        practiceTimer.textContent = `${difficulty.seconds}s`;
    }
    if (alarmTimer) {
        alarmTimer.textContent = `${difficulty.seconds}s`;
    }
    if (alarmTimerPreview) {
        alarmTimerPreview.value = `${difficulty.seconds} seconds`;
    }
    return difficulty;
}

function startChallengeCountdown(targetTimerElement = practiceTimer) {
    clearInterval(challengeCountdown);
    const selectedLevel = challengeDifficulty ? challengeDifficulty.value : "normal";
    const config = challengeLevels[selectedLevel] || challengeLevels.normal;
    challengeSecondsLeft = config.seconds;
    if (targetTimerElement) targetTimerElement.textContent = `${challengeSecondsLeft}s`;
    challengeCountdown = setInterval(() => {
        challengeSecondsLeft = Math.max(0, challengeSecondsLeft - 1);
        if (targetTimerElement) targetTimerElement.textContent = `${challengeSecondsLeft}s`;
        if (challengeSecondsLeft <= 0) {
            clearInterval(challengeCountdown);
            if (challengeTimerMessage) {
                challengeTimerMessage.textContent = "Time is up. Try a new challenge.";
            }
        }
    }, 1000);
}

function triggerAlarm(alarm) {
    currentAlarm = alarm;
    const selectedDifficulty = alarm.difficulty || (challengeDifficulty ? challengeDifficulty.value : "normal");
    const config = challengeLevels[selectedDifficulty] || challengeLevels.normal;
    challengeSecondsLeft = config.seconds;
    ringingActivity.textContent = alarm.name;

    const obj = randomObject();
    currentAlarm.target = obj;
    currentAlarm.challengeDifficulty = selectedDifficulty;

    targetObjectEl.textContent = obj.emoji;
    targetName.textContent = obj.name;
    if (alarmTimer) alarmTimer.textContent = `${config.seconds}s`;
    verificationMessage.textContent = `You have ${config.seconds} seconds to stop the alarm.`;
    captureButton.disabled = true;

    alarmOverlay.classList.add("show");
    playAlarmSound();
}

/* ================= SOUND ================= */
function playAlarmSound() {
    stopAlarmSound();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    alarmAudio = { context: ctx, stopped: false };
    const sound = alarmSounds[selectedAlarmSound] || alarmSounds.extreme;
    let toneIndex = 0;

    function beep() {
        if (!alarmAudio || alarmAudio.stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = sound.tones[toneIndex % sound.tones.length];
        gain.gain.value = Math.min(volume, sound.maxVolume || volume);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => osc.stop(), sound.noteDuration);
        toneIndex += 1;
        setTimeout(beep, sound.pause);
    }
    beep();
}

function stopAlarmSound() {
    if (alarmAudio) {
        alarmAudio.stopped = true;
        try { alarmAudio.context.close(); } catch (e) { }
        alarmAudio = null;
    }
}

/* ================= CAMERA ================= */
startCameraBtn.addEventListener("click", async () => {
    try {
        // Stop previous stream if any
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        camera.srcObject = cameraStream;
        await camera.play();

        camera.style.display = "block";
        cameraPlaceholder.style.display = "none";
        captureButton.disabled = false;
        verificationMessage.textContent = `Camera ready. Point at the ${currentAlarm?.target?.name || "object"} and press Capture.`;
    } catch (err) {
        console.error(err);
        verificationMessage.textContent = "Camera permission denied or unavailable.";
        alert("Please allow camera access in your browser settings.");
    }
});

/* ================= CAPTURE + AI (FIXED) ================= */
captureButton.addEventListener("click", async () => {
    if (isDetecting || !cameraStream || !currentAlarm?.target) return;

    isDetecting = true;
    captureButton.disabled = true;
    verificationMessage.textContent = "Analyzing image... Please wait";

    try {
        // Make sure video has real dimensions
        if (camera.videoWidth === 0 || camera.videoHeight === 0) {
            verificationMessage.textContent = "Camera not ready yet. Wait 1 second and try again.";
            isDetecting = false;
            captureButton.disabled = false;
            return;
        }

        // Load model if needed
        if (!cocoModel) {
            verificationMessage.textContent = "Loading AI model (first time only)...";
            cocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        }

        // Draw current frame
        canvas.width = camera.videoWidth;
        canvas.height = camera.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

        // Detect
        const predictions = await cocoModel.detect(canvas, 20, 0.4); // lower threshold for better chance
        console.log("Predictions:", predictions);

        const required = currentAlarm.target;

        // Find any object whose label matches the required target, even with minor naming differences.
        const correct = predictions.find(p => {
            const detected = p.class;
            return p.score >= 0.40 && matchesRequiredTarget(required, detected);
        });

        if (correct) {
            const confidence = Math.round(correct.score * 100);
            verificationMessage.textContent = `Correct! ${required.name} detected (${confidence}%)`;

            // Stop alarm after short delay
            setTimeout(() => {
                completeAlarm(confidence, correct.class);
                isDetecting = false;
            }, 800);
        } else {
            // Show what was detected
            if (predictions.length > 0) {
                const list = predictions
                    .slice(0, 4)
                    .map(p => `${p.class} (${Math.round(p.score * 100)}%)`)
                    .join(", ");
                verificationMessage.textContent = `Need: ${required.name}
Detected: ${list}
Try again!`;
            } else {
                verificationMessage.textContent = `No objects detected. Make sure the ${required.name} is clearly visible and try again.`;
            }
            isDetecting = false;
            captureButton.disabled = false;
        }
    } catch (err) {
        console.error("Detection error:", err);
        verificationMessage.textContent = "Detection failed. Try again or refresh the page.";
        isDetecting = false;
        captureButton.disabled = false;
    }
});

/* ================= COMPLETE ALARM ================= */
function completeAlarm(confidence = 0, detectedLabel = "") {
    if (!currentAlarm || !currentAlarm.target) return;

    if (detectedLabel && !matchesRequiredTarget(currentAlarm.target, detectedLabel)) {
        verificationMessage.textContent = `Wrong object captured. You need ${currentAlarm.target.name}.`;
        captureButton.disabled = false;
        isDetecting = false;
        return;
    }

    stopAlarmSound();
    stopCamera();

    completed.push({
        id: Date.now(),
        name: currentAlarm.name,
        date: currentAlarm.date,
        time: currentAlarm.time,
        target: currentAlarm.target.name,
        completedAt: new Date().toLocaleString(),
        confidence
    });

    xp += currentAlarm.challengeDifficulty ? challengeLevels[currentAlarm.challengeDifficulty]?.xp || 120 : 120;
    localStorage.setItem("snapXP", String(xp));

    alarms = alarms.filter(a => a.id !== currentAlarm.id);
    saveData();
    addNotification(`Activity completed: ${currentAlarm.name}`);

    alarmOverlay.classList.remove("show");
    successOverlay.classList.add("show");

    document.getElementById("successMessage").textContent =
        `Great job! You captured the correct ${currentAlarm.target.name}` +
        (confidence ? ` (${confidence}% confidence)` : "") +
        `. The alarm has stopped.`;

    currentAlarm = null;

    renderAlarms();
    renderCompleted();
    renderActivities();
    updateDashboard();
    updateStatistics();
    renderAchievements();
    renderCalendar();
    updateXpDisplay();
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    camera.srcObject = null;
    camera.style.display = "none";
    cameraPlaceholder.style.display = "flex";
    captureButton.disabled = true;
}

/* ================= SUCCESS / SNOOZE ================= */
closeSuccess.addEventListener("click", () => {
    successOverlay.classList.remove("show");
});

snoozeButton.addEventListener("click", () => {
    if (!currentAlarm) return;
    const minutes = Number(document.getElementById("snoozeDuration").value) || 5;

    stopAlarmSound();
    stopCamera();
    alarmOverlay.classList.remove("show");

    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);
    currentAlarm.date = snoozeTime.toISOString().split("T")[0];
    currentAlarm.time = snoozeTime.toTimeString().slice(0, 5);
    currentAlarm.triggered = false;
    currentAlarm = null;

    saveData();
    renderAlarms();
    updateDashboard();
    alert(`Alarm snoozed for ${minutes} minute(s).`);
});

/* ================= RENDER FUNCTIONS ================= */
function renderCompleted() {
    const list = document.getElementById("completedList");
    if (!list) return;
    if (completed.length === 0) {
        list.innerHTML = `<div class="empty-state"><h3>No completed activities yet</h3><p>Complete a Snap Challenge to see it here.</p></div>`;
        return;
    }
    list.innerHTML = "";
    [...completed].reverse().forEach(item => {
        const div = document.createElement("div");
        div.className = "alarm-item";
        div.innerHTML = `
      <div class="alarm-info">
        <h3>${escapeHTML(item.name)}</h3>
        <p>${item.date} &nbsp; ${item.time}</p>
        <p>Object: ${escapeHTML(item.target)}</p>
        <p>Completed: ${escapeHTML(item.completedAt)}</p>
      </div>`;
        list.appendChild(div);
    });
}

function getActivityName(activity) {
    const name = String(activity?.name || "").trim();
    return name || "Untitled activity";
}

function renderActivities() {
    const list = document.getElementById("activityList");
    if (!list) return;
    if (alarms.length === 0 && completed.length === 0) {
        list.innerHTML = `<div class="card"><div class="empty-state"><h3>No activities</h3><p>Create an alarm to add an activity.</p></div></div>`;
        return;
    }
    list.innerHTML = "";
    alarms.forEach(a => {
        const card = document.createElement("div");
        card.className = "activity-card";
        card.dataset.status = "upcoming";
        card.innerHTML = `<h3>${escapeHTML(getActivityName(a))}</h3><p>${a.date}</p><p>${a.time}</p><p>Priority: ${a.priority}</p>`;
        list.appendChild(card);
    });
    completed.forEach(item => {
        const card = document.createElement("div");
        card.className = "activity-card";
        card.dataset.status = "completed";
        card.innerHTML = `<h3>${escapeHTML(getActivityName(item))}</h3><p>Completed successfully</p><p>${escapeHTML(item.target)}</p>`;
        list.appendChild(card);
    });
    filterActivities();
}

function renderAchievements() {
    const list = document.getElementById("achievementList");
    if (!list) return;

    const achievements = [
        { title: "First Snap", desc: "Complete your first challenge.", unlocked: completed.length >= 1 },
        { title: "Momentum Builder", desc: "Finish 3 challenges.", unlocked: completed.length >= 3 },
        { title: "Focus Locked", desc: "Reach 500 XP.", unlocked: xp >= 500 },
        { title: "Top Performer", desc: "Reach 1000 XP.", unlocked: xp >= 1000 }
    ];

    list.innerHTML = achievements.map((item) => `
        <div class="achievement-item ${item.unlocked ? "unlocked" : ""}">
            <h3>${item.title}</h3>
            <p>${item.desc}</p>
            <span class="achievement-badge">${item.unlocked ? "Unlocked" : "Locked"}</span>
        </div>
    `).join("");
}

function updateXpDisplay() {
    if (!xpCurrent || !xpCaption || !levelBadge || !levelTitle || !xpProgressFill) return;

    const level = Math.max(1, Math.floor(xp / 100) + 1);
    const currentValue = xp % 1000;
    const percent = Math.min(100, (currentValue / 1000) * 100);
    const title = levelTitles[Math.min(levelTitles.length - 1, level - 1)];

    xpCurrent.textContent = String(xp);
    xpCaption.textContent = `XP: ${currentValue} / 1000`;
    levelBadge.textContent = `Level ${level}`;
    levelTitle.textContent = `Level ${level} - ${title}`;
    xpProgressFill.style.width = `${percent}%`;
}

function renderCalendar() {
    if (!calendarView || !calendarMonthLabel) return;

    const monthDate = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1);
    const monthLabel = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });
    calendarMonthLabel.textContent = monthLabel;

    const firstDayIndex = monthDate.getDay();
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const grid = [];

    for (let i = 0; i < firstDayIndex; i++) {
        grid.push('<div class="calendar-day empty"></div>');
    }

    const dateKeys = new Set([
        ...alarms.map((alarm) => alarm.date),
        ...completed.map((item) => item.date)
    ]);

    for (let day = 1; day <= daysInMonth; day++) {
        const fullDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const ymd = formatLocalDate(fullDate);
        const hasEvent = dateKeys.has(ymd);
        const isToday = ymd === today;

        grid.push(`
            <button type="button" class="calendar-day ${hasEvent ? "has-event" : ""} ${isToday ? "today" : ""} ${ymd >= today ? "future" : "past"}" data-calendar-date="${ymd}" title="Use ${ymd} for a new alarm">
                <span class="date-number">${day}</span>
                ${hasEvent ? '<span class="dot"></span>' : ""}
            </button>
        `);
    }

    calendarView.innerHTML = grid.join("");
    calendarView.querySelectorAll("[data-calendar-date]").forEach((dayButton) => {
        dayButton.addEventListener("click", () => {
            if (alarmDateInput && dayButton.dataset.calendarDate >= today) {
                alarmDateInput.value = dayButton.dataset.calendarDate;
                showSection("alarms");
                alarmDateInput.focus();
            }
        });
    });
}

prevMonthBtn?.addEventListener("click", () => {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1);
    renderCalendar();
});

nextMonthBtn?.addEventListener("click", () => {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1);
    renderCalendar();
});

function filterActivities() {
    const query = document.getElementById("activitySearch")?.value.toLowerCase() || "";
    const status = document.getElementById("activityStatusFilter")?.value || "all";

    document.querySelectorAll(".activity-card").forEach((card) => {
        const matchesQuery = card.textContent.toLowerCase().includes(query);
        const matchesStatus = status === "all" || card.dataset.status === status;
        card.style.display = matchesQuery && matchesStatus ? "" : "none";
    });
}

document.getElementById("activitySearch")?.addEventListener("input", filterActivities);
document.getElementById("activityStatusFilter")?.addEventListener("change", filterActivities);

/* ================= DASHBOARD & STATS ================= */
function updateDashboard() {
    document.getElementById("dashboardAlarms").textContent = alarms.length;
    document.getElementById("dashboardActivities").textContent = alarms.length + completed.length;
    document.getElementById("dashboardCompleted").textContent = completed.length;
    document.getElementById("dashboardStreak").textContent = calculateStreak();

    const upcoming = document.getElementById("dashboardUpcoming");
    if (!upcoming) return;

    const scheduledAlarms = alarms
        .filter((alarm) => alarm && alarm.date && alarm.time)
        .sort((a, b) => {
            const firstTime = new Date(`${a.date}T${a.time}`).getTime();
            const secondTime = new Date(`${b.date}T${b.time}`).getTime();
            return (Number.isNaN(firstTime) ? Infinity : firstTime) - (Number.isNaN(secondTime) ? Infinity : secondTime);
        });

    if (scheduledAlarms.length === 0) {
        upcoming.innerHTML = `<div class="empty-state"><h3>No upcoming activities</h3><p>Create an alarm to get started.</p></div>`;
        return;
    }
    const next = scheduledAlarms.slice(0, 3);
    upcoming.innerHTML = "";
    next.forEach(a => {
        const item = document.createElement("div");
        item.className = "alarm-item";
        const priority = String(a.priority || "medium").toLowerCase();
        item.innerHTML = `
      <div class="alarm-info">
                <h3>${escapeHTML(getActivityName(a))}</h3>
        <p>${a.date} &nbsp; ${a.time}</p>
      </div>
            <span class="priority ${escapeHTML(priority)}">${escapeHTML(priority.toUpperCase())}</span>`;
        upcoming.appendChild(item);
    });
}

function updateStatistics() {
    const total = alarms.length + completed.length;
    const done = completed.length;
    const success = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById("statTotalAlarms").textContent = total;
    document.getElementById("statCompleted").textContent = done;
    document.getElementById("statSuccess").textContent = `${success}%`;
    document.getElementById("statStreak").textContent = calculateStreak();
    document.getElementById("progressBar").style.width = `${success}%`;
    document.getElementById("progressText").textContent = `${success}% completed`;
    updateXpDisplay();
}

function calculateStreak() {
    if (completed.length === 0) return 0;
    const dates = [...new Set(completed.map(i => i.date))].sort().reverse();
    let streak = 0;
    let current = new Date();
    for (let d of dates) {
        const diff = Math.floor((new Date(current).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
        if (diff === streak) streak++;
        else break;
    }
    return streak;
}

/* ================= SOUND TEST & VOLUME ================= */
testSound?.addEventListener("click", () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const sound = alarmSounds[selectedAlarmSound] || alarmSounds.extreme;
    sound.tones.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = frequency;
        gain.gain.value = Math.min(volume, sound.maxVolume || volume);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(index * sound.pause);
        oscillator.stop(index * sound.pause + sound.noteDuration);
    });
    setTimeout(() => ctx.close(), sound.tones.length * sound.pause + sound.noteDuration);
});

if (alarmSoundSelect) {
    alarmSoundSelect.value = alarmSounds[selectedAlarmSound] ? selectedAlarmSound : "extreme";
    selectedAlarmSound = alarmSoundSelect.value;
    localStorage.setItem("alarmSound", selectedAlarmSound);
    alarmSoundSelect.addEventListener("change", () => {
        selectedAlarmSound = alarmSoundSelect.value;
        localStorage.setItem("alarmSound", selectedAlarmSound);
    });
}

if (volumeControl) {
    volumeControl.value = volume * 100;
    volumeControl.addEventListener("input", function () {
        volume = Number(this.value) / 100;
        localStorage.setItem("alarmVolume", volume);
    });
}

/* ================= PRACTICE MODE ================= */
const practiceCamera = document.getElementById("practiceCamera");
const practicePlaceholder = document.getElementById("practicePlaceholder");
const practiceStartCamera = document.getElementById("practiceStartCamera");
const practiceCapture = document.getElementById("practiceCapture");
const practiceTarget = document.getElementById("practiceTarget");
const practiceTargetName = document.getElementById("practiceTargetName");
const practiceMessage = document.getElementById("practiceMessage");
const newChallengeBtn = document.getElementById("newChallenge");

let practiceObject = null;

function setPracticeObject() {
    practiceObject = randomObject();
    if (practiceTarget) practiceTarget.textContent = practiceObject.emoji;
    if (practiceTargetName) practiceTargetName.textContent = practiceObject.name;
    if (practiceMessage) practiceMessage.textContent = "Open the camera to begin.";
}
setPracticeObject();
setChallengeDifficulty(challengeDifficulty ? challengeDifficulty.value : "normal");
newChallengeBtn?.addEventListener("click", () => {
    setPracticeObject();
    startChallengeCountdown(practiceTimer);
});

challengeDifficulty?.addEventListener("change", () => {
    setChallengeDifficulty(challengeDifficulty.value);
    startChallengeCountdown(practiceTimer);
});

alarmDifficulty?.addEventListener("change", () => {
    setChallengeDifficulty(alarmDifficulty.value);
});
setChallengeDifficulty(alarmDifficulty ? alarmDifficulty.value : "normal");

practiceStartCamera?.addEventListener("click", async () => {
    try {
        if (practiceStream) practiceStream.getTracks().forEach(t => t.stop());
        practiceStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        practiceCamera.srcObject = practiceStream;
        await practiceCamera.play();
        practiceCamera.style.display = "block";
        practicePlaceholder.style.display = "none";
        practiceCapture.disabled = false;
        practiceMessage.textContent = "Camera ready. Capture the target object.";
    } catch {
        practiceMessage.textContent = "Unable to access the camera.";
    }
});

practiceCapture?.addEventListener("click", () => {
    practiceMessage.textContent = `${practiceObject.name} detected! (Practice mode)`;
    practiceCapture.disabled = true;
    if (practiceStream) {
        practiceStream.getTracks().forEach(t => t.stop());
        practiceStream = null;
    }
    practiceCamera.style.display = "none";
    practicePlaceholder.style.display = "flex";
});

/* ================= UTILS ================= */
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ================= INIT ================= */
// Initialize feedback UI state
updateFeedbackUI();

renderAlarms();
renderCompleted();
renderActivities();
renderAchievements();
renderCalendar();
updateDashboard();
updateStatistics();
updateXpDisplay();

setInterval(() => {
    const currentToday = formatLocalDate(new Date());
    if (currentToday !== today) {
        today = currentToday;
        if (alarmDateInput) alarmDateInput.min = today;
    }
    updateDashboard();
    updateStatistics();
    renderCalendar();
}, 2000);

// Preload model
(async () => {
    try {
        cocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        console.log("COCO-SSD model loaded and ready");
    } catch (e) {
        console.warn("Model preload failed:", e);
    }
})();

