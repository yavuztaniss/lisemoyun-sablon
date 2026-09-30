/*
 * LİSEM OYUN SDK — sürüm 1.
 *
 * Bir oyunun lisem.com.tr'de oynanabilmesi için sayfayla konuşması gereken
 * HER ŞEY bu dosyada. Oyun onu MUTLAK yoldan, kendi betiğinden ÖNCE bağlar:
 *
 *   <script src="/sdk/1/lisem-oyun.js"></script>
 *   <script src="oyun.js"></script>
 *
 * Sürüm klasörü DEĞİŞMEZ (kilit.json). Davranış değişecekse `/sdk/2/`
 * açılır; yayındaki oyunlar 1'de kalır ve bir gün kendiliğinden bozulmaz.
 *
 * ── SÖZLEŞME (lisem-web › lib/oyun/protocol.ts) ───────────────────────
 *
 *   oyun → sayfa   { tur: 'lisem-oyun:hazir' }            ZORUNLU, 20 sn içinde
 *   oyun → sayfa   { tur: 'lisem-oyun:skor', skor: 12 }   bir el bitti
 *
 * Sayfa oyuna hiçbir mesaj GÖNDERMEZ. Oyunu başlatır, tam ekrana alır ve
 * en iyi skoru ziyaretçinin kendi tarayıcısında hatırlar. `hazir` 20 sn
 * içinde gelmezse sayfa "Oyun yüklenemedi" der.
 *
 * Hedef köken `'*'` olmak ZORUNDA: oyun kısıtlı çerçevede "null" kökenle
 * çalışır ve somut bir köken yazılırsa mesaj sessizce kaybolur (ölçüldü).
 *
 * ── KULLANIM ──────────────────────────────────────────────────────────
 *
 *   const ctx = LisemOyun.tuval(canvas, { genislik: 400, yukseklik: 700 }, boyut => { … });
 *   LisemOyun.yaziTipleri().then(() => LisemOyun.hazir());
 *   …
 *   LisemOyun.skor(12);                 // el bittiğinde
 *   LisemOyun.renk('--color-accent')    // '#5b8def' (/marka/1/marka.css)
 *
 * Boşluk, ok tuşları, PageUp/PageDown, Home/End bu dosya yüklenince SAYFAYI
 * kaydırmaz (yoksa oyuncu zıpladıkça lisem.com.tr aşağı kayar — ölçüldü).
 * Metin kutusu olan bir oyun odak oradayken yazabilir; dosya onlara
 * dokunmaz.
 */
(function () {
  'use strict';

  var HAZIR = 'lisem-oyun:hazir';
  var SKOR = 'lisem-oyun:skor';
  /** lisem-web'in kabul ettiği en büyük skor (protocol.ts › SCORE_MAX). */
  var SKOR_TAVANI = 1000000000;

  // Kısıtlı çerçevede `window.parent`a erişmek hata vermez (yalnızca
  // içine bakmak verir); karşılaştırma güvenli.
  var gomulu = window.parent !== window;
  var hazirDendi = false;

  function gonder(mesaj) {
    if (!gomulu) return false;
    window.parent.postMessage(mesaj, '*');
    return true;
  }

  /** Yükleme bitti, oyun oynanabilir. Birden çok çağrı zararsız (ilki sayılır). */
  function hazir() {
    if (hazirDendi) return;
    hazirDendi = true;
    // Tuşlar oyuna gelsin. Sayfa da çerçeveye odak verir; ikisi birlikte
    // "ilk tuş boşa gitti" sorununu kapatır.
    window.focus();
    gonder({ tur: HAZIR });
    if (!gomulu) {
      console.info('[LisemOyun] hazır — oyun doğrudan açıldı; sayfa yok, mesaj gönderilmedi.');
    }
  }

  /** Bir el bitti. Skor 0 ya da pozitif TAM SAYI olur; ondalık aşağı yuvarlanır. */
  function skor(deger) {
    if (typeof deger !== 'number' || !isFinite(deger)) {
      throw new TypeError('LisemOyun.skor: sayı bekleniyor, gelen: ' + String(deger));
    }
    var tam = Math.max(0, Math.min(SKOR_TAVANI, Math.floor(deger)));
    gonder({ tur: SKOR, skor: tam });
    return tam;
  }

  // ── Kaydırma tuşları ────────────────────────────────────────────────
  var KAYDIRAN = {
    ' ': 1, Spacebar: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    PageUp: 1, PageDown: 1, Home: 1, End: 1,
  };

  function yaziAlani(hedef) {
    if (!hedef || !hedef.tagName) return false;
    var ad = hedef.tagName;
    // Düğmede boşluk "bas" demektir; kaydırmaz, dokunmayız.
    return ad === 'INPUT' || ad === 'TEXTAREA' || ad === 'SELECT' || ad === 'BUTTON' || hedef.isContentEditable;
  }

  window.addEventListener('keydown', function (olay) {
    if (KAYDIRAN[olay.key] && !yaziAlani(olay.target)) olay.preventDefault();
  }, { capture: true });

  // ── Marka ───────────────────────────────────────────────────────────
  var uyarilan = {};

  /**
   * /marka/<n>/marka.css'teki bir değişkenin değeri. Stil dosyası <head>'de
   * bağlıysa betik çalıştığında hazırdır. Bulunamazsa konsola bir kez
   * uyarır ve metin rengini döndürür — oyun çökmez, yanlışlık görünür.
   */
  function renk(ad) {
    var deger = getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
    if (deger) return deger;
    if (!uyarilan[ad]) {
      uyarilan[ad] = true;
      console.warn('[LisemOyun] ' + ad + ' tanımlı değil — /marka/1/marka.css bağlı mı?');
    }
    return '#1f2430';
  }

  /**
   * Marka yazı tiplerinin yüklenmesini bekler (tuval metni yazı tipi
   * gelmeden çizilirse sistem yazısıyla çizilir). Türkçe harfler ayrı
   * dosyada (`latin-ext`); örnek metin onu da indirtir. Süre dolarsa yine
   * çözülür: yazı tipi yüzünden oyun "yüklenemedi"ye düşmez.
   */
  function yaziTipleri(zamanAsimiMs) {
    var sure = typeof zamanAsimiMs === 'number' ? zamanAsimiMs : 2500;
    if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
    var ornek = 'Lisem Oyun 0123456789 ÇçĞğİıÖöŞşÜü';
    var yuklemeler = Promise.all([
      document.fonts.load('800 32px "Baloo 2"', ornek),
      document.fonts.load('400 16px "Inter"', ornek),
      document.fonts.load('600 16px "Inter"', ornek),
    ]).then(function () { return true; }, function (hata) {
      console.warn('[LisemOyun] yazı tipi yüklenemedi:', hata);
      return false;
    });
    var bekle = new Promise(function (coz) {
      setTimeout(function () { coz(false); }, sure);
    });
    return Promise.race([yuklemeler, bekle]);
  }

  // ── Tuval ───────────────────────────────────────────────────────────
  /**
   * Tuvali pencereye yayar ve oyunun TASARIM ölçüsünü ekrana sığdırır.
   *
   * Ölçek İKİ EKSENE göre kurulur: `min(H / yukseklik, W / genislik)`.
   * Yalnızca yüksekliğe bakan ölçek, oyun dikey telefonda (ya da masaüstü
   * tam ekranında) açılınca yazıyı ve oyuncuyu ekrandan taşırıyordu.
   *
   * Oyun DÜNYA birimleriyle çizer: dünya en az `genislik × yukseklik`tir,
   * ekran oranı farklıysa bir ekseni UZAR (dunyaW / dunyaH). Her boyut
   * değişiminde `boyutlandi({ W, H, dpr, olcek, dunyaW, dunyaH })` çağrılır
   * ve bağlamın dönüşümü `dpr × olcek`e kurulur.
   */
  function tuval(canvas, secenek, boyutlandi) {
    var genislik = (secenek && secenek.genislik) || 700;
    var yukseklik = (secenek && secenek.yukseklik) || 600;
    var enFazlaDpr = (secenek && secenek.enFazlaDpr) || 2;
    var ctx = canvas.getContext('2d');
    var olcu = null;

    function kur() {
      var W = window.innerWidth;
      var H = window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, enFazlaDpr);
      var olcek = Math.min(H / yukseklik, W / genislik);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr * olcek, 0, 0, dpr * olcek, 0, 0);
      olcu = { W: W, H: H, dpr: dpr, olcek: olcek, dunyaW: W / olcek, dunyaH: H / olcek };
      if (boyutlandi) boyutlandi(olcu);
    }

    window.addEventListener('resize', kur);
    kur();
    return {
      ctx: ctx,
      olcu: function () { return olcu; },
      /** Her karenin başında: dönüşümü geri kurar (oyun `save/restore`u unutsa bile). */
      sifirla: function () {
        ctx.setTransform(olcu.dpr * olcu.olcek, 0, 0, olcu.dpr * olcu.olcek, 0, 0);
      },
      /** Ekrandaki bir noktayı (ör. dokunuş) dünya birimine çevirir. */
      dunyaya: function (x, y) {
        return { x: x / olcu.olcek, y: y / olcu.olcek };
      },
    };
  }

  var hareketSorgusu = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  window.LisemOyun = Object.freeze({
    surum: 1,
    /** Oyun lisem.com.tr'nin (ya da önizlemenin) çerçevesinde mi? */
    gomulu: gomulu,
    hazir: hazir,
    skor: skor,
    renk: renk,
    yaziTipleri: yaziTipleri,
    tuval: tuval,
    /** Ziyaretçi "hareketi azalt" demiş mi? (sarsıntı, parlama, paralaks) */
    hareketiAzalt: function () { return !!(hareketSorgusu && hareketSorgusu.matches); },
  });
})();
