#!/usr/bin/env node
/**
 * DENETİM — `npm run check` (CI'da ve `npm run build`de de koşar).
 *
 * Bir oyunun lisem.com.tr'de gerçekten çalışıp çalışmayacağını, oyunu
 * açmadan, dosyalarına bakarak söyler. Kurallar gerçek Chromium'da ÖLÇÜLMÜŞ
 * kısıtlardan gelir (lisem-web › docs/LISEM-OYUN.md); her hatanın yanında
 * nedeni yazar.
 *
 *   1. Düzen       oyun adı, sürüm klasörü, index.html, oyun.json alanları
 *                  (lisem-web migrasyon 0024'ün sınırlarıyla aynı)
 *   2. Dosyalar    tür beyaz listesi, boyut sınırı
 *   3. HTML        satır içi betik/stil yok (CSP), dış kaynak yok, bağlar var
 *   4. JavaScript  depolama/çerez/açılır pencere/eval/dış istek yok; "hazır" var
 *   5. Kilit       yayına girmiş sürüm DEĞİŞMEZ (kilit.json)
 *   6. Marka       /marka/N/ renkleri lisem-web'le aynı (klon yan yanaysa)
 *   7. Sunucu      vercel.json'un güvenlik başlıkları yerinde
 *
 * `kutuphane/` klasöründeki dosyalar (Phaser gibi hazır kütüphaneler)
 * yalnızca tür ve boyuttan geçer; içerikleri denetlenmez.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AYRILMIS_ADLAR,
  KLASOR_RE,
  KIT,
  KOK,
  OYUN_ADI_RE,
  PAYLASILAN,
  SURUM_RE,
  TURLER,
  dosyalar,
  kilitOku,
  klasorOzeti,
  kirmizi,
  oyunlar,
  paylasilanlar,
  sari,
  soluk,
  uzanti,
  yayinKlasorleri,
  yesil,
} from './ortak.mjs';

/** lisem-web › lib/content/oyun-categories.ts ↔ migrasyon 0024. */
export const KATEGORILER = ['aksiyon', 'bulmaca', 'spor', 'strateji', 'simulasyon'];
const OYUN_JSON_ALANLARI = new Set([
  'baslik', 'ozet', 'nasil_oynanir', 'kategori', 'yon', 'tur', 'gelistirici', 'anonim', 'kapak_alt', 'surum',
]);
const DOSYA_SINIRI = 5 * 1024 * 1024;
const SURUM_SINIRI = 20 * 1024 * 1024;
const SURUM_UYARI = 5 * 1024 * 1024;

export function denetle() {
  const hatalar = [];
  const uyarilar = [];
  const hata = (yer, metin) => hatalar.push(`${yer}: ${metin}`);
  const uyari = (yer, metin) => uyarilar.push(`${yer}: ${metin}`);
  const paylasilan = paylasilanlar();

  // ── 1. Düzen ────────────────────────────────────────────────────────
  for (const oyun of oyunlar()) {
    const yer = `oyunlar/${oyun.ad}`;
    if (!OYUN_ADI_RE.test(oyun.ad) || oyun.ad.length < 3 || oyun.ad.length > 60) {
      hata(yer, 'oyun adı küçük harf, rakam ve tireden oluşmalı (3–60 karakter) — sitedeki adresi olur: lisem.com.tr/oyun/<ad>');
    }
    if (AYRILMIS_ADLAR.has(oyun.ad)) hata(yer, `"${oyun.ad}" oyun sunucusunda ayrılmış bir ad`);
    if (oyun.bilgiHatasi) hata(`${yer}/oyun.json`, oyun.bilgiHatasi);
    else oyunBilgisi(oyun, yer, hata, uyari);

    if (oyun.surumler.length === 0) hata(yer, 'hiç sürüm klasörü yok (ör. 1/)');
    for (const s of oyun.surumler) {
      const klasor = `${oyun.ad}/${s}/`;
      if (!SURUM_RE.test(s)) hata(`${yer}/${s}`, 'sürüm klasörü küçük harf/rakam olmalı (1, 2, 1.1 …)');
      else if (!KLASOR_RE.test(klasor) || klasor.length > 120) hata(`${yer}/${s}`, 'panelin oyun klasörü biçimine uymuyor');
      if (!existsSync(join(oyun.klasor, s, 'index.html'))) hata(`${yer}/${s}`, 'index.html yok (giriş sayfası zorunlu)');
    }
    const kapak = ['kapak.jpg', 'kapak.png'].find((ad) => existsSync(join(oyun.klasor, ad)));
    if (!kapak) uyari(yer, 'kapak.jpg ya da kapak.png yok — vitrindeki görsel (JPEG/PNG, 1600 × 1000)');
  }

  // ── 2–4. Her yayın klasörü (+ şablon) ─────────────────────────────────
  for (const k of yayinKlasorleri({ sablonDahil: true })) {
    klasoruDenetle(k, paylasilan, hata, uyari);
  }

  // ── 5. Kilit ────────────────────────────────────────────────────────
  const kilit = kilitOku();
  const yayinYollari = new Map(yayinKlasorleri().map((k) => [k.yol, k]));
  for (const [yol, ozet] of Object.entries(kilit)) {
    const k = yayinYollari.get(yol);
    if (!k) {
      hata(`kilit.json › ${yol}`, 'kilitli sürüm SİLİNMİŞ — yayındaki oyun 404 verir. Klasörü geri getir.');
    } else if (klasorOzeti(k.kaynak) !== ozet) {
      hata(
        `kilit.json › ${yol}`,
        KIT && (k.tur === 'sdk' || k.tur === 'marka')
          ? "paylasilan/ klasörü DEĞİŞMİŞ — sitede senin kopyan değil Lisem'inki kullanılır; değişikliği geri al (git checkout paylasilan)."
          : 'kilitli sürüm DEĞİŞMİŞ. Yayındaki sürüme dokunulmaz: yeni sürüm klasörü aç (ör. 2/), panelde klasörü güncelle.',
      );
    }
  }
  for (const k of yayinYollari.values()) {
    if (k.tur === 'oyun' && !KIT && !(k.yol in kilit)) {
      uyari(k.yol, 'kilitli değil — panele yazılmadan önce `npm run kilitle`');
    }
    if ((k.tur === 'sdk' || k.tur === 'marka') && !(k.yol in kilit)) {
      hata(k.yol, 'ortak sürüm kilitli değil — oyunlar buna bağlanır; `npm run kilitle`');
    }
  }

  // Kitte (öğrencinin deposu) marka eşliği ve sunucu başlıkları Lisem'in
  // işi: orada lisem-web klonu da vercel.json da yok.
  if (!KIT) {
    // ── 6. Marka ↔ lisem-web ──────────────────────────────────────────
    markaDenetle(paylasilan, hata, uyari);

    // ── 7. vercel.json ───────────────────────────────────────────────
    sunucuDenetle(hata);
  }

  return { hatalar, uyarilar };
}

function oyunBilgisi(oyun, yer, hata, uyari) {
  const b = oyun.bilgi;
  const y = `${yer}/oyun.json`;
  for (const anahtar of Object.keys(b)) {
    if (!OYUN_JSON_ALANLARI.has(anahtar)) hata(y, `tanınmayan alan "${anahtar}"`);
  }
  const metin = (ad, en, enFazla, zorunlu) => {
    const deger = b[ad];
    if (deger === undefined || deger === null) {
      if (zorunlu) hata(y, `"${ad}" zorunlu`);
      return;
    }
    if (typeof deger !== 'string') return hata(y, `"${ad}" metin olmalı`);
    const uzunluk = [...deger.trim()].length;
    if (uzunluk < en || uzunluk > enFazla) hata(y, `"${ad}" ${en}–${enFazla} karakter olmalı (şu an ${uzunluk})`);
  };
  metin('baslik', 2, 60, true);
  metin('ozet', 0, 160, true);
  metin('nasil_oynanir', 0, 600, true);
  metin('kapak_alt', 0, 300, false);
  if (!KATEGORILER.includes(b.kategori)) hata(y, `"kategori" şunlardan biri: ${KATEGORILER.join(', ')}`);
  if (b.yon !== 'yatay' && b.yon !== 'dikey') hata(y, '"yon" yatay ya da dikey');
  if (b.tur !== 'lisem' && b.tur !== 'topluluk') hata(y, '"tur" lisem ya da topluluk');
  if (KIT && b.tur !== 'topluluk') hata(y, '"tur" "topluluk" olmalı — bu depo topluluk oyunları için');
  if (b.tur === 'topluluk') {
    if (typeof b.gelistirici !== 'string' || !b.gelistirici.trim()) {
      hata(y, 'topluluk oyununda "gelistirici" (Lisem kullanıcı adın) zorunlu — sahipsiz topluluk oyunu yayımlanamaz; anonim kalsan da yazılır, sitede görünmez');
    }
  } else if (b.gelistirici !== undefined && b.gelistirici !== null) {
    hata(y, 'Lisem oyununda "gelistirici" olmaz (null bırak)');
  }
  if (b.anonim !== undefined && typeof b.anonim !== 'boolean') hata(y, '"anonim" true ya da false');
  if (b.anonim === true && b.tur !== 'topluluk') hata(y, '"anonim" yalnızca topluluk oyununda');
  if (typeof b.surum !== 'string' || !oyun.surumler.includes(b.surum)) {
    hata(y, `"surum" panele yazılan sürüm klasörü olmalı (var olanlar: ${oyun.surumler.join(', ') || 'yok'})`);
  }
  if (b.ozet === '') uyari(y, '"ozet" boş — vitrin kartında açıklama çıkmaz');
}

function yorumsuz(kod) {
  // Kaba ama yeterli: blok yorumlar ve satır yorumları. `https://` içindeki
  // `//` önünde `:` olduğu için yorum sayılmaz.
  return kod.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

const JS_YASAKLARI = [
  [/\blocalStorage\b/, 'localStorage — kısıtlı çerçevede OKUMAK bile SecurityError fırlatır; en iyi skoru sayfa tutar (LisemOyun.skor)'],
  [/\bsessionStorage\b/, 'sessionStorage — kısıtlı çerçevede hata fırlatır'],
  [/\bindexedDB\b/, 'indexedDB — kısıtlı çerçevede hata fırlatır'],
  [/\bdocument\.cookie\b/, 'document.cookie — kısıtlı çerçevede hata fırlatır; çerez yok'],
  [/\bwindow\.open\s*\(/, 'window.open — açılır pencere engelli'],
  [/(^|[^.\w])alert\s*\(/, 'alert — kısıtlı çerçevede yok sayılır; mesajı oyunun içinde göster'],
  [/(^|[^.\w])confirm\s*\(/, 'confirm — kısıtlı çerçevede yok sayılır'],
  [/(^|[^.\w])prompt\s*\(/, 'prompt — kısıtlı çerçevede yok sayılır'],
  [/\b(top|parent)\.location\b/, 'top/parent.location — sayfayı yönlendirmek engelli'],
  [/\bwindow\.top\b/, 'window.top — sayfaya erişim yok'],
  [/\beval\s*\(/, "eval — CSP 'unsafe-eval' vermiyor"],
  [/\bnew\s+Function\s*\(/, "new Function — CSP 'unsafe-eval' vermiyor"],
  [/\bSharedArrayBuffer\b/, 'SharedArrayBuffer — çok iş parçacıklı çıktı V1\'de yok'],
  [/\bserviceWorker\b/, 'service worker — kısıtlı çerçevede kaydedilemez'],
  [/\bnew\s+(Shared)?Worker\s*\(/, "Worker — kısıtlı çerçevede açılmaz: dosyadan SecurityError, blob:/data: adresini CSP reddeder (hata fırlatmaz, yalnızca onerror gelir; oyun takılır). İşi ana iş parçacığında, karelere bölerek yap"],
  [/\bfetch\s*\(\s*['"`]https?:/, 'dış adrese fetch — CSP default-src \'self\' engeller'],
];

function jsDenetle(yer, kod, hata, uyari) {
  const temiz = yorumsuz(kod);
  for (const [desen, neden] of JS_YASAKLARI) {
    if (desen.test(temiz)) hata(yer, neden);
  }
  const adresler = temiz.match(/https?:\/\/[^\s'"`)]+/g) ?? [];
  for (const adres of adresler) {
    if (adres.startsWith('http://www.w3.org/')) continue;
    hata(yer, `dış adres "${adres}" — oyun dışarıya istek atamaz (CSP default-src 'self'); dosyayı klasöre koy`);
  }
  if (/postMessage\s*\([^;]*,\s*['"`](?!\*['"`])/.test(temiz)) {
    uyari(yer, "postMessage hedef kökeni '*' olmalı — oyun 'null' kökenle çalışır, somut köken yazılırsa mesaj kaybolur");
  }
}

function klasoruDenetle(k, paylasilan, hata, uyari) {
  const tumu = dosyalar(k.kaynak);
  let toplam = 0;
  const html = [];
  let jsMetni = '';

  for (const ad of tumu) {
    const yer = `${k.yol}${ad}`;
    const tam = join(k.kaynak, ad);
    const boyut = statSync(tam).size;
    toplam += boyut;
    if (ad.split('/').some((parca) => parca.startsWith('.'))) hata(yer, 'gizli dosya yayınlanmaz');
    const uz = uzanti(ad);
    if (!(uz in TURLER)) hata(yer, `"${uz || 'uzantısız'}" türü yayınlanmaz (izinli: ${Object.keys(TURLER).join(' ')})`);
    if (boyut > DOSYA_SINIRI) hata(yer, `dosya ${(boyut / 1048576).toFixed(1)} MB — tek dosya en fazla 5 MB`);
    if (ad.startsWith('kutuphane/')) continue;
    if (uz === '.html') html.push(ad);
    if (uz === '.js' || uz === '.mjs') {
      const kod = readFileSync(tam, 'utf8');
      jsMetni += `\n${yorumsuz(kod)}`;
      jsDenetle(yer, kod, hata, uyari);
    }
    if (uz === '.css') {
      const css = yorumsuz(readFileSync(tam, 'utf8'));
      if (/url\(\s*['"]?https?:/i.test(css) || /@import\s+(url\()?\s*['"]?https?:/i.test(css)) {
        hata(yer, 'dış adresten stil/yazı tipi/görsel — CSP engeller; dosyayı klasöre koy');
      }
    }
  }
  if (toplam > SURUM_SINIRI) hata(k.yol, `sürüm ${(toplam / 1048576).toFixed(1)} MB — en fazla 20 MB`);
  else if (toplam > SURUM_UYARI) uyari(k.yol, `sürüm ${(toplam / 1048576).toFixed(1)} MB — telefonda yavaş açılır`);

  if (k.tur === 'sdk' || k.tur === 'marka') {
    if (!/^[0-9]+$/.test(k.yol.split('/')[1])) hata(k.yol, 'ortak dosyaların sürümü düz sayı olmalı (1, 2 …)');
    return;
  }

  let sdkBagli = false;
  for (const ad of html) {
    const yer = `${k.yol}${ad}`;
    const icerik = readFileSync(join(k.kaynak, ad), 'utf8');
    const kod = icerik.replace(/<!--[\s\S]*?-->/g, '');
    for (const etiket of kod.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
      const acilis = etiket.match(/<script\b[^>]*>/i)[0];
      if (!/\bsrc\s*=/.test(acilis) && etiket.replace(acilis, '').replace(/<\/script>$/i, '').trim()) {
        hata(yer, "satır içi <script> — CSP (default-src 'self') çalıştırmaz; kodu .js dosyasına taşı");
      }
    }
    if (/<style\b/i.test(kod)) hata(yer, "satır içi <style> — CSP uygulamaz; stili .css dosyasına taşı");
    if (/\sstyle\s*=\s*["']/i.test(kod)) hata(yer, 'style="…" özniteliği — CSP uygulamaz; sınıf kullan');
    if (/\son[a-z]+\s*=\s*["']/i.test(kod)) hata(yer, 'onclick="…" gibi satır içi olay — CSP çalıştırmaz; addEventListener kullan');
    if (/<base\b/i.test(kod)) hata(yer, '<base> kullanılmaz (göreli yollar bozulur)');
    if (/\starget\s*=\s*["']_(blank|top|parent)/i.test(kod)) hata(yer, 'target="_blank/_top" — pencere açmak ve sayfayı yönlendirmek engelli');
    if (/<form\b/i.test(kod)) uyari(yer, '<form> gönderilemez (form-action \'none\')');

    const baglar = [...kod.matchAll(/\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const bag of baglar) {
      if (/^(data:|blob:|#)/.test(bag)) continue;
      if (/^(https?:)?\/\//i.test(bag)) {
        hata(yer, `dış kaynak "${bag}" — CSP engeller; dosyayı klasöre koy`);
        continue;
      }
      if (bag.startsWith('/')) {
        const m = bag.match(/^\/(sdk|marka)\/([^/]+)\/(.+)$/);
        if (!m) {
          hata(yer, `mutlak yol "${bag}" — oyunun kendi dosyaları GÖRELİ yolla bağlanır; mutlak yol yalnızca /sdk/N/ ve /marka/N/`);
          continue;
        }
        if (!paylasilan[m[1]].includes(m[2])) {
          hata(yer, `"${bag}" — /${m[1]}/${m[2]}/ diye bir ortak sürüm yok`);
          continue;
        }
        if (!existsSync(join(PAYLASILAN, m[1], m[2], m[3]))) hata(yer, `"${bag}" bulunamadı`);
        if (m[1] === 'sdk') sdkBagli = true;
        continue;
      }
      const hedef = posix.normalize(posix.join(posix.dirname(ad), bag.split(/[?#]/)[0]));
      if (hedef.startsWith('..')) hata(yer, `"${bag}" sürüm klasörünün dışına çıkıyor`);
      else if (!existsSync(join(k.kaynak, hedef))) hata(yer, `"${bag}" bulunamadı`);
    }
  }

  // `var L = window.LisemOyun; L.hazir()` de sayılır.
  const sdkKullanir = sdkBagli && /\bLisemOyun\b/.test(jsMetni);
  const hazirVar = sdkKullanir ? /\.hazir\s*\(/.test(jsMetni) : /lisem-oyun:hazir/.test(jsMetni);
  if (!hazirVar) {
    hata(
      k.yol,
      sdkBagli
        ? 'LisemOyun.hazir() hiç çağrılmıyor — sayfa 20 sn sonra "Oyun yüklenemedi" der'
        : '"hazır" mesajı yok — /sdk/1/lisem-oyun.js bağla ve LisemOyun.hazir() çağır',
    );
  }
  if (sdkBagli && !/\.skor\s*\(/.test(jsMetni) && !/lisem-oyun:skor/.test(jsMetni)) {
    uyari(k.yol, 'skor gönderilmiyor — skorsuz oyunda sorun değil, varsa el bitince LisemOyun.skor(n)');
  }
}

function markaDenetle(paylasilan, hata, uyari) {
  const webYolu = resolve(process.env.LISEMWEB || join(KOK, '..', 'lisemweb'));
  const tokens = join(webYolu, 'styles', 'tokens.css');
  if (!existsSync(tokens)) {
    uyari('marka', `lisem-web klonu yok (${tokens}) — renk eşliği denetlenmedi. LISEMWEB=<yol> ile göster.`);
    return;
  }
  const web = new Map();
  for (const m of readFileSync(tokens, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    if (!web.has(m[1])) web.set(m[1], m[2].trim());
  }
  for (const n of paylasilan.marka) {
    const css = readFileSync(join(PAYLASILAN, 'marka', n, 'marka.css'), 'utf8');
    const blok = css.match(/@parity BEGIN[\s\S]*?@parity END/);
    if (!blok) {
      hata(`marka/${n}/marka.css`, '@parity BEGIN … END bloğu yok');
      continue;
    }
    for (const m of blok[0].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      const [, ad, deger] = m;
      if (!web.has(ad)) hata(`marka/${n}/marka.css`, `${ad} lisem-web'de yok — renk icat edilmez`);
      else if (web.get(ad).toLowerCase() !== deger.trim().toLowerCase()) {
        hata(`marka/${n}/marka.css`, `${ad}: burada ${deger.trim()}, lisem-web'de ${web.get(ad)}`);
      }
    }
  }
}

function sunucuDenetle(hata) {
  const vercel = JSON.parse(readFileSync(join(KOK, 'vercel.json'), 'utf8'));
  const kural = (vercel.headers ?? []).find((h) => h.source === '/(.*)');
  const b = new Map((kural?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
  const csp = b.get('content-security-policy') ?? '';
  const parcalar = csp.split(';').map((p) => p.trim());
  const sandbox = parcalar.find((p) => p === 'sandbox' || p.startsWith('sandbox '));
  if (!sandbox) hata('vercel.json', 'CSP sandbox YOK — alt alan adındaki oyun lisem.com.tr çerezlerine uzanabilir (ölçüldü)');
  else if (sandbox.includes('allow-same-origin')) hata('vercel.json', 'CSP sandbox allow-same-origin içeriyor — kalkan kalkar');
  const atalar = parcalar.find((p) => p.startsWith('frame-ancestors '));
  if (!atalar || !atalar.includes('https://lisem.com.tr')) hata('vercel.json', 'frame-ancestors https://lisem.com.tr içermeli');
  if (!parcalar.some((p) => p.startsWith("default-src 'self'"))) hata('vercel.json', "CSP default-src 'self' olmalı");
  for (const p of parcalar) {
    const gevsek = p.match(/'unsafe-(eval|inline|hashes)'/);
    if (gevsek) hata('vercel.json', `CSP ${p.split(/\s+/)[0]} ${gevsek[0]} içeriyor — JS eval / satır içi betik açılır`);
  }
  // `.wasm` izinli tür: 'wasm-unsafe-eval' yoksa wasm denetimden geçer ama
  // yayında derlenmez (ölçüldü). İzin YALNIZCA wasm içindir; JS eval kapalı kalır.
  const betik = parcalar.find((p) => p.startsWith('script-src '))?.split(/\s+/).slice(1).sort().join(' ');
  if (betik !== "'self' 'wasm-unsafe-eval'") {
    hata('vercel.json', "CSP script-src tam olarak 'self' 'wasm-unsafe-eval' olmalı — eksikse .wasm yayında derlenmez (ölçüldü), fazlası kalkanı deler");
  }
  if (b.get('access-control-allow-origin') !== '*') {
    hata('vercel.json', 'Access-Control-Allow-Origin: * olmalı — kısıtlı çerçevede yazı tipi, modül ve fetch bunsuz yüklenmez');
  }
  const izin = b.get('permissions-policy') ?? '';
  if (/fullscreen=\(self\)/.test(izin)) hata('vercel.json', 'Permissions-Policy fullscreen=(self) oyunun tam ekranını kırar');
  if (vercel.cleanUrls) hata('vercel.json', 'cleanUrls açık — /…/index.html yönlendirilir, site ve sağlık denetimi kırılır');
  if (vercel.outputDirectory !== 'dist') hata('vercel.json', 'outputDirectory "dist" olmalı');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { hatalar, uyarilar } = denetle();
  for (const u of uyarilar) console.log(`${sari('uyarı')} ${u}`);
  for (const h of hatalar) console.log(`${kirmizi('HATA ')} ${h}`);
  const sayi = yayinKlasorleri().length;
  if (hatalar.length) {
    console.log(`\n${kirmizi(`✗ ${hatalar.length} hata`)}${uyarilar.length ? `, ${uyarilar.length} uyarı` : ''}`);
    process.exit(1);
  }
  console.log(`\n${yesil('✓ denetim temiz')} ${soluk(`(${sayi} klasör${uyarilar.length ? `, ${uyarilar.length} uyarı` : ''})`)}`);
}

