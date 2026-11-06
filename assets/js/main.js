/* ==========================================================================
   PORTFOLIO — SCRIPT UNICO (vanilla JS, nessuna dipendenza)
   01. Accento colore (6 preset) + favicon
   02. Menu a tutto schermo
   03. Indice laterale attivo durante lo scroll
   04. Anno nel footer
   05. Copia indirizzo email
   06. Tab Portfolio sticky
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var lang = (root.lang || "en").toLowerCase().indexOf("it") === 0 ? "it" : "en";

  /* 01. ACCENTO ----------------------------------------------------------- */
  var ACCENTS = ["orange", "green", "red", "blue", "cyan", "violet"];
  var ACCENT_HEX = {
    orange: "#ff7100",
    green: "#3dffa0",
    red: "#ff3556",
    blue: "#3f7bff",
    cyan: "#2bd9ff",
    violet: "#b26bff"
  };
  var accentButtons = Array.prototype.slice.call(
    document.querySelectorAll("[data-accent-set]")
  );

  function currentAccent() {
    var a = root.getAttribute("data-accent");
    return ACCENTS.indexOf(a) > -1 ? a : "orange";
  }

  function updateFavicon(name) {
    var link = document.getElementById("favicon-svg");
    if (!link) return;
    var color = ACCENT_HEX[name] || ACCENT_HEX.orange;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" fill="#08090b"/>' +
      '<rect x="10" y="10" width="12" height="12" fill="' + color + '"/>' +
      "</svg>";
    link.setAttribute("href", "data:image/svg+xml," + encodeURIComponent(svg));
  }

  function setAccent(name, persist) {
    if (ACCENTS.indexOf(name) === -1) name = "orange";
    root.setAttribute("data-accent", name);

    accentButtons.forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-accent-set") === name ? "true" : "false"
      );
    });

    updateFavicon(name);

    try {
      document.dispatchEvent(new CustomEvent("accentchange", { detail: { accent: name } }));
    } catch (err) {
      /* Browser senza CustomEvent: il canvas terrà l'accento iniziale. */
    }

    if (persist) {
      try {
        localStorage.setItem("accento", name);
      } catch (err) {
        /* Storage non disponibile: l'accento vale solo per questa pagina. */
      }
    }
  }

  accentButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setAccent(btn.getAttribute("data-accent-set"), true);
    });
  });

  setAccent(currentAccent(), false);

  /* Preferenza lingua: salvata al click sullo switch.
     location.replace evita che il tasto Indietro torni alla lingua precedente
     e faccia scattare di nuovo il redirect automatico. */
  document.querySelectorAll("[data-lang]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      try {
        localStorage.setItem("pref_lang", link.getAttribute("data-lang"));
      } catch (err) {
        /* Storage non disponibile: vale solo per la navigazione corrente. */
      }
      if (link.href) {
        event.preventDefault();
        window.location.replace(link.href);
      }
    });
  });

  /* 02. MENU -------------------------------------------------------------- */
  var nav = document.getElementById("primary-nav");
  var navToggle = document.querySelector(".nav-toggle");
  var navClose = document.querySelector(".nav-close");
  var lastFocused = null;

  function setNav(open, restoreFocus) {
    if (!nav || !navToggle) return;

    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);

    if (open) {
      lastFocused = document.activeElement;
      if (navClose) navClose.focus();
    } else if (restoreFocus && lastFocused) {
      lastFocused.focus();
    }
  }

  if (nav && navToggle) {
    navToggle.addEventListener("click", function () {
      setNav(navToggle.getAttribute("aria-expanded") !== "true", false);
    });

    if (navClose) {
      navClose.addEventListener("click", function () {
        setNav(false, true);
      });
    }

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNav(false, false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setNav(false, true);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) setNav(false, false);
    });
  }

  /* 03. INDICE LATERALE ATTIVO ------------------------------------------- */
  var toc = document.querySelector("[data-toc]");

  if (toc) {
    var tocLinks = Array.prototype.slice.call(
      toc.querySelectorAll('a[href^="#"]')
    );
    var tocTargets = tocLinks
      .map(function (link) {
        return document.getElementById(link.getAttribute("href").slice(1));
      })
      .filter(Boolean);

    var syncToc = function () {
      var y = window.scrollY;
      var current = null;

      tocTargets.forEach(function (target) {
        var top = target.getBoundingClientRect().top + y;
        if (top - 150 <= y) current = target;
      });

      var atBottom =
        window.innerHeight + y >=
        document.documentElement.scrollHeight - 4;

      if (atBottom && tocTargets.length) {
        current = tocTargets[tocTargets.length - 1];
      }

      tocLinks.forEach(function (link) {
        if (current && link.getAttribute("href") === "#" + current.id) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    var tocTick = false;
    window.addEventListener(
      "scroll",
      function () {
        if (!tocTick) {
          tocTick = true;
          window.requestAnimationFrame(function () {
            syncToc();
            tocTick = false;
          });
        }
      },
      { passive: true }
    );

    syncToc();
  }

  /* 04. ANNO -------------------------------------------------------------- */
  var year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = year;
  });

  /* 05. COPIA EMAIL ------------------------------------------------------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var feedback = document.getElementById(btn.getAttribute("aria-describedby"));
    var original = btn.textContent;
    var value = btn.getAttribute("data-copy") || "";

    var report = function (ok) {
      btn.textContent = ok
        ? (lang === "it" ? "Copiato" : "Copied")
        : (lang === "it" ? "Copia manuale" : "Copy manually");
      if (feedback) {
        feedback.textContent = ok
          ? (lang === "it"
              ? "Indirizzo copiato negli appunti."
              : "Address copied to the clipboard.")
          : (lang === "it" ? "Copia manuale: " + value : "Copy manually: " + value);
      }
      window.setTimeout(function () {
        btn.textContent = original;
        if (feedback) feedback.textContent = "";
      }, 2400);
    };

    btn.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(
          function () {
            report(true);
          },
          function () {
            report(false);
          }
        );
      } else {
        report(false);
      }
    });
  });
})();

/* 06. TAB PORTFOLIO ------------------------------------------------------ */
(function () {
  var tab = document.querySelector("[data-portfolio-tab]");
  var target = document.querySelector("[data-page-portfolio]") || document.querySelector(".page-head");
  if (!tab || !target) return;

  if (!("IntersectionObserver" in window)) {
    tab.classList.add("is-on");
    return;
  }

  new IntersectionObserver(function (entries) {
    tab.classList.toggle("is-on", !entries[0].isIntersecting);
  }, { threshold: 0, rootMargin: "-160px 0px 0px 0px" }).observe(target);

  // Nella home la tab è un'ancora alla card: portala in vista e dalle il focus.
  tab.addEventListener("click", function () {
    var href = tab.getAttribute("href") || "";
    if (href.charAt(0) !== "#") return;
    target.focus({ preventScroll: true });
  });
})();

/* 07. VIDEO RING --------------------------------------------------------- */
(function () {
  var reel = document.querySelector("[data-reel]");
  if (!reel) return;

  var ring = reel.querySelector("[data-reel-ring]");
  var stage = reel.querySelector("[data-reel-stage]");
  var cards = Array.prototype.slice.call(reel.querySelectorAll("[data-reel-card]"));
  var panels = Array.prototype.slice.call(reel.querySelectorAll("[data-work-panel]"));
  var current = reel.querySelector("[data-reel-current]");
  var totalEl = reel.querySelector("[data-reel-total]");
  var prev = reel.querySelector("[data-reel-prev]");
  var next = reel.querySelector("[data-reel-next]");
  var dialog = document.querySelector("[data-video-dialog]");
  var frame = document.querySelector("[data-video-frame]");
  var caption = document.querySelector("[data-video-caption]");
  var close = document.querySelector("[data-video-close]");
  if (!ring || !cards.length) return;

  var total = cards.length;
  var active = 0;
  var desktop = window.matchMedia("(min-width: 901px)");
  var lastFocus = null;
  var lastOpenClick = 0;
  var dragStart = null;
  var dragMoved = false;
  var lastDrag = 0;

  ring.style.setProperty("--step", 360 / total + "deg");

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function measure() {
    if (!desktop.matches) return;
    var width = ring.clientWidth;
    if (!width) return;
    var radius = width / 2 / Math.tan(Math.PI / total);
    ring.style.setProperty("--radius", Math.round(radius * 1.04) + "px");
  }

  function setActive(index, focus) {
    active = (index + total) % total;
    ring.style.setProperty("--active", active);

    cards.forEach(function (card, i) {
      var rel = i - active;
      if (rel > total / 2) rel -= total;
      if (rel < -total / 2) rel += total;
      var isActive = rel === 0;
      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-prev", rel === -1);
      card.classList.toggle("is-next", rel === 1);
      card.classList.toggle("is-far", Math.abs(rel) > 1);
      card.tabIndex = isActive ? 0 : -1;
      if (isActive) {
        card.setAttribute("aria-current", "true");
      } else {
        card.removeAttribute("aria-current");
      }
    });

    var activeWork = cards[active].getAttribute("data-work");
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-work-panel") !== activeWork;
    });

    if (current) current.textContent = pad(active + 1);
    if (focus) {
      cards[active].focus({ preventScroll: true });
      if (!desktop.matches && cards[active].scrollIntoView) {
        cards[active].scrollIntoView({
          block: "nearest",
          inline: "center",
          behavior: "smooth"
        });
      }
    }
  }

  function openVideo(card) {
    var id = card.getAttribute("data-video-id");
    var start = card.getAttribute("data-start");
    var title = card.getAttribute("data-title") || "";
    if (!id) return;

    if (!dialog || typeof dialog.showModal !== "function") {
      window.location.href = card.href;
      return;
    }

    var src =
      "https://www.youtube-nocookie.com/embed/" +
      encodeURIComponent(id) +
      "?autoplay=1&rel=0&playsinline=1";
    if (start) src += "&start=" + encodeURIComponent(start);

    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = title + " — video";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    if (frame) {
      while (frame.firstChild) frame.removeChild(frame.firstChild);
      frame.appendChild(iframe);
    }
    if (caption) caption.textContent = title + " — YouTube";

    lastFocus = document.activeElement;
    // Il click che apre il player può essere ritargettato sul backdrop:
    // il primo click sul backdrop viene ignorato per una frazione di secondo.
    lastOpenClick = Date.now();
    if (!dialog.open) dialog.showModal();
  }

  function clearVideo() {
    if (!frame) return;
    while (frame.firstChild) frame.removeChild(frame.firstChild);
  }

  function closeVideo() {
    if (dialog && dialog.open) dialog.close();
    clearVideo();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  cards.forEach(function (card, i) {
    card.addEventListener("click", function (e) {
      if (Date.now() - lastDrag < 300) {
        e.preventDefault();
        return;
      }
      if (i !== active) {
        e.preventDefault();
        setActive(i, true);
        return;
      }
      e.preventDefault();
      openVideo(card);
    });
  });

  Array.prototype.forEach.call(reel.querySelectorAll("[data-reel-play]"), function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      openVideo(cards[active]);
    });
  });

  if (prev) {
    prev.addEventListener("click", function () {
      setActive(active - 1, true);
    });
  }
  if (next) {
    next.addEventListener("click", function () {
      setActive(active + 1, true);
    });
  }

  ring.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive(active - 1, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive(active + 1, true);
    }
  });

  if (stage) {
    // Senza questo, il browser trascina l'anteprima del link invece di
    // far ruotare l'anello.
    stage.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });

    stage.addEventListener("pointerdown", function (e) {
      if (!desktop.matches || e.pointerType === "touch" || e.button !== 0) return;
      dragStart = e.clientX;
      dragMoved = false;
    });

    stage.addEventListener("pointermove", function (e) {
      if (dragStart === null) return;
      var dx = e.clientX - dragStart;

      if (!dragMoved) {
        // Il capture parte solo quando il gesto è davvero un drag:
        // altrimenti il click verrebbe ritargettato allo stage e la card
        // non lo riceverebbe.
        if (Math.abs(dx) <= 8) return;
        dragMoved = true;
        ring.classList.add("is-dragging");
        stage.classList.add("is-dragging");
        ring.style.setProperty("--drag", "0deg");
        if (stage.setPointerCapture) {
          try {
            stage.setPointerCapture(e.pointerId);
          } catch (err) {}
        }
      }

      var step = 360 / total;
      var perCard = Math.max(140, ring.clientWidth * 0.55);
      var deg = (dx / perCard) * step;
      var maxDeg = step * 2;
      if (deg > maxDeg) deg = maxDeg;
      if (deg < -maxDeg) deg = -maxDeg;
      ring.style.setProperty("--drag", deg + "deg");
    });

    stage.addEventListener("pointerup", function (e) {
      if (dragStart === null) return;
      var dx = e.clientX - dragStart;
      var wasDrag = dragMoved;
      dragStart = null;

      if (!wasDrag) {
        // Click semplice: nessun capture, nessuna soppressione.
        return;
      }

      ring.classList.remove("is-dragging");
      stage.classList.remove("is-dragging");

      var perCard = Math.max(140, ring.clientWidth * 0.55);
      var steps = Math.round(-dx / perCard);
      if (!steps && Math.abs(dx) > Math.max(40, perCard * 0.18)) {
        steps = dx < 0 ? 1 : -1;
      }

      lastDrag = Date.now();
      // Con la transizione riattivata, il rilascio riporta l'anello
      // sulla card più vicina (o su quella successiva, se il gesto è netto).
      void ring.offsetWidth;
      ring.style.setProperty("--drag", "0deg");
      setActive(active + steps, true);
    });

    stage.addEventListener("pointercancel", function () {
      dragStart = null;
      ring.classList.remove("is-dragging");
      stage.classList.remove("is-dragging");
      ring.style.setProperty("--drag", "0deg");
    });
  }

  if (dialog) {
    dialog.addEventListener("close", function () {
      clearVideo();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    });

    dialog.addEventListener("click", function (e) {
      if (Date.now() - lastOpenClick < 300) return;
      if (e.target === dialog) closeVideo();
    });
  }

  if (close) close.addEventListener("click", closeVideo);

  setActive(0, false);
  if (totalEl) totalEl.textContent = pad(total);
  measure();
  window.addEventListener("resize", measure);
})();

/* 08. VIDEO TABS --------------------------------------------------------- */
(function () {
  var systems = document.querySelectorAll("[data-reel-tabs]");
  if (!systems.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var interval = 15000;

  Array.prototype.forEach.call(systems, function (system) {
    var tabs = Array.prototype.slice.call(system.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    var panels = tabs.map(function (tab) {
      return document.getElementById(tab.getAttribute("aria-controls"));
    });
    if (panels.some(function (panel) { return !panel; })) return;

    var root = system.closest("[data-work-panel]") || system;
    var pauseBtn = system.querySelector("[data-reel-tabs-pause]");
    var labelPause = system.getAttribute("data-label-pause") || "Pause the automatic tour";
    var labelResume = system.getAttribute("data-label-resume") || "Resume the automatic tour";
    var current = tabs.findIndex(function (tab) {
      return tab.classList.contains("is-active");
    });
    if (current < 0) current = 0;

    var timer = null;
    var visible = false;
    var focused = false;
    var pageHidden = document.hidden;
    var stopped = reduced.matches;

    function canRun() {
      return (
        !stopped &&
        visible &&
        !focused &&
        !pageHidden &&
        !root.hidden &&
        tabs.length > 1
      );
    }

    function schedule() {
      clearTimeout(timer);
      timer = null;
      if (!canRun()) return;
      timer = setTimeout(function () {
        if (!canRun()) return;
        activate((current + 1) % tabs.length, false);
      }, interval);
    }

    function updateButton() {
      if (!pauseBtn) return;
      pauseBtn.textContent = stopped ? "▶" : "❚❚";
      pauseBtn.setAttribute("aria-label", stopped ? labelResume : labelPause);
    }

    function activate(index, focus) {
      current = (index + tabs.length) % tabs.length;
      tabs.forEach(function (tab, i) {
        var isActive = i === current;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.tabIndex = isActive ? 0 : -1;
        panels[i].classList.toggle("is-active", isActive);
        panels[i].hidden = !isActive;
      });
      if (focus) tabs[current].focus({ preventScroll: true });
      schedule();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () {
        stopped = true;
        updateButton();
        activate(i, false);
      });

      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = i + 1;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = i - 1;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next === null) return;
        e.preventDefault();
        stopped = true;
        updateButton();
        activate(next, true);
      });
    });

    if (pauseBtn) {
      pauseBtn.hidden = tabs.length < 2;
      pauseBtn.addEventListener("click", function () {
        stopped = !stopped;
        if (!stopped) focused = false;
        updateButton();
        schedule();
      });
    }

    root.addEventListener("focusin", function (e) {
      if (e.target === pauseBtn) return;
      focused = true;
      schedule();
    });
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) {
        focused = false;
        schedule();
      }
    });

    document.addEventListener("visibilitychange", function () {
      pageHidden = document.hidden;
      schedule();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.2 }).observe(root);
    } else {
      visible = true;
      schedule();
    }

    updateButton();
    activate(current, false);
  });
})();

/* 09. IMAGE LIGHTBOX ----------------------------------------------------- */
(function () {
  var dialog = document.querySelector("[data-image-dialog]");
  if (!dialog || typeof dialog.showModal !== "function") return;

  var target = dialog.querySelector("[data-image-target]");
  var close = dialog.querySelector("[data-image-close]");
  var triggers = document.querySelectorAll("[data-lightbox]");
  if (!target || !triggers.length) return;

  var lastFocus = null;

  Array.prototype.forEach.call(triggers, function (link) {
    link.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      var href = link.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      lastFocus = link;
      target.src = href;
      target.alt = link.getAttribute("data-title") || link.getAttribute("aria-label") || "";
      dialog.showModal();
    });
  });

  function closeDialog() {
    dialog.close();
  }

  if (close) close.addEventListener("click", closeDialog);

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("close", function () {
    target.removeAttribute("src");
    target.alt = "";
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  });
})();
