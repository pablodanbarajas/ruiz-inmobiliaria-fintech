/* =========================================================
   apartado.js ÔÇö Flujo de reserva de lote con Quentli
   ========================================================= */

const SUPABASE_URL = 'https://ivbyroqxyfclzfhaixjd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ynlyb3F4eWZjbHpmaGFpeGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjMxOTksImV4cCI6MjA4ODI5OTE5OX0.804JjH0MBZqfjvKLMkXmjlwXNkt7hUiiK1vFA2Zv0LI';

function getAccessToken() {
  try {
    var raw = localStorage.getItem('sb-' + SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return parsed && parsed.access_token ? parsed.access_token : null;
  } catch (_) { return null; }
}

document.addEventListener('DOMContentLoaded', function () {

  // ÔöÇÔöÇ Params de URL ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  var params       = new URLSearchParams(window.location.search);
  var loteNombre   = params.get('lote')         || '';
  var loteid       = params.get('loteid')       || '';
  var desarrolloid = params.get('desarrolloid') || '11';
  var manzana      = params.get('manzana')      || '';

  // Texto descriptivo del lote en el pill
  var loteDisplay = (loteNombre ? 'Lote ' + loteNombre : '') + (manzana ? ' ┬À Mza ' + manzana : '');
  var nombreEl = document.getElementById('lote-nombre');
  if (nombreEl) nombreEl.textContent = loteDisplay || 'Lote seleccionado';

  // Redirigir si no hay sesi├│n
  if (!getAccessToken()) {
    window.location.href = '/portal/login?redirect=/portal/desarrollos/' + desarrolloid + '/mapa';
    return;
  }

  // Redirigir si no hay loteid (lleg├│ sin pasar por el mapa)
  if (!loteid) {
    window.location.href = '/portal/mapa/index.html?desarrolloid=' + desarrolloid;
    return;
  }

  // ÔöÇÔöÇ Checkbox ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  var checked = false;
  document.getElementById('check-row').addEventListener('click', function () {
    checked = !checked;
    document.getElementById('checkBox').classList.toggle('checked', checked);
    document.getElementById('checkIcon').style.display = checked ? 'inline-block' : 'none';
    document.getElementById('btn-continuar').disabled = !checked;
  });

  // ÔöÇÔöÇ Cancelar ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  document.getElementById('btn-cancelar').addEventListener('click', function () {
    history.back();
  });

  // ÔöÇÔöÇ Continuar al pago ÔåÆ llama create-reservation y redirige a Quentli ÔöÇÔöÇ
  document.getElementById('btn-continuar').addEventListener('click', function () {
    var btn = document.getElementById('btn-continuar');
    btn.disabled = true;
    var spinStyle = document.createElement('style');
    spinStyle.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(spinStyle);
    btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;">' +
      '<svg style="animation:spin 1s linear infinite;flex-shrink:0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>' +
      'Preparando pago seguro...</span>';

    var accessToken = getAccessToken();
    if (!accessToken) {
      window.location.href = '/portal/login?redirect=/portal/desarrollos/' + desarrolloid + '/mapa';
      return;
    }

    fetch(SUPABASE_URL + '/functions/v1/create-reservation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken,
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({
        loteid: Number(loteid),
        desarrolloid: Number(desarrolloid),
        vendedor: getVendedorFinal(),
      }),
    })
    .then(function (res) { return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function (result) {
      if (!result.ok || !result.data.url) {
        throw new Error(result.data.error || 'Error al generar el link de pago');
      }
      sessionStorage.setItem('apartado_ventaid', String(result.data.ventaid));
      window.location.href = result.data.url;
    })
    .catch(function (err) {
      btn.disabled = false;
      btn.innerHTML = 'Continuar al pago';
      showToast('Error: ' + err.message);
    });
  });

  // ÔöÇÔöÇ Toast ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  function showToast(msg) {
    var t = document.getElementById('toast');
    var msgEl = document.getElementById('toast-msg');
    if (!t || !msgEl) { alert(msg); return; }
    msgEl.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  // ÔöÇÔöÇ Bot├│n volver (pantalla 2) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  var btnVolver = document.getElementById('btn-volver');
  if (btnVolver) {
    btnVolver.addEventListener('click', function () { history.back(); });
  }

  // ÔöÇÔöÇ Contador 24h (visual) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  var TIMER_KEY = 'apartado_deadline';
  var deadline  = sessionStorage.getItem(TIMER_KEY);
  if (!deadline) {
    deadline = Date.now() + 24 * 60 * 60 * 1000;
    sessionStorage.setItem(TIMER_KEY, String(deadline));
  } else {
    deadline = parseInt(deadline);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    var remaining = deadline - Date.now();
    var bar     = document.getElementById('timerBar');
    var expired = document.getElementById('timerExpired');
    if (!bar) return;
    if (remaining <= 0) {
      bar.style.display = 'none';
      if (expired) expired.style.display = 'flex';
      return;
    }
    var hh = Math.floor(remaining / 3600000);
    var mm = Math.floor((remaining % 3600000) / 60000);
    var ss = Math.floor((remaining % 60000) / 1000);
    var hhEl = document.getElementById('t-hh');
    var mmEl = document.getElementById('t-mm');
    var ssEl = document.getElementById('t-ss');
    if (hhEl) hhEl.textContent = pad(hh);
    if (mmEl) mmEl.textContent = pad(mm);
    if (ssEl) ssEl.textContent = pad(ss);
    if (remaining < 60 * 60 * 1000) bar.classList.add('urgent');
    setTimeout(tick, 1000);
  }

  tick();

});

