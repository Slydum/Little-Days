(function () {
  "use strict";
  var KEY = "little-days-save-v2";
  var root = document.documentElement;
  var style = document.createElement("style");
  style.id = "little-days-quiet-boot-style";
  style.textContent = "html.little-days-resuming #app .setup-screen{visibility:hidden!important;opacity:0!important}";
  document.head.appendChild(style);

  try {
    var state = JSON.parse(localStorage.getItem(KEY));
    if (state && state.version === 2 && state.character && state.household && !state.introPending) {
      root.classList.add("little-days-resuming");
    }
  } catch (_) {}

  function finish() {
    if (!document.querySelector("#app .screen")) return false;
    root.classList.remove("little-days-resuming");
    style.remove();
    return true;
  }

  if (!finish()) {
    var observer = new MutationObserver(function () {
      if (finish()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
      root.classList.remove("little-days-resuming");
      style.remove();
      observer.disconnect();
    }, 5000);
  }
})();
