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

  // Video testimonials: click-to-play facade. The YouTube iframe only
  // loads after a click, so the page stays fast.
  document.querySelectorAll('.video-thumb[data-video]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + btn.dataset.video + '?autoplay=1&rel=0';
      iframe.title = btn.getAttribute('aria-label') || 'Customer video review';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      btn.replaceWith(iframe);
    });
  });
})();
