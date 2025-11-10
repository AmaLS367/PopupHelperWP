// Popup rendering, wiring, and integration with config, triggers and state.

const Popup = (function () {
    function rhpDetectBaseUrl() {
        try {
            var cs = document.currentScript && document.currentScript.getAttribute("src");
            if (cs) {
                var m1 = cs.match(/^(.*\/wp-content\/plugins\/relohelper-popup)\//i);
                if (m1) return m1[1];
            }

            var scripts = document.getElementsByTagName("script");
            for (var i = scripts.length - 1; i >= 0; i--) {
                var src = scripts[i].getAttribute("src") || "";
                var m2 = src.match(/^(.*\/wp-content\/plugins\/relohelper-popup)\//i);
                if (m2) return m2[1];
            }

            var links = document.getElementsByTagName("link");
            for (var j = links.length - 1; j >= 0; j--) {
                var href = links[j].getAttribute("href") || "";
                var m3 = href.match(/^(.*\/wp-content\/plugins\/relohelper-popup)\//i);
                if (m3) return m3[1];
            }
        } catch (_) {}
        return "";
    }

    function assetUrl(p) {
        try {
            if (!p) return "";
            var s = String(p);

            if (s.charAt(0) === "?") return s;

            if (/\.(txt|json)(?:\?.*)?$/i.test(s)) {
                var fname = s.split("/").pop();
                return "?rhp=content&file=" + fname;
            }

            if (/^https?:\/\//i.test(s)) return s;

            var baseRaw = (window.RHP_BASE || rhpDetectBaseUrl() || "");
            var base = baseRaw.replace(/\/+$/,"") + "/";
            return base + s.replace(/^\/+/, "");
        } catch (e) {
            return String(p || "");
        }
    }

    let configRef = null;
    let currentPageConf = null;
    let overlayEl = null;
    let detachFns = [];

    // Find page config by current path. Falls back to defaults.
    function resolvePageConfig(config) {
        var path = (location && typeof location.pathname === "string" ? location.pathname : "/") || "/";
        if (path !== "/" && !/\/$/.test(path)) {
            path += "/";
        }

        // Pick the LONGEST matching prefix to avoid accidental defaulting to global
        var pages = Array.isArray(config.pages) ? config.pages : [];
        var match = null;
        var bestLen = -1;
        for (var i = 0; i < pages.length; i++) {
            var m = pages[i] && typeof pages[i].match === "string" ? pages[i].match : null;
            if (!m) continue;
            if (m !== "/" && !/\/$/.test(m)) m += "/";
            if (path.indexOf(m) === 0 && m.length > bestLen) {
                bestLen = m.length;
                match = pages[i];
            }
        }
        if (!match) {
            match = pages.find(function (p) { return p && p.match === "/"; }) || null;
        }

        var contentFile = match && typeof match.contentFile === "string" ? match.contentFile : null;

        // Normalize .txt to bare filename to enable filename-based fallback
        var contentFileName = null;
        if (contentFile && /\.txt(?:\?.*)?$/i.test(contentFile)) {
            contentFileName = contentFile.split("/").pop().split("?")[0].split("#")[0];
            contentFile = contentFileName;
        }

        // Page-level fallback has priority; if no direct page fallback, try by filename
        var pageFallback = match && match.fallbackContent ? match.fallbackContent : null;
        if (!pageFallback && contentFileName) {
            var byFile = pages.find(function (p) {
                if (typeof p.contentFile !== "string") return false;
                var fname = p.contentFile.split("/").pop().split("?")[0].split("#")[0];
                return fname === contentFileName && !!p.fallbackContent;
            });
            if (byFile && byFile.fallbackContent) {
                pageFallback = byFile.fallbackContent;
            }
        }

        var fallbackContent = Object.assign({}, (config.global && config.global.contentDefault) || {}, pageFallback || {});

        var triggers = Object.assign({}, (config.global && config.global.triggersDefault) || {}, match && match.triggers ? match.triggers : {});

        return { triggers: triggers, contentFile: contentFile, fallbackContent: fallbackContent };
    }

    // Build popup DOM and inject into #popup-root.
    function buildDOM(content, ui) {
        const root = document.getElementById("popup-root");
        if (!root) {
            console.warn("Popup root element not found");
            return null;
        }

        root.innerHTML = "";

        const overlay = document.createElement("div");
        overlay.className = "rh-popup-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");

        const modal = document.createElement("div");
        modal.className = "rh-popup";

        const closeBtn = document.createElement("button");
        closeBtn.className = "rh-popup-close";
        closeBtn.setAttribute("aria-label", "Закрыть");
        closeBtn.innerHTML = '<img class="rh-icon" src="/wp-content/plugins/relohelper-popup/assets/img/close.svg" alt="">';

        // Header: title + badge
        const header = document.createElement("div");
        header.className = "rh-popup-header";

        const h = document.createElement("h2");
        h.className = "rh-popup-title";
        const rawTitle = String(content.title || "");
        h.textContent = rawTitle
            .replace(/\s*без\s+риска\s*$/i, "")
            .replace(/Digital\s+nomad/ig, "Digital Nomad");

        const badge = document.createElement("div");
        badge.className = "rh-popup-badge";
        badge.textContent = "без риска";

        header.appendChild(h);
        header.appendChild(badge);

        // Promo card: left text, right icon
        const card = document.createElement("div");
        card.className = "rh-popup-card";

        const cardText = document.createElement("p");
        cardText.className = "rh-popup-card-text";
        cardText.innerHTML = content.subtitleLine1 || "";

        const cardIco = document.createElement("img");
        cardIco.className = "rh-popup-card-ico";
        cardIco.src = '/wp-content/plugins/relohelper-popup/assets/img/check.svg';
        cardIco.alt = "";

        card.appendChild(cardText);
        card.appendChild(cardIco);

        // Actions
        const actions = document.createElement("div");
        actions.className = "rh-popup-actions";

        const btnTg = document.createElement("a");
        btnTg.className = "rh-btn rh-btn-telegram";
        btnTg.href = (configRef.global.telegramUrl || "#");
        btnTg.target = configRef.global.ui.openLinksInNewTab ? "_blank" : "_self";
        btnTg.rel = "noopener";
        btnTg.textContent = maybeUppercase("Написать в Telegram", configRef.global.ui.uppercaseButtons);
        btnTg.style.minHeight = `${Math.max(44, configRef.global.ui.buttonMinHeightPx || 44)}px`;

        const btnWa = document.createElement("a");
        btnWa.className = "rh-btn rh-btn-whatsapp";
        btnWa.href = (configRef.global.whatsappUrl || "#");
        btnWa.target = configRef.global.ui.openLinksInNewTab ? "_blank" : "_self";
        btnWa.rel = "noopener";
        btnWa.textContent = maybeUppercase("Написать в WhatsApp", configRef.global.ui.uppercaseButtons);
        btnWa.style.minHeight = `${Math.max(44, configRef.global.ui.buttonMinHeightPx || 44)}px`;

        actions.appendChild(btnTg);
        actions.appendChild(btnWa);

        const note = document.createElement("div");
        note.className = "rh-popup-note";
        note.textContent = content.noteSmall || "";

        // Compose
        modal.appendChild(closeBtn);
        modal.appendChild(header);
        modal.appendChild(card);
        modal.appendChild(actions);
        modal.appendChild(note);
        overlay.appendChild(modal);
        root.appendChild(overlay);

        function handleClose() {
            hide();
            PopupState.markClosed();
        }

        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) {
                handleClose();
            }
        });

        closeBtn.addEventListener("click", function () {
            handleClose();
        });

        function onActionClick() {
            if (configRef.global.ui.closeOnActionClick) {
                hide();
            }
            PopupState.markClicked();
        }

        btnTg.addEventListener("click", onActionClick);
        btnWa.addEventListener("click", onActionClick);

        return overlay;
    }



    // Show popup if state allows it.
    function show() {
        if (!configRef) {
            return;
        }
        const limits = configRef.global.limits || {};
        if (!PopupState.canShow(limits)) {
            return;
        }
        if (!overlayEl) {
            overlayEl = buildDOM(currentPageConf.content, configRef.global.ui || {});
        }
        if (!overlayEl) {
            return;
        }
        overlayEl.classList.add("rh-visible");
        PopupState.markShownThisSession();
        PopupTriggers.disarm();
        detachAll();
        trapEscapeKey();
    }


    // Hide popup.
    function hide() {
        if (!overlayEl) {
            return;
        }
        overlayEl.classList.remove("rh-visible");
        untrapEscapeKey();
    }

    // Escape key to close popup.
    function onEsc(e) {
        if (e.key === "Escape") {
            hide();
            PopupState.markClosed();
        }
    }

    function trapEscapeKey() {
        document.addEventListener("keydown", onEsc, true);
    }

    function untrapEscapeKey() {
        document.removeEventListener("keydown", onEsc, true);
    }

    // Attach triggers according to environment and config.
    function armTriggers() {
        const envIsMobile = isMobileEnv();
        const t = currentPageConf.triggers || {};
        const attached = [];

        if (!envIsMobile) {
            if (t.desktop && t.desktop.exitIntent) {
                attached.push(PopupTriggers.attachExitIntent(show));
            }
            if (t.desktop && Number.isFinite(t.desktop.idleSeconds) && t.desktop.idleSeconds > 0) {
                attached.push(PopupTriggers.attachIdle(show, t.desktop.idleSeconds));
            }
            if (t.desktop && Number.isFinite(t.desktop.scrollPercent) && t.desktop.scrollPercent > 0) {
                attached.push(PopupTriggers.attachScroll(show, t.desktop.scrollPercent));
            }
        } else {
            if (t.mobile && t.mobile.backButton) {
                attached.push(PopupTriggers.attachBackButton(show));
            }
            if (t.mobile && Number.isFinite(t.mobile.idleSeconds) && t.mobile.idleSeconds > 0) {
                attached.push(PopupTriggers.attachIdle(show, t.mobile.idleSeconds));
            }
            if (t.mobile && Number.isFinite(t.mobile.scrollPercent) && t.mobile.scrollPercent > 0) {
                attached.push(PopupTriggers.attachScroll(show, t.mobile.scrollPercent));
            }
        }

        detachFns = attached.map(x => (typeof x.detach === "function" ? x.detach : function () {}));
    }

    function detachAll() {
        try {
            detachFns.forEach(fn => fn());
        } catch (_) {}
        detachFns = [];
    }

    // Public init entry.
    async function parseKvText(raw) {
        const out = {};
        const lines = String(raw).split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("#")) {
                continue;
            }
            const eq = line.indexOf("=");
            if (eq === -1) {
                continue;
            }
            const key = line.slice(0, eq).trim();
            const val = line.slice(eq + 1).trim();
            if (key) {
                out[key] = val;
            }
        }
        return out;
    }

    async function loadTxtKvFile(filePath, fallbackContent) {
        if (!filePath) {
            return fallbackContent;
        }
        try {
            // Normalize to bare filename
            var s = String(filePath);
            var fname = s.split("/").pop().split("?")[0].split("#")[0];

            // If JSON is requested first, try JSON, then fallback to TXT on any non-200 (400/404 included)
            if (/\.json$/i.test(fname)) {
                const urlJson = assetUrl(fname); // -> ?rhp=content&file=home_es.json
                const resJson = await fetch(urlJson, { cache: "no-cache", credentials: "same-origin" });
                if (resJson.ok) {
                    const raw = await resJson.text();
                    let obj = {};
                    try { obj = JSON.parse(raw); } catch (_) { obj = {}; }
                    if (obj && Object.keys(obj).length > 0) {
                        return {
                            title: obj.title || fallbackContent.title,
                            subtitleLine1: obj.subtitleLine1 || obj.subtitle || fallbackContent.subtitleLine1,
                            subtitleLine2: obj.subtitleLine2 || fallbackContent.subtitleLine2,
                            noteSmall: obj.noteSmall || obj.note || fallbackContent.noteSmall
                        };
                    }
                }

                fname = fname.replace(/\.json$/i, ".txt");
                const urlTxtFromJson = assetUrl(fname); // -> ?rhp=content&file=home_es.txt
                const resTxtFromJson = await fetch(urlTxtFromJson, { cache: "no-cache", credentials: "same-origin" });
                if (resTxtFromJson.ok) {
                    const textTxt = await resTxtFromJson.text();
                    const kvTxt = await parseKvText(textTxt);
                    return {
                        title: kvTxt.title || fallbackContent.title,
                        subtitleLine1: kvTxt.subtitle1 || fallbackContent.subtitleLine1,
                        subtitleLine2: kvTxt.subtitle2 || fallbackContent.subtitleLine2,
                        noteSmall: kvTxt.note || fallbackContent.noteSmall
                    };
                }

                return fallbackContent;
            }

            // TXT requested (or anything else) — always go through the endpoint
            if (/\.txt$/i.test(fname)) {
                const urlTxt = assetUrl(fname); // -> ?rhp=content&file=home_es.txt
                const resTxt = await fetch(urlTxt, { cache: "no-cache", credentials: "same-origin" });
                if (!resTxt.ok) {
                    return fallbackContent;
                }
                const text = await resTxt.text();
                const kv = await parseKvText(text);
                return {
                    title: kv.title || fallbackContent.title,
                    subtitleLine1: kv.subtitle1 || fallbackContent.subtitleLine1,
                    subtitleLine2: kv.subtitle2 || fallbackContent.subtitleLine2,
                    noteSmall: kv.note || fallbackContent.noteSmall
                };
            }

            // Non-text path: keep prior behavior through assetUrl
            const resOther = await fetch(assetUrl(filePath), { cache: "no-cache", credentials: "same-origin" });
            if (!resOther.ok) {
                return fallbackContent;
            }
            const textOther = await resOther.text();
            const kvOther = await parseKvText(textOther);
            return {
                title: kvOther.title || fallbackContent.title,
                subtitleLine1: kvOther.subtitle1 || fallbackContent.subtitleLine1,
                subtitleLine2: kvOther.subtitle2 || fallbackContent.subtitleLine2,
                noteSmall: kvOther.note || fallbackContent.noteSmall
            };
        } catch (e) {
            return fallbackContent;
        }
    }

    async function init(config) {
        configRef = config;
        currentPageConf = resolvePageConfig(configRef);

        const contentData = await loadTxtKvFile(
            currentPageConf.contentFile,
            currentPageConf.fallbackContent
        );

        try {
            if (window.RHP_DEBUG) {
                console.info("[RHP] path=", location.pathname,
                    " matched=", (currentPageConf && currentPageConf.contentFile) || "(none)",
                    " source=", contentData && contentData.__source);
            }
        } catch (_) {}

        currentPageConf.content = contentData;

        overlayEl = buildDOM(contentData, configRef.global.ui || {});

        if (PopupState.canShow(configRef.global.limits || {})) {
            armTriggers();
        }
    }


    return {
        init
    };
})();
