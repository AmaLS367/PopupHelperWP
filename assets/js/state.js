// Handle persistence and rate limits using localStorage and sessionStorage.

const PopupState = (function () {
    const STORAGE_PREFIX = "RH_POPUP";
    const SESSION_FLAG_KEY = `${STORAGE_PREFIX}_SHOWN_SESSION`;

    /**
     * Build a per-path key for localStorage.
     */
    function key(name) {
        const path = normalizedPathname();
        return `${STORAGE_PREFIX}_${name}_${path}`;
    }

    /**
     * Read a timestamp (ms since epoch) from localStorage.
     */
    function readMs(keyName) {
        const raw = localStorage.getItem(keyName);
        if (!raw) {
            return 0;
        }
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * Write current timestamp to localStorage.
     */
    function writeNow(keyName) {
        localStorage.setItem(keyName, String(Date.now()));
    }

    /**
     * Check if popup was shown in this browser session.
     */
    function wasShownThisSession() {
        return sessionStorage.getItem(SESSION_FLAG_KEY) === "1";
    }

    /**
     * Mark that popup has been shown in this browser session.
     */
    function markShownThisSession() {
        sessionStorage.setItem(SESSION_FLAG_KEY, "1");
    }

    /**
     * Mark that popup was closed by user action.
     */
    function markClosed() {
        writeNow(key("LAST_CLOSED_MS"));
    }

    /**
     * Mark that CTA button was clicked.
     */
    function markClicked() {
        writeNow(key("LAST_CLICK_MS"));
    }

    /**
     * Return true if enough time has passed since last close.
     */
    function closeCooldownPassed(requiredDays) {
        const since = readMs(key("LAST_CLOSED_MS"));
        if (!requiredDays || requiredDays <= 0) {
            return true;
        }
        return Date.now() - since >= daysToMs(requiredDays);
    }

    /**
     * Return true if enough time has passed since last CTA click.
     */
    function clickCooldownPassed(requiredDays) {
        const since = readMs(key("LAST_CLICK_MS"));
        if (!requiredDays || requiredDays <= 0) {
            return true;
        }
        return Date.now() - since >= daysToMs(requiredDays);
    }

    /**
     * Check if popup is allowed to show based on global limits and session rule.
     */
    function canShow(limits) {
        if (!limits) {
            return true;
        }
        if (limits.perSession && wasShownThisSession()) {
            return false;
        }
        if (!closeCooldownPassed(limits.afterCloseDays)) {
            return false;
        }
        if (!clickCooldownPassed(limits.afterClickDays)) {
            return false;
        }
        return true;
    }

    return {
        canShow,
        wasShownThisSession,
        markShownThisSession,
        markClosed,
        markClicked
    };
})();
