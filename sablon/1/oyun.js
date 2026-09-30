/*
 * ŞABLON — en küçük eksiksiz Lisem oyunu. `npm run yeni -- <ad> "Ad"`
 * bunu kopyalar. Beş şeyi gösterir, gerisini sil:
 *
 *   1. LisemOyun.tuval()        — tuval + iki eksene göre ölçek (tasarım 800 × 450)
 *   2. LisemOyun.renk()         — renkler /marka/1/marka.css'ten
 *   3. LisemOyun.yaziTipleri()  — yazı tipleri gelince…
 *   4. LisemOyun.hazir()        — …sayfaya "hazır" (ZORUNLU)
 *   5. LisemOyun.skor(n)        — el bitince
 *
 * Depolama yok (localStorage/çerez kısıtlı çerçevede hata fırlatır), dış
 * adres yok, satır içi betik yok. Ayrıntı: CLAUDE.md.
 */
(function () {
  'use strict';

  var L = window.LisemOyun;
  var SURE = 20;

  var R = {
    zemin: L.renk('--page-bg'),
    metin: L.renk('--color-text'),
    soluk: L.renk('--color-neutral-600'),
    yildiz: L.renk('--p-amber'),
    kenar: L.renk('--i-amber'),
    vurgu: L.renk('--color-accent-700'),
  };

  var dW = 800;
  var dH = 450;
  var tuval = L.tuval(document.getElementById('oyun'), { genislik: 800, yukseklik: 450 }, function (o) {
    dW = o.dunyaW;
    dH = o.dunyaH;
  });
  var ctx = tuval.ctx;

  var durum = 'baslik'; // baslik | oynuyor | bitti
  var skor = 0;
  var kalan = SURE;
  var yildiz = { x: 400, y: 225, r: 34 };

  function yerlestir() {
    yildiz.x = 60 + Math.random() * (dW - 120);
    yildiz.y = 90 + Math.random() * (dH - 150);
  }

  function dokun(x, y) {
    if (durum === 'baslik' || durum === 'bitti') {
      durum = 'oynuyor';
      skor = 0;
      kalan = SURE;
      yerlestir();
      return;
    }
    var dx = x - yildiz.x;
    var dy = y - yildiz.y;
    if (dx * dx + dy * dy <= yildiz.r * yildiz.r * 1.4) {
      skor += 1;
      yerlestir();
    }
  }

  document.getElementById('oyun').addEventListener('pointerdown', function (olay) {
    var p = tuval.dunyaya(olay.clientX, olay.clientY);
    dokun(p.x, p.y);
  });
  window.addEventListener('keydown', function (olay) {
    if (olay.key === ' ' && durum !== 'oynuyor') dokun(0, 0);
  });

  function yazi(metin, x, y, boy, baslik, renk) {
    ctx.font = (baslik ? '800 ' : '600 ') + boy + 'px ' + (baslik ? '"Baloo 2"' : '"Inter"') + ', system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = renk || R.metin;
    ctx.fillText(metin, x, y);
  }

  function ciz() {
    tuval.sifirla();
    ctx.fillStyle = R.zemin;
    ctx.fillRect(0, 0, dW, dH);
    if (durum === 'oynuyor') {
      ctx.fillStyle = R.yildiz;
      ctx.strokeStyle = R.kenar;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + (i * Math.PI) / 5;
        var r = i % 2 ? yildiz.r * 0.45 : yildiz.r;
        ctx.lineTo(yildiz.x + Math.cos(a) * r, yildiz.y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      yazi(String(skor), dW / 2, 64, 48, true);
      yazi(Math.ceil(kalan) + ' sn', dW / 2, 94, 16, false, R.soluk);
    } else if (durum === 'baslik') {
      yazi('Yıldız Yakala', dW / 2, dH / 2 - 10, 56, true);
      yazi('Başlamak için dokun', dW / 2, dH / 2 + 30, 18, false, R.vurgu);
    } else {
      yazi('Skor: ' + skor, dW / 2, dH / 2 - 10, 56, true);
      yazi('Tekrar için dokun', dW / 2, dH / 2 + 30, 18, false, R.vurgu);
    }
  }

  var once = performance.now();
  function dongu(simdi) {
    var dt = Math.min(0.1, (simdi - once) / 1000);
    once = simdi;
    if (durum === 'oynuyor') {
      kalan -= dt;
      if (kalan <= 0) {
        durum = 'bitti';
        L.skor(skor); // 5. el bitti
      }
    }
    ciz();
    requestAnimationFrame(dongu);
  }
  requestAnimationFrame(dongu);

  L.yaziTipleri().then(function () {
    L.hazir(); // 4. ZORUNLU — gelmezse sayfa 20 sn sonra "Oyun yüklenemedi" der
  });
})();
