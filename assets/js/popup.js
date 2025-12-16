// Popup rendering, wiring, and integration with config, triggers and state.

class PopupManager {
    constructor() {
        this.configRef = null;
        this.currentPageConf = null;
        this.overlayEl = null;
        this.detachFns = [];
        this.escapeHandler = (e) => this.onEsc(e);
    }

    resolvePageConfig(config) {
        const path = (location && typeof location.pathname === "string" ? location.pathname : "/") || "/";
        const normalizedPath = path !== "/" && !path.endsWith("/") ? path + "/" : path;

        const pages = Array.isArray(config.pages) ? config.pages : [];
        let match = null;
        let bestLen = -1;

        for (let i = 0; i < pages.length; i++) {
            const m = pages[i] && typeof pages[i].match === "string" ? pages[i].match : null;
            if (!m) continue;
            const normalizedMatch = m !== "/" && !m.endsWith("/") ? m + "/" : m;
            if (normalizedPath.startsWith(normalizedMatch) && normalizedMatch.length > bestLen) {
                bestLen = normalizedMatch.length;
                match = pages[i];
            }
        }

        if (!match) {
            match = pages.find((p) => p && p.match === "/") || null;
        }

        const contentFile = match && typeof match.contentFile === "string" ? match.contentFile : null;

        let contentFileName = null;
        if (contentFile && /\.txt(?:\?.*)?$/i.test(contentFile)) {
            contentFileName = contentFile.split("/").pop().split("?")[0].split("#")[0];
        }

        const pageFallback = match && match.fallbackContent ? match.fallbackContent : null;
        let fallbackContent = pageFallback;
        if (!fallbackContent && contentFileName) {
            const byFile = pages.find((p) => {
                if (typeof p.contentFile !== "string") return false;
                const fname = p.contentFile.split("/").pop().split("?")[0].split("#")[0];
                return fname === contentFileName && !!p.fallbackContent;
            });
            if (byFile && byFile.fallbackContent) {
                fallbackContent = byFile.fallbackContent;
            }
        }

        if (!fallbackContent) {
            fallbackContent = (config.global && config.global.contentDefault) || {};
        }

        const triggers = Object.assign(
            {},
            (config.global && config.global.triggersDefault) || {},
            match && match.triggers ? match.triggers : {}
        );

        return { triggers, contentFile, fallbackContent };
    }

    buildDOM(content, ui) {
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
        
        const closeIcon = document.createElement("img");
        closeIcon.className = "rh-icon";
        const baseUrl = (window.RHP_DATA && window.RHP_DATA.baseUrl) || "";
        closeIcon.src = baseUrl + "/assets/img/close.svg";
        closeIcon.alt = "";
        closeBtn.appendChild(closeIcon);

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

        const card = document.createElement("div");
        card.className = "rh-popup-card";

        const cardText = document.createElement("p");
        cardText.className = "rh-popup-card-text";
        cardText.innerHTML = content.subtitleLine1 || "";

        const cardIco = document.createElement("img");
        cardIco.className = "rh-popup-card-ico";
        const baseUrl = (window.RHP_DATA && window.RHP_DATA.baseUrl) || "";
        cardIco.src = baseUrl + "/assets/img/check.svg";
        cardIco.alt = "";

        card.appendChild(cardText);
        card.appendChild(cardIco);

        const actions = document.createElement("div");
        actions.className = "rh-popup-actions";

        const btnTg = document.createElement("a");
        btnTg.className = "rh-btn rh-btn-telegram";
        btnTg.href = (this.configRef.global.telegramUrl || "#");
        btnTg.target = this.configRef.global.ui.openLinksInNewTab ? "_blank" : "_self";
        btnTg.rel = "noopener";
        btnTg.textContent = maybeUppercase("Написать в Telegram", this.configRef.global.ui.uppercaseButtons);
        btnTg.style.minHeight = `${Math.max(44, this.configRef.global.ui.buttonMinHeightPx || 44)}px`;

        const btnWa = document.createElement("a");
        btnWa.className = "rh-btn rh-btn-whatsapp";
        btnWa.href = (this.configRef.global.whatsappUrl || "#");
        btnWa.target = this.configRef.global.ui.openLinksInNewTab ? "_blank" : "_self";
        btnWa.rel = "noopener";
        btnWa.textContent = maybeUppercase("Написать в WhatsApp", this.configRef.global.ui.uppercaseButtons);
        btnWa.style.minHeight = `${Math.max(44, this.configRef.global.ui.buttonMinHeightPx || 44)}px`;

        actions.appendChild(btnTg);
        actions.appendChild(btnWa);

        const note = document.createElement("div");
        note.className = "rh-popup-note";
        note.textContent = content.noteSmall || "";

        modal.appendChild(closeBtn);
        modal.appendChild(header);
        modal.appendChild(card);
        modal.appendChild(actions);
        modal.appendChild(note);
        overlay.appendChild(modal);
        root.appendChild(overlay);

        const handleClose = () => {
            this.hide();
            PopupState.markClosed();
        };

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                handleClose();
            }
        });

        closeBtn.addEventListener("click", () => {
            handleClose();
        });

        const onActionClick = () => {
            if (this.configRef.global.ui.closeOnActionClick) {
                this.hide();
            }
            PopupState.markClicked();
        };

        btnTg.addEventListener("click", onActionClick);
        btnWa.addEventListener("click", onActionClick);

        return overlay;
    }

    show() {
        if (!this.configRef) {
            return;
        }
        const limits = this.configRef.global.limits || {};
        if (!PopupState.canShow(limits)) {
            return;
        }
        if (!this.overlayEl) {
            this.overlayEl = this.buildDOM(this.currentPageConf.content, this.configRef.global.ui || {});
        }
        if (!this.overlayEl) {
            return;
        }
        this.overlayEl.classList.add("rh-visible");
        PopupState.markShownThisSession();
        PopupTriggers.disarm();
        this.detachAll();
        this.trapEscapeKey();
    }

    hide() {
        if (!this.overlayEl) {
            return;
        }
        this.overlayEl.classList.remove("rh-visible");
        this.untrapEscapeKey();
    }

    onEsc(e) {
        if (e.key === "Escape") {
            this.hide();
            PopupState.markClosed();
        }
    }

    trapEscapeKey() {
        document.addEventListener("keydown", this.escapeHandler, true);
    }

    untrapEscapeKey() {
        document.removeEventListener("keydown", this.escapeHandler, true);
    }

    armTriggers() {
        const envIsMobile = isMobileEnv();
        const t = this.currentPageConf.triggers || {};
        const attached = [];

        if (!envIsMobile) {
            if (t.desktop && t.desktop.exitIntent) {
                attached.push(PopupTriggers.attachExitIntent(() => this.show()));
            }
            if (t.desktop && Number.isFinite(t.desktop.idleSeconds) && t.desktop.idleSeconds > 0) {
                attached.push(PopupTriggers.attachIdle(() => this.show(), t.desktop.idleSeconds));
            }
            if (t.desktop && Number.isFinite(t.desktop.scrollPercent) && t.desktop.scrollPercent > 0) {
                attached.push(PopupTriggers.attachScroll(() => this.show(), t.desktop.scrollPercent));
            }
        } else {
            if (t.mobile && t.mobile.backButton) {
                attached.push(PopupTriggers.attachBackButton(() => this.show()));
            }
            if (t.mobile && Number.isFinite(t.mobile.idleSeconds) && t.mobile.idleSeconds > 0) {
                attached.push(PopupTriggers.attachIdle(() => this.show(), t.mobile.idleSeconds));
            }
            if (t.mobile && Number.isFinite(t.mobile.scrollPercent) && t.mobile.scrollPercent > 0) {
                attached.push(PopupTriggers.attachScroll(() => this.show(), t.mobile.scrollPercent));
            }
        }

        this.detachFns = attached.map((x) => (typeof x.detach === "function" ? x.detach : () => {}));
    }

    detachAll() {
        try {
            this.detachFns.forEach((fn) => fn());
        } catch (_) {
            // Ignore errors during detach
        }
        this.detachFns = [];
    }

    async init(config) {
        if (!config) {
            throw new Error("Configuration is missing");
        }

        this.configRef = config;
        this.currentPageConf = this.resolvePageConfig(this.configRef);

        let contentData = null;

        if (window.RHP_DATA && window.RHP_DATA.content) {
            contentData = window.RHP_DATA.content;
        } else {
            contentData = this.currentPageConf.fallbackContent;
        }

        try {
            if (window.RHP_DEBUG) {
                console.info(
                    "[RHP] path=",
                    location.pathname,
                    " matched=",
                    (this.currentPageConf && this.currentPageConf.contentFile) || "(none)",
                    " content=",
                    contentData
                );
            }
        } catch (_) {
            // Ignore debug errors
        }

        this.currentPageConf.content = contentData;

        this.overlayEl = this.buildDOM(contentData, this.configRef.global.ui || {});

        if (PopupState.canShow(this.configRef.global.limits || {})) {
            this.armTriggers();
        }
    }
}

const popupInstance = new PopupManager();

window.Popup = {
    init: (config) => popupInstance.init(config),
};
