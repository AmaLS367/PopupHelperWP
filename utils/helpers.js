// utils/helpers.js
// Small helpers used across modules.

function isMobileEnv() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const narrow = window.matchMedia("(max-width: 640px)").matches;
    const ua = navigator.userAgent.toLowerCase();
    const uaMobile = /iphone|ipad|ipod|android|mobile|iemobile|blackberry|opera mini/.test(ua);
    return isTouch || narrow || uaMobile;
}

function daysToMs(days) {
    if (!Number.isFinite(days) || days <= 0) {
        return 0;
    }
    return days * 24 * 60 * 60 * 1000;
}

function maybeUppercase(label, enableUppercase) {
    if (!enableUppercase) {
        return label;
    }
    return String(label).toUpperCase();
}

function normalizedPathname() {
    try {
        let p = window.location.pathname || "/";
        if (!p.endsWith("/")) {
            p = p + "/";
        }
        return p;
    } catch (_) {
        return "/";
    }
}

function openLink(url, newTab) {
    if (!url) {
        return;
    }
    if (newTab) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
    }
    window.location.href = url;
}
