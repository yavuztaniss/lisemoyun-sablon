/*
 * Yerel önizleme — lisem.com.tr'deki oynatıcının (lisem-web ›
 * components/oyun/game-player.tsx) davranışını taklit eder:
 *   • çerçeve `sandbox="allow-scripts"`, `allow="fullscreen; autoplay; gamepad"`
 *   • mesajın göndereni `event.source` ile doğrulanır (köken "null" gelir)
 *   • yalnızca iki mesaj tanınır; skor 0…1e9 arası TAM sayı olmalı
 *   • "hazır" 20 sn içinde gelmezse "Oyun yüklenemedi"
 *   • çerçeve yüklenince odak ona verilir (ilk tuş boşa gitmesin)
 */
(function () {
  'use strict';

  var HAZIR = 'lisem-oyun:hazir';
  var SKOR = 'lisem-oyun:skor';
  var SURE_MS = 20000;
  var SKOR_TAVANI = 1000000000;

  var secim = document.getElementById('oyun');
  var sahne = document.getElementById('sahne');
  var hazirEl = document.getElementById('hazir');
  var skorEl = document.getElementById('skor');
  var enIyiEl = document.getElementById('en-iyi');
  var kaydirmaEl = document.getElementById('kaydirma');
  var gunluk = document.getElementById('gunluk');

  var oyunlar = [];
  var cerceve = null;
  var zamanlayici = 0;
  var baslangic = 0;
  var enIyi = null;
  var sahneTuru = 'masaustu';

  function durum(el, metin, tur) {
    el.textContent = metin;
    if (tur) el.dataset.durum = tur;
    else delete el.dataset.durum;
  }

  function yaz(metin, tur) {
    var li = document.createElement('li');
    var sn = ((performance.now() - baslangic) / 1000).toFixed(1);
    li.textContent = sn + ' sn · ' + metin;
    if (tur) li.dataset.tur = tur;
    gunluk.prepend(li);
  }

  function coz(veri) {
    if (!veri || typeof veri !== 'object') return null;
    if (veri.tur === HAZIR) return { tur: HAZIR };
    if (
      veri.tur === SKOR &&
      typeof veri.skor === 'number' &&
      Number.isInteger(veri.skor) &&
      veri.skor >= 0 &&
      veri.skor <= SKOR_TAVANI
    ) {
      return { tur: SKOR, skor: veri.skor };
    }
    return null;
  }

  function secili() {
    return oyunlar[Number(secim.value)] || oyunlar[0];
  }

  function baslat() {
    var oyun = secili();
    if (!oyun) return;
    clearTimeout(zamanlayici);
    sahne.textContent = '';
    sahne.dataset.yon = oyun.yon;
    sahne.dataset.sahne = sahneTuru;
    gunluk.textContent = '';
    durum(hazirEl, 'bekleniyor…', 'bekliyor');
    durum(skorEl, '—');
    durum(kaydirmaEl, 'yok', 'tamam');
    window.scrollTo(0, 0);
    baslangic = performance.now();

    cerceve = document.createElement('iframe');
    cerceve.setAttribute('sandbox', 'allow-scripts');
    cerceve.setAttribute('allow', 'fullscreen; autoplay; gamepad');
    cerceve.setAttribute('title', oyun.baslik);
    cerceve.addEventListener('load', function () {
      yaz('çerçeve yüklendi');
      cerceve.focus();
    });
    cerceve.src = oyun.adres;
    sahne.appendChild(cerceve);

    var perde = document.createElement('div');
    perde.className = 'perde';
    perde.textContent = 'Yükleniyor…';
    sahne.appendChild(perde);

    zamanlayici = setTimeout(function () {
      perde.textContent = 'Oyun yüklenemedi — 20 sn içinde “hazır” gelmedi. (lisem.com.tr bunu ziyaretçiye de söyler.)';
      durum(hazirEl, 'GELMEDİ (20 sn)', 'hata');
      yaz('hazır mesajı 20 sn içinde gelmedi', 'hata');
    }, SURE_MS);

    location.hash = oyun.ad + '/' + oyun.surum;
  }

  window.addEventListener('message', function (olay) {
    if (!cerceve || olay.source !== cerceve.contentWindow) return;
    var mesaj = coz(olay.data);
    if (!mesaj) {
      yaz('TANINMADI: ' + JSON.stringify(olay.data), 'hata');
      return;
    }
    if (mesaj.tur === HAZIR) {
      clearTimeout(zamanlayici);
      var perde = sahne.querySelector('.perde');
      if (perde) perde.hidden = true;
      var sn = ((performance.now() - baslangic) / 1000).toFixed(1);
      durum(hazirEl, 'geldi (' + sn + ' sn)', 'tamam');
      yaz('hazır');
      cerceve.focus();
    } else {
      durum(skorEl, String(mesaj.skor));
      if (enIyi === null || mesaj.skor > enIyi) enIyi = mesaj.skor;
      durum(enIyiEl, String(enIyi));
      yaz('skor ' + mesaj.skor);
    }
  });

  // Oyun odaktayken sayfa kaydıysa: büyük olasılıkla bir tuşta
  // preventDefault eksik (fare tekerleğiyle kaydırmak normaldir).
  window.addEventListener('scroll', function () {
    if (document.activeElement === cerceve && window.scrollY > 0) {
      durum(kaydirmaEl, 'kaydı (' + Math.round(window.scrollY) + ' px) — tuş mu, tekerlek mi?', 'bekliyor');
    }
  });

  document.querySelectorAll('[data-sahne]').forEach(function (dugme) {
    dugme.addEventListener('click', function () {
      sahneTuru = dugme.dataset.sahne;
      document.querySelectorAll('[data-sahne]').forEach(function (d) {
        d.setAttribute('aria-pressed', String(d === dugme));
      });
      baslat();
    });
  });

  document.getElementById('yeniden').addEventListener('click', baslat);
  document.getElementById('tam-ekran').addEventListener('click', function () {
    if (sahne.requestFullscreen) {
      sahne.requestFullscreen().catch(function (hata) {
        yaz('tam ekran açılamadı: ' + hata.message, 'hata');
      });
    }
  });
  secim.addEventListener('change', function () {
    enIyi = null;
    durum(enIyiEl, '—');
    baslat();
  });

  fetch('/oyunlar.json')
    .then(function (yanit) { return yanit.json(); })
    .then(function (liste) {
      oyunlar = liste;
      liste.forEach(function (oyun, i) {
        var secenek = document.createElement('option');
        secenek.value = String(i);
        secenek.textContent = oyun.baslik + ' · ' + oyun.ad + '/' + oyun.surum + '/';
        secim.appendChild(secenek);
      });
      var istenen = location.hash.slice(1);
      var bulunan = liste.findIndex(function (o) { return o.ad + '/' + o.surum === istenen; });
      if (bulunan >= 0) secim.value = String(bulunan);
      document.querySelector('[data-sahne="masaustu"]').setAttribute('aria-pressed', 'true');
      baslat();
    })
    .catch(function (hata) {
      yaz('oyun listesi okunamadı: ' + hata.message, 'hata');
    });
})();
