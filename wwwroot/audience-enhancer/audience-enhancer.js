/**
 * Audience Search Enhancer — audience-enhancer.js
 *
 * Self-contained IIFE. Injects a real-time search/filter bar into the
 * "Who can see this content?" tooltip that appears when editors personalise
 * content area blocks.
 *
 * The tooltip is a Dojo TooltipDialog rendered as:
 *   .dijitPopup (added to <body> each time the popup opens)
 *     └─ .epi-menu--inverted
 *          ├─ .epi-invertedTooltip > .epi-tooltipDialogTop
 *          │     └─ span[data-dojo-attach-point="header"]  ← title text
 *          └─ .epi-tooltipDialogContent--max-height
 *               └─ TABLE.dijitMenu
 *                    └─ TBODY
 *                         ├─ TR.dijitMenuItem  ← audience rows
 *                         └─ …
 *
 * Approach:
 *   1. At startup, scan all pre-existing .dijitPopup elements (Dojo
 *      pre-renders all popups; a childList observer alone misses them).
 *   2. MutationObserver on <body> also detects any newly-added .dijitPopup.
 *   3. If the popup's header text is "Who can see this content?" the search
 *      bar is injected below the title.
 *   4. Typing in the input shows/hides TR rows whose label text doesn't match.
 *      tbody is re-queried on every input event (never cached as a closure)
 *      so stale references can't break filtering after Dojo re-renders.
 *   5. A nested MutationObserver re-applies the filter when Dojo re-renders
 *      the menu (e.g. after a visitor group is checked/unchecked).
 *   6. A visibility MutationObserver resets the filter when the popup reopens.
 *
 * Also handles the RTE personalized-content React dialog as a secondary
 * enhancement (scrollable selected-audiences list).
 */
(function () {
    "use strict";

    function init() {

    /* ── Constants ─────────────────────────────────────────────────────── */

    var POPUP_SELECTOR      = ".dijitPopup";
    var WIDGET_SELECTOR     = ".epi-menu--inverted";
    var HEADER_ATTACH_POINT = "[data-dojo-attach-point='header']";
    var AUDIENCE_TITLE      = "Who can see this content?";
    var MENU_ROW_SELECTOR   = "tr.dijitMenuItem";
    var LABEL_SELECTOR      = "td.dijitMenuItemLabel";

    /* RTE React dialog (secondary) */
    var RTE_PANEL_SELECTOR  = ".personalized-content";
    var RTE_ITEM_SELECTOR   = ".visitor-group-list-item";

    /* ── SVG icons ──────────────────────────────────────────────────────── */

    var SEARCH_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    var CLEAR_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    /* ── Filter helpers ─────────────────────────────────────────────────── */

    function applyFilter(tbody, term) {
        var rows    = tbody.querySelectorAll(MENU_ROW_SELECTOR);
        var visible = 0;
        var norm    = term.toLowerCase().trim();

        rows.forEach(function (row) {
            var label = row.querySelector(LABEL_SELECTOR);
            var text  = label ? label.textContent.toLowerCase() : "";
            var match = !norm || text.indexOf(norm) !== -1;
            row.style.display = match ? "" : "none";
            if (match) visible++;
        });

        return visible;
    }

    function resetRowVisibility(tbody) {
        tbody.querySelectorAll(MENU_ROW_SELECTOR).forEach(function (row) {
            row.style.display = "";
        });
    }

    /* ── Inject the search bar into an audience tooltip ─────────────────── */

    function enhanceAudienceTooltip(widget) {
        if (widget.dataset.audienceEnhanced === "1") return;
        widget.dataset.audienceEnhanced = "1";
        widget.style.minWidth = "280px";

        /* The tooltip content lives inside .epi-dijitTooltipContainer */
        var tooltipContainer = widget.querySelector(".epi-dijitTooltipContainer");
        if (!tooltipContainer) return;

        var contentDiv = tooltipContainer.querySelector(".epi-tooltipDialogContent--max-height");
        if (!contentDiv) return;

        /* Dynamically re-query the scrollable content area on each event.
           Dojo renders audience rows and the "Everyone" radio in two separate
           table.dijitMenu elements, so we must query from the common parent. */
        function getMenuContainer() {
            return contentDiv;
        }

        /* ── Build the filter row ──────────────────────────────────────── */
        var filterRow = document.createElement("div");
        filterRow.className = "epi-audience-filter-row";

        /* Outer wrapper (positions icon + clear button) */
        var wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;display:flex;align-items:center;";

        var iconSpan = document.createElement("span");
        iconSpan.setAttribute("aria-hidden", "true");
        iconSpan.style.cssText =
            "position:absolute;left:8px;top:50%;transform:translateY(-50%);" +
            "pointer-events:none;color:#707070;display:flex;align-items:center;";
        iconSpan.innerHTML = SEARCH_SVG;

        var input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Filter audiences\u2026";
        input.setAttribute("aria-label", "Filter audiences");
        input.setAttribute("autocomplete", "off");
        input.style.cssText =
            "width:100%;height:32px;padding:0 28px 0 30px;" +
            "border:1px solid #c4c4c4;border-radius:4px;" +
            "font-size:13px;font-family:inherit;color:rgba(0,0,0,.87);" +
            "background:#fff;box-sizing:border-box;outline:none;";

        var clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.setAttribute("aria-label", "Clear filter");
        clearBtn.style.cssText =
            "position:absolute;right:6px;top:50%;transform:translateY(-50%);" +
            "background:none;border:none;cursor:pointer;padding:2px;" +
            "color:#707070;display:none;align-items:center;line-height:1;";
        clearBtn.innerHTML = CLEAR_SVG;

        wrap.appendChild(iconSpan);
        wrap.appendChild(input);
        wrap.appendChild(clearBtn);
        filterRow.appendChild(wrap);

        /* Insert filter row just before the scrollable content area */
        tooltipContainer.insertBefore(filterRow, contentDiv);

        /* ── Wire up focus style ───────────────────────────────────────── */
        input.addEventListener("focus", function () {
            input.style.borderColor = "#0037ff";
            input.style.boxShadow   = "0 0 0 2px rgba(0,55,255,.12)";
        });
        input.addEventListener("blur", function () {
            input.style.borderColor = "#c4c4c4";
            input.style.boxShadow   = "";
        });

        /* ── Wire up filtering ─────────────────────────────────────────── */
        var currentTerm = "";

        function onInput() {
            currentTerm = input.value;
            clearBtn.style.display = currentTerm ? "flex" : "none";
            var mc = getMenuContainer();
            if (mc) applyFilter(mc, currentTerm);
        }

        input.addEventListener("input", onInput);

        input.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                input.value = "";
                currentTerm = "";
                clearBtn.style.display = "none";
                var mc = getMenuContainer();
                if (mc) resetRowVisibility(mc);
            }
            /* Prevent CMS key handlers from stealing keystrokes */
            e.stopPropagation();
        });

        clearBtn.addEventListener("click", function () {
            input.value = "";
            currentTerm = "";
            clearBtn.style.display = "none";
            var mc = getMenuContainer();
            if (mc) resetRowVisibility(mc);
            input.focus();
        });

        /* ── Re-apply filter when Dojo re-renders the menu rows ────────── */
        var rowObserver = new MutationObserver(function () {
            if (currentTerm) {
                var mc = getMenuContainer();
                if (mc) applyFilter(mc, currentTerm);
            }
        });
        rowObserver.observe(contentDiv, { childList: true, subtree: true });

        /* ── Reset filter when popup is re-opened ──────────────────────── */
        var popupNode = widget.closest(".dijitPopup");
        if (popupNode) {
            new MutationObserver(function () {
                if (popupNode.style.visibility === "visible" && currentTerm) {
                    input.value = "";
                    currentTerm = "";
                    clearBtn.style.display = "none";
                    var mc = getMenuContainer();
                    if (mc) resetRowVisibility(mc);
                }
            }).observe(popupNode, { attributes: true, attributeFilter: ["style"] });
        }
    }

    /* ── Check if a .dijitPopup contains the audience tooltip ───────────── */

    function tryEnhancePopup(node) {
        if (!node || !node.matches) return;
        /* Accept both the .dijitPopup wrapper and direct .epi-menu--inverted nodes */
        var widget;
        if (node.matches(POPUP_SELECTOR)) {
            widget = node.querySelector("div" + WIDGET_SELECTOR);
        } else if (node.matches("div" + WIDGET_SELECTOR)) {
            widget = node;
        } else {
            return;
        }
        if (!widget) return;

        var header = widget.querySelector(HEADER_ATTACH_POINT);
        if (!header) return;

        /* Only act on the "Who can see this content?" tooltip */
        if (header.textContent.trim() !== AUDIENCE_TITLE) return;

        enhanceAudienceTooltip(widget);
    }

    /* ── Secondary: RTE React dialog enhancement ────────────────────────── */

    function enhanceRtePanel(panel) {
        if (panel.dataset.audienceEnhanced === "1") return;

        var items = panel.querySelectorAll(RTE_ITEM_SELECTOR);
        if (!items.length) return;

        panel.dataset.audienceEnhanced = "1";

        var listContainer = items[0].parentElement;
        var wrapper = document.createElement("div");
        wrapper.className = "epi-audience-list-wrapper";
        listContainer.parentNode.insertBefore(wrapper, listContainer);
        wrapper.appendChild(listContainer);
    }

    /* ── Top-level MutationObserver (catches newly added popups) ────────── */

    var bodyObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return;

                /* Dojo popup — primary target */
                tryEnhancePopup(node);

                /* React dialog — secondary target */
                if (node.matches && node.matches(RTE_PANEL_SELECTOR)) {
                    enhanceRtePanel(node);
                } else if (node.querySelector) {
                    var rte = node.querySelector(RTE_PANEL_SELECTOR);
                    if (rte) enhanceRtePanel(rte);
                }
            });
        });
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });

    /* ── Startup scan: enhance pre-rendered (already in DOM) popups ──────── */
    /* Dojo pre-renders all popup widgets at page load and shows/hides them   */
    /* via style.visibility, so the MutationObserver childList never fires.   */

    document.querySelectorAll(".dijitPopup").forEach(function (popupNode) {
        tryEnhancePopup(popupNode);
    });
    } // end init()

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
