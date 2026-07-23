(function () {
  "use strict";

  if (window.showConfirmDialog) return;

  let overlay = null;
  let titleEl = null;
  let messageEl = null;
  let cancelBtn = null;
  let confirmBtn = null;
  let activeResolver = null;
  let lastFocusedEl = null;

  function closeDialog(result) {
    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("loading-active");

    const resolver = activeResolver;
    activeResolver = null;

    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") {
      lastFocusedEl.focus();
    }

    if (resolver) resolver(result);
  }

  function ensureDialog() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML =
      '<div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmDialogTitle" aria-describedby="confirmDialogMessage">' +
      '<h3 id="confirmDialogTitle" class="confirm-dialog-title">Konfirmasi Hapus</h3>' +
      '<p id="confirmDialogMessage" class="confirm-dialog-message">Apakah Anda yakin ingin menghapus data ini?</p>' +
      '<div class="confirm-dialog-actions">' +
      '<button type="button" class="confirm-dialog-btn confirm-dialog-btn-secondary" data-confirm-action="cancel">Batal</button>' +
      '<button type="button" class="confirm-dialog-btn confirm-dialog-btn-danger" data-confirm-action="confirm">Hapus</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(overlay);

    titleEl = overlay.querySelector("#confirmDialogTitle");
    messageEl = overlay.querySelector("#confirmDialogMessage");
    cancelBtn = overlay.querySelector('[data-confirm-action="cancel"]');
    confirmBtn = overlay.querySelector('[data-confirm-action="confirm"]');

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeDialog(false);
    });

    cancelBtn.addEventListener("click", function () {
      closeDialog(false);
    });

    confirmBtn.addEventListener("click", function () {
      closeDialog(true);
    });

    document.addEventListener("keydown", function (event) {
      if (!overlay || overlay.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog(false);
      }
    });
  }

  window.showConfirmDialog = function (options) {
    ensureDialog();

    options = options || {};
    titleEl.textContent = options.title || "Konfirmasi Hapus";
    messageEl.textContent = options.message || "Apakah Anda yakin ingin menghapus data ini?";
    cancelBtn.textContent = options.cancelText || "Batal";
    confirmBtn.textContent = options.confirmText || "Hapus";

    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("loading-active");

    return new Promise(function (resolve) {
      activeResolver = resolve;
      confirmBtn.focus();
    });
  };
})();
