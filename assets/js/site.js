// White Leaf Roofing — shared site JS (kept intentionally tiny)
(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Stamp form start time for the /api/lead spam time-trap, record the source page,
  // and validate real contact info client-side before submit (server re-checks too).
  document.querySelectorAll('form[data-lead]').forEach(function (form) {
    var t = form.querySelector('input[name="t"]');
    if (t) t.value = String(Date.now());
    var page = form.querySelector('input[name="page"]');
    if (page) page.value = location.pathname;

    var err = form.querySelector('.form-error');
    function fail(msg) {
      if (err) { err.textContent = msg; err.hidden = false; }
      return false;
    }
    form.addEventListener('submit', function (e) {
      if (err) err.hidden = true;
      var name = (form.querySelector('[name="name"]') || {}).value || '';
      var phone = (form.querySelector('[name="phone"]') || {}).value || '';
      var email = (form.querySelector('[name="email"]') || {}).value || '';
      var digits = (phone + ' ' + email).replace(/\D/g, '');
      var phoneOk = digits.length >= 10 && digits.length <= 15;
      var emailOk = EMAIL_RE.test(email.trim()) || EMAIL_RE.test(phone.trim());
      if (!name.trim()) { e.preventDefault(); return fail('Please enter your name.'); }
      if (!phoneOk && !emailOk) {
        e.preventDefault();
        return fail('Please enter a valid phone number (at least 10 digits) or email address so Andy can reach you.');
      }
    });
  });

  // Show a friendly error if the server bounced a submission back.
  var box = document.querySelector('.form-error');
  if (box && /[?&]error=1\b/.test(location.search)) {
    box.textContent = 'Please enter your name and a valid phone number or email so Andy can reach you.';
    box.hidden = false;
  }
  if (box && /[?&]error=verify\b/.test(location.search)) {
    box.textContent = 'Please complete the "I am human" check just above the button, then submit again.';
    box.hidden = false;
  }

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
