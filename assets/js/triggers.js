// All trigger sources live here. Each trigger calls onOpen() exactly once.
// After firing, a trigger cleans itself up.

const PopupTriggers = (function () {
    let armed = true;

    function once(fn) {
        let done = false;
        return function () {
            if (done) {
                return;
            }
            done = true;
            fn();
        };
    }

    /**
     * Exit intent trigger for desktop.
     */
    function attachExitIntent(onOpen) {
        // Fire callback only once
        const openOnce = once(onOpen);

        // Debug controls:
        // window.RH_DEBUG = true to enable logs
        // window.RH_DEBUG_LEVEL = 1 minimal, 2 verbose (default 1)
        const DEBUG = !!(window && window.RH_DEBUG);
        const LEVEL = typeof window.RH_DEBUG_LEVEL === "number" ? window.RH_DEBUG_LEVEL : 1;

        // Threshold in pixels from the top rim treated as "exit zone"
        const TOP_THRESHOLD = 7;

        // Throttle for mousemove logs (ms)
        const LOG_THROTTLE_MS = 120;

        let lastY = 9999;
        let lastMoveTs = 0;
        let lastLogTs = 0;

        function d(level, ...args) {
            if (!DEBUG) {
                return;
            }
            if (level <= LEVEL) {
                // eslint-disable-next-line no-console
                console.debug("[exit-intent]", ...args);
            }
        }

        function fire(reason) {
            if (!armed) {
                d(1, "blocked: not armed");
                return;
            }
            detach();
            d(1, "FIRE", { reason });
            openOnce();
        }

        // Track last mouse position and time for blur fallback and diagnostics
        function onMouseMove(e) {
            lastY = typeof e.clientY === "number" ? e.clientY : 9999;
            lastMoveTs = Date.now();
            if (DEBUG) {
                const now = lastMoveTs;
                if (now - lastLogTs >= LOG_THROTTLE_MS || lastY <= TOP_THRESHOLD + 2) {
                    lastLogTs = now;
                    d(2, "mousemove", { y: lastY });
                }
            }
        }

        // Primary: user leaves the document window
        function onDocMouseLeave(e) {
            const rel = e.relatedTarget || e.toElement || null;
            const y = typeof e.clientY === "number" ? e.clientY : 9999;
            d(1, "mouseleave", { relatedTarget: !!rel, y });
            if (!rel && y <= TOP_THRESHOLD) {
                fire("mouseleave@top");
            }
        }

        // Secondary: mouseout on documentElement without a related target and near the top
        function onDocMouseOut(e) {
            const target = e.target || e.srcElement;
            if (target !== document.documentElement && target !== document.body) {
                return;
            }
            const rel = e.relatedTarget || e.toElement || null;
            const y = typeof e.clientY === "number" ? e.clientY : 9999;
            d(2, "mouseout(doc)", { relatedTarget: !!rel, y });
            if (!rel && y <= TOP_THRESHOLD) {
                fire("mouseout@top");
            }
        }

        // Fallback: blur right after the cursor touched the top rim
        function onWindowBlur() {
            const dt = Date.now() - lastMoveTs;
            d(1, "blur", { lastY, dt });
            if (lastY <= TOP_THRESHOLD && dt <= 300) {
                fire("blur-after-top");
            }
        }

        // Visibility changes are noisy; only log for diagnostics
        function onVisibilityChange() {
            d(2, "visibility", { state: document.visibilityState, lastY });
        }

        function detach() {
            document.removeEventListener("mouseleave", onDocMouseLeave, true);
            document.removeEventListener("mouseout", onDocMouseOut, true);
            window.removeEventListener("blur", onWindowBlur, true);
            window.removeEventListener("mousemove", onMouseMove, true);
            document.removeEventListener("visibilitychange", onVisibilityChange, true);
            d(1, "detached");
        }

        // Attach listeners in capture phase to intercept early
        document.addEventListener("mouseleave", onDocMouseLeave, true);
        document.addEventListener("mouseout", onDocMouseOut, true);
        window.addEventListener("blur", onWindowBlur, true);
        window.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("visibilitychange", onVisibilityChange, true);

        d(1, "armed", { TOP_THRESHOLD });

        return { detach };
    }

    /**
     * Idle trigger for both desktop and mobile.
     * Opens after N seconds of no mousemove, no scroll and no click/touch.
     */
    function attachIdle(onOpen, seconds) {
        const openOnce = once(onOpen);
        let timeoutId = 0;

        function resetTimer() {
            if (!armed) {
                return;
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = window.setTimeout(() => {
                detach();
                openOnce();
            }, seconds * 1000);
        }

        function detach() {
            const opts = { passive: true, capture: true };
            ["mousemove", "scroll", "keydown", "mousedown", "touchstart"].forEach((evt) => {
                window.removeEventListener(evt, resetTimer, opts);
            });
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }

        const opts = { passive: true, capture: true };
        ["mousemove", "scroll", "keydown", "mousedown", "touchstart"].forEach((evt) => {
            window.addEventListener(evt, resetTimer, opts);
        });
        resetTimer();

        return { detach };
    }

    /**
     * Scroll percent trigger for both desktop and mobile.
     * Opens when user scrolls beyond threshold percent.
     */
    function attachScroll(onOpen, percent) {
        const openOnce = once(onOpen);

        function onScroll() {
            if (!armed) {
                return;
            }
            const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
            const docHeight = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight,
                document.body.clientHeight,
                document.documentElement.clientHeight
            );
            const winHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const maxScrollable = Math.max(docHeight - winHeight, 1);
            const currentPercent = (scrollTop / maxScrollable) * 100;

            if (currentPercent >= percent) {
                detach();
                openOnce();
            }
        }

        function detach() {
            window.removeEventListener("scroll", onScroll, { capture: true });
        }

        window.addEventListener("scroll", onScroll, { passive: true, capture: true });
        onScroll();

        return { detach };
    }

    /**
     * Mobile back button trigger.
     * Pushes a state and listens for popstate. When back is pressed, opens popup.
     */
    function attachBackButton(onOpen) {
        const openOnce = once(onOpen);
        let armedHere = true;

        try {
            history.pushState({ rh: "guard" }, document.title, window.location.href);
        } catch (_) {
            return { detach() {} };
        }

        function onPop(e) {
            if (!armed || !armedHere) {
                return;
            }
            armedHere = false;
            detach();
            openOnce();
            try {
                history.forward();
            } catch (_) {}
        }

        function detach() {
            window.removeEventListener("popstate", onPop, true);
        }

        window.addEventListener("popstate", onPop, true);

        return { detach };
    }

    /**
     * Disarm all triggers immediately.
     */
    function disarm() {
        armed = false;
    }

    return {
        attachExitIntent,
        attachIdle,
        attachScroll,
        attachBackButton,
        disarm
    };
})();
