"use strict";
document.documentElement.classList.add("js");

/* ---------- Apparition au défilement ---------- */
(function () {
  var items = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }
  var obs = new IntersectionObserver(function (entries, o) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); o.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach(function (el) { obs.observe(el); });
})();

/* ---------- Année du pied de page ---------- */
(function () {
  var y = document.getElementById("annee");
  if (y) y.textContent = new Date().getFullYear();
})();

/* ---------- Menu mobile ---------- */
(function () {
  var btn = document.querySelector(".nav-toggle");
  var menu = document.getElementById("menu");
  if (!btn || !menu) return;
  function set(open) {
    menu.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function () { set(!menu.classList.contains("is-open")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  menu.addEventListener("click", function (e) { if (e.target.tagName === "A") set(false); });
})();

/* ---------- Utilitaires de formulaire ---------- */
function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach(function (p) { p.hidden = true; p.textContent = ""; });
  form.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
  var st = form.querySelector(".form-status");
  if (st) { st.className = "form-status"; st.textContent = ""; }
}

function showStatus(form, text, kind) {
  var st = form.querySelector(".form-status");
  if (!st) return;
  st.className = "form-status alert alert-" + kind;
  st.textContent = text;
  st.focus();
}

function showFieldErrors(form, errors) {
  var first = null;
  Object.keys(errors || {}).forEach(function (name) {
    var p = document.getElementById("err-" + name);
    if (p) { p.textContent = errors[name]; p.hidden = false; }
    var input = form.querySelector('[name="' + name + '"]');
    if (input && input.type !== "hidden") {
      input.setAttribute("aria-invalid", "true");
      if (!first) first = input;
    }
  });
  if (first) first.focus();
}

function postForm(form) {
  return fetch(form.action, {
    method: "POST",
    body: new FormData(form),
    headers: { "X-Requested-With": "fetch", "Accept": "application/json" },
    credentials: "same-origin"
  }).then(function (r) {
    return r.json().catch(function () { return { ok: false, message: "Réponse inattendue du serveur." }; })
      .then(function (data) { data.status = r.status; return data; });
  });
}

function bindAjax(form, onSuccess) {
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    clearErrors(form);
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    postForm(form).then(function (data) {
      if (data.ok) { onSuccess(data); return; }
      if (data.errors) showFieldErrors(form, data.errors);
      showStatus(form, data.message || "Une erreur est survenue.", "error");
    }).catch(function () {
      showStatus(form, "Connexion impossible. Vérifiez votre réseau puis réessayez, ou appelez-moi.", "error");
    }).then(function () { if (btn) btn.disabled = false; });
  });
}

/* ---------- Formulaire de contact ---------- */
(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  var motif = document.getElementById("motif");
  var serviceField = document.getElementById("service-field");
  function syncService() { serviceField.hidden = motif.value !== "prestation"; }
  motif.addEventListener("change", syncService);
  syncService();
  bindAjax(form, function (data) {
    var ok = document.createElement("div");
    ok.className = "alert alert-success";
    ok.setAttribute("role", "status");
    ok.tabIndex = -1;
    var strong = document.createElement("strong");
    strong.textContent = "Demande enregistrée. ";
    ok.appendChild(strong);
    ok.appendChild(document.createTextNode(data.message));
    form.replaceWith(ok);
    ok.focus();
  });
})();

/* ---------- Annulation de rendez-vous ---------- */
(function () {
  var form = document.getElementById("cancel-form");
  if (!form) return;
  bindAjax(form, function (data) {
    showStatus(form, data.message, "success");
    form.reset();
  });
})();

/* ---------- Prise de rendez-vous ---------- */
(function () {
  var form = document.getElementById("rdv-form");
  if (!form) return;
  var dateInput = document.getElementById("rdv-date");
  var timeInput = document.getElementById("rdv-time");
  var slotBox = document.getElementById("slot-box");
  var slotList = document.getElementById("slot-list");
  var details = document.getElementById("details");
  var dayList = document.getElementById("day-list");
  var slotErr = document.getElementById("err-slot");
  var token = 0;

  function setPressed(container, btn) {
    container.querySelectorAll(".pick").forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
  }
  function message(text) {
    slotList.textContent = "";
    var p = document.createElement("p");
    p.className = "hint";
    p.textContent = text;
    slotList.appendChild(p);
  }

  function loadSlots(date, btn) {
    var my = ++token;
    setPressed(dayList, btn);
    dateInput.value = date;
    timeInput.value = "";
    details.hidden = true;
    slotBox.hidden = false;
    slotErr.hidden = true;
    message("Chargement des créneaux…");
    fetch("/api/slots?date=" + encodeURIComponent(date), { headers: { "Accept": "application/json" }, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (my !== token) return;
        if (!data.ok) { message(data.message || "Impossible de charger les créneaux."); return; }
        if (!data.slots.length) { message("Plus aucun créneau libre ce jour-là. Choisissez un autre jour."); return; }
        slotList.textContent = "";
        data.slots.forEach(function (t) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "pick";
          b.textContent = t;
          b.setAttribute("aria-pressed", "false");
          b.addEventListener("click", function () {
            setPressed(slotList, b);
            timeInput.value = t;
            details.hidden = false;
            slotErr.hidden = true;
          });
          slotList.appendChild(b);
        });
      })
      .catch(function () { if (my === token) message("Connexion impossible. Réessayez."); });
  }

  dayList.querySelectorAll(".pick").forEach(function (b) {
    b.addEventListener("click", function () { loadSlots(b.getAttribute("data-date"), b); });
  });

  bindAjax(form, function (data) {
    var box = document.getElementById("rdv-success");
    box.textContent = "";
    var h = document.createElement("p");
    var s = document.createElement("strong");
    s.textContent = data.message;
    h.appendChild(s);
    var when = document.createElement("p");
    when.textContent = "Créneau : " + data.when + " (" + data.timezone + ").";
    var code = document.createElement("p");
    code.appendChild(document.createTextNode("Code d'annulation (à conserver) : "));
    var c = document.createElement("code");
    c.textContent = data.code;
    code.appendChild(c);
    box.appendChild(h); box.appendChild(when); box.appendChild(code);
    form.hidden = true;
    box.hidden = false;
    box.focus();
  });

  // Si le créneau est pris entre-temps, recharger la liste du jour choisi.
  form.addEventListener("submit", function () {
    form.dataset.lastDate = dateInput.value;
  });
  var observer = new MutationObserver(function () {
    var st = form.querySelector(".form-status");
    if (st && /réservé par quelqu'un d'autre/.test(st.textContent) && form.dataset.lastDate) {
      var btn = dayList.querySelector('[data-date="' + form.dataset.lastDate + '"]');
      if (btn) loadSlots(form.dataset.lastDate, btn);
    }
  });
  observer.observe(form, { childList: true, subtree: true, characterData: true });
})();


/* ===== Agrandissement des captures EDUCORE ===== */
(function () {
  "use strict";
  var gallery = document.getElementById("educore-gallery");
  var overlay = document.getElementById("educore-lightbox");
  var enlarged = document.getElementById("educore-lightbox-image");
  var caption = document.getElementById("educore-lightbox-caption");
  if (!gallery || !overlay || !enlarged || !caption) return;

  var closeButton = overlay.querySelector(".educore-lightbox-close");
  var lastTrigger = null;

  function closeImage() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    enlarged.src = "";
    enlarged.alt = "";
    caption.textContent = "";
    document.body.classList.remove("educore-lightbox-open");
    if (lastTrigger) lastTrigger.focus();
  }

  gallery.addEventListener("click", function (event) {
    var button = event.target.closest(".educore-gallery-item");
    if (!button) return;
    lastTrigger = button;
    enlarged.src = button.getAttribute("data-full-image");
    enlarged.alt = button.getAttribute("data-image-alt") || "";
    caption.textContent = enlarged.alt;
    overlay.hidden = false;
    document.body.classList.add("educore-lightbox-open");
    closeButton.focus();
  });

  closeButton.addEventListener("click", closeImage);
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeImage();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeImage();
  });
})();
