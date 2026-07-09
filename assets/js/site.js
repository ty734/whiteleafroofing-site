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
      // Enhanced conversions: stash contact info for the thank-you page to pass
      // to Google (hashed by gtag) so iOS-blocked conversions still get matched.
      try {
        sessionStorage.setItem('wlr_ec', JSON.stringify({
          em: email.trim().toLowerCase(),
          ph: phone.replace(/\D/g, '')
        }));
      } catch (err2) { /* non-essential */ }
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

  // --- Google Ads attribution ---
  // Persist click ids + UTMs across the session (first-touch wins) and pass them
  // through every lead form as hidden fields so each emailed lead says which
  // campaign/keyword produced it. api/lead.js forwards these in the email.
  var ATTR_KEYS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  try {
    var stored = JSON.parse(sessionStorage.getItem('wlr_attr') || '{}');
    var qs = new URLSearchParams(location.search);
    var sawNew = false;
    ATTR_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v && !stored[k]) { stored[k] = v.slice(0, 200); sawNew = true; }
    });
    if (!stored.landing) { stored.landing = location.pathname; sawNew = true; }
    if (!stored.referrer && document.referrer && document.referrer.indexOf(location.host) === -1) {
      stored.referrer = document.referrer.slice(0, 200); sawNew = true;
    }
    if (sawNew) sessionStorage.setItem('wlr_attr', JSON.stringify(stored));
    document.querySelectorAll('form[data-lead]').forEach(function (form) {
      Object.keys(stored).forEach(function (k) {
        if (form.querySelector('input[name="' + k + '"]')) return;
        var inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = k; inp.value = stored[k];
        form.appendChild(inp);
      });
    });
  } catch (e) { /* sessionStorage blocked: lose attribution, never the lead */ }

  // --- Google Ads website-call tracking (replaces CallRail) ---
  // Visitors arriving from a Google ad get a Google forwarding number swapped in
  // (display text + tel: links), so calls of 60s+ count as conversions in Google
  // Ads. Everyone else keeps seeing Andy's real number.
  if (typeof gtag === 'function') {
    gtag('config', 'AW-11135708302/aRzrCJzZms0cEI7Z9b0p', {
      phone_conversion_number: '480-363-2898',
      phone_conversion_callback: function (formatted, mobile) {
        if (!formatted) return;
        var telHref = 'tel:' + String(mobile || formatted).replace(/[^\d+]/g, '');
        document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
          a.href = telHref;
          if (/\d{3}\D{0,2}\d{3}\D{0,2}\d{4}/.test(a.textContent)) a.textContent = formatted;
        });
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        var n, re = /480[\s.\-·]?363[\s.\-·]?2898/;
        while ((n = walker.nextNode())) { if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, formatted); }
      }
    });
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
