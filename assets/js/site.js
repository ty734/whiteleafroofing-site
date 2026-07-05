// White Leaf Roofing — shared site JS (kept intentionally tiny)
(function () {
  // Stamp form start time for the /api/lead spam time-trap,
  // and record the page the lead came from.
  document.querySelectorAll('form[data-lead]').forEach(function (form) {
    var t = form.querySelector('input[name="t"]');
    if (t) t.value = String(Date.now());
    var page = form.querySelector('input[name="page"]');
    if (page) page.value = location.pathname;
  });
})();
