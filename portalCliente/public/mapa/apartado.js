document.addEventListener('DOMContentLoaded', function () {

  // ── Params de URL ──────────────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  if (params.get('lote'))   document.getElementById('lote-nombre').textContent = params.get('lote');
  if (params.get('estado')) document.getElementById('lote-estado').textContent = params.get('estado');

  // ── Vendedor selector ────────────────────────────────────
  var vendedorSelect   = document.getElementById('vendedor-select');
  var vendedorInputWrap = document.getElementById('vendedor-input-wrap');
  var vendedorInput    = document.getElementById('vendedor-input');

  vendedorSelect.addEventListener('change', function () {
    if (vendedorSelect.value === '__otro__') {
      vendedorInputWrap.classList.add('visible');
      vendedorInput.focus();
    } else {
      vendedorInputWrap.classList.remove('visible');
      vendedorInput.value = '';
    }
  });

  function getVendedorFinal() {
    if (!vendedorSelect) return '';
    if (vendedorSelect.value === '__otro__') return vendedorInput.value.trim();
    return vendedorSelect.value;
  }

  // ── Checkbox ───────────────────────────────────────────────────────
  var checked = false;
  document.getElementById('check-row').addEventListener('click', function () {
    checked = !checked;
    document.getElementById('checkBox').classList.toggle('checked', checked);
    document.getElementById('checkIcon').style.display = checked ? 'inline-block' : 'none';
    document.getElementById('btn-continuar').disabled = !checked;
  });

  // ── Paso 1 → 2 ────────────────────────────────────────────────────
  document.getElementById('btn-continuar').addEventListener('click', function () {
    document.getElementById('screen-solicitud').classList.remove('visible');
    document.getElementById('screen-pago').classList.add('visible');
    var s1 = document.getElementById('step1');
    s1.classList.remove('active');
    s1.classList.add('done');
    s1.querySelector('.step-dot').innerHTML = '<iconify-icon icon="solar:check-linear" width="12" height="12"></iconify-icon>';
    document.getElementById('step2').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btn-cancelar').addEventListener('click', function () {
    window.location.href = 'index.html';
  });

  document.getElementById('btn-volver').addEventListener('click', function () {
    document.getElementById('screen-pago').classList.remove('visible');
    document.getElementById('screen-solicitud').classList.add('visible');
    var s1 = document.getElementById('step1');
    s1.classList.add('active');
    s1.classList.remove('done');
    s1.querySelector('.step-dot').textContent = '1';
    document.getElementById('step2').classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── Tabs de pago ───────────────────────────────────────────────────
  document.querySelectorAll('.pay-tab[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.pay-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.pay-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ── Copiar ─────────────────────────────────────────────────────────
  document.querySelectorAll('[data-copiar]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = document.getElementById(btn.dataset.copiar).textContent.trim();
      navigator.clipboard.writeText(text).catch(function(){});
      var orig = btn.textContent;
      btn.textContent = '✓ Copiado';
      setTimeout(function () { btn.textContent = orig; }, 1800);
      showToast('Copiado al portapapeles');
    });
  });

  function showToast(msg) {
    var t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  // ── Pagar → pagado.html (sin validación) ──────────────────────────
  document.querySelectorAll('[data-pagar]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.innerHTML = '<iconify-icon icon="solar:loading-line-duotone" width="18" height="18" style="animation:spin 1s linear infinite"></iconify-icon> Procesando...';
      var style = document.createElement('style');
      style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
      setTimeout(function () {
        var p = new URLSearchParams();
        p.set('metodo', btn.dataset.pagar);
        if (params.get('lote')) p.set('lote', params.get('lote'));
        var vendedor = getVendedorFinal();
        if (vendedor) p.set('vendedor', vendedor);
        window.location.href = 'pagado.html?' + p.toString();
      }, 1400);
    });
  });

  // ── Contador 24h ───────────────────────────────────────────────────
  var TIMER_KEY = 'apartado_deadline';
  var deadline  = sessionStorage.getItem(TIMER_KEY);
  if (!deadline) {
    deadline = Date.now() + 24 * 60 * 60 * 1000;
    sessionStorage.setItem(TIMER_KEY, deadline);
  } else {
    deadline = parseInt(deadline);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var remaining = deadline - Date.now();
    var bar     = document.getElementById('timerBar');
    var expired = document.getElementById('timerExpired');
    if (remaining <= 0) {
      bar.style.display = 'none';
      expired.style.display = 'flex';
      document.querySelectorAll('[data-pagar]').forEach(function (b) {
        b.disabled = true; b.style.opacity = '0.5';
      });
      return;
    }
    var hh = Math.floor(remaining / 3600000);
    var mm = Math.floor((remaining % 3600000) / 60000);
    var ss = Math.floor((remaining % 60000) / 1000);
    document.getElementById('t-hh').textContent = pad(hh);
    document.getElementById('t-mm').textContent = pad(mm);
    document.getElementById('t-ss').textContent = pad(ss);
    if (remaining < 60 * 60 * 1000) bar.classList.add('urgent');
    setTimeout(tick, 1000);
  }

  tick();

});
