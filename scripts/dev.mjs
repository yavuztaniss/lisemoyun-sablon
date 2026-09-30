#!/usr/bin/env node
/**
 * GELİŞTİRME SUNUCUSU — `npm run dev`
 *
 * İki sunucu açar ve ikisi AYRI SİTEDİR, üretimdeki düzen gibi:
 *
 *   http://localhost:4401    ÖNİZLEME — lisem.com.tr'nin oyun sayfasının
 *                            yerel taklidi: oyunu AYNI kısıtlı çerçeveyle
 *                            (`sandbox="allow-scripts"`) gömer, "hazır" ve
 *                            "skor" mesajlarını gösterir, 20 sn kuralını
 *                            uygular, sayfa kayarsa uyarır.
 *   http://127.0.0.1:4400    OYUN SUNUCUSU — üretim oyun sunucusunun taklidi:
 *                            dosyaları üretimdeki yollarla ve `vercel.json`un
 *                            BAŞLIKLARIYLA sunar (CSP sandbox dahil). Oyun
 *                            burada çalışıyorsa üretimde de çalışır.
 *
 * Portlar: OYUN_PORT, ONIZLEME_PORT. Dosyalar her istekte diskten okunur;
 * kaydet → önizlemede "Yeniden başlat".
 *
 * lisem-web'i de yerelde çalıştırıp oyunu GERÇEK oynatıcıda görmek için:
 *   SITE_KOKENI=http://localhost:3000 npm run dev
 *   (lisem-web tarafında: OYUN_ORIGIN=http://127.0.0.1:4400)
 * `SITE_KOKENI` frame-ancestors'a eklenir; yoksa site çerçeveyi açamaz.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KOK, TURLER, basliklar, oyunlar, uzanti, yayinKlasorleri, yesil, soluk } from './ortak.mjs';

const ONIZLEME_KLASORU = join(KOK, 'scripts', 'onizleme');

function dosyaGonder(yanit, dosya, ekBasliklar = {}) {
  const govde = readFileSync(dosya);
  yanit.writeHead(200, {
    'Content-Type': TURLER[uzanti(dosya)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    ...ekBasliklar,
  });
  yanit.end(govde);
}

function bulunamadi(yanit, ekBasliklar = {}) {
  yanit.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...ekBasliklar });
  yanit.end('Bulunamadı');
}

/** `/lisem-bird/1/oyun.js` → depodaki dosya; klasör dışına çıkış yok. */
function coz(yol, klasorler) {
  for (const k of klasorler) {
    const on = `/${k.yol}`;
    if (!yol.startsWith(on)) continue;
    let geri = yol.slice(on.length);
    if (geri === '' || geri.endsWith('/')) geri += 'index.html';
    const tam = normalize(join(k.kaynak, geri));
    if (!tam.startsWith(k.kaynak + sep)) return null;
    if (existsSync(tam) && statSync(tam).isFile()) return tam;
    return null;
  }
  return null;
}

/** Önizlemenin listesi: her oyunun her sürümü + şablon. */
function oyunListesi(oyunKokeni) {
  const liste = [];
  for (const oyun of oyunlar()) {
    for (const s of oyun.surumler) {
      liste.push({
        ad: oyun.ad,
        surum: s,
        baslik: oyun.bilgi?.baslik ?? oyun.ad,
        yon: oyun.bilgi?.yon === 'dikey' ? 'dikey' : 'yatay',
        adres: `${oyunKokeni}/${oyun.ad}/${s}/index.html`,
      });
    }
  }
  liste.push({
    ad: 'sablon',
    surum: '1',
    baslik: 'Şablon',
    yon: 'yatay',
    adres: `${oyunKokeni}/sablon/1/index.html`,
  });
  return liste;
}

export function sunuculariBaslat({
  oyunPort = Number(process.env.OYUN_PORT || 4400),
  onizlemePort = Number(process.env.ONIZLEME_PORT || 4401),
  sessiz = false,
} = {}) {
  const oyunKokeni = `http://127.0.0.1:${oyunPort}`;
  const onizlemeKokeni = `http://localhost:${onizlemePort}`;
  const siteKokenleri = (process.env.SITE_KOKENI ?? '').split(/[\s,]+/).filter(Boolean);

  const oyunSunucusu = createServer((istek, yanit) => {
    const yol = decodeURIComponent(new URL(istek.url, oyunKokeni).pathname);
    // Başlıklar her istekte vercel.json'dan: dosya değişirse yeniden başlatmak gerekmez.
    const b = basliklar([onizlemeKokeni, ...siteKokenleri]);
    if (yol === '/') {
      yanit.writeHead(302, { Location: `${onizlemeKokeni}/` });
      yanit.end();
      return;
    }
    const dosya = coz(yol, yayinKlasorleri({ sablonDahil: true }));
    if (!dosya) return bulunamadi(yanit, b);
    dosyaGonder(yanit, dosya, b);
  });

  const onizlemeSunucusu = createServer((istek, yanit) => {
    const yol = new URL(istek.url, onizlemeKokeni).pathname;
    // lisem.com.tr gibi: kendi dosyaları + yalnızca oyun kökeninden çerçeve.
    const csp = `default-src 'self'; frame-src ${oyunKokeni}; img-src 'self' data:; frame-ancestors 'none'`;
    if (yol === '/oyunlar.json') {
      yanit.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      yanit.end(JSON.stringify(oyunListesi(oyunKokeni)));
      return;
    }
    const ad = yol === '/' ? 'index.html' : yol.slice(1);
    const tam = normalize(join(ONIZLEME_KLASORU, ad));
    if (!tam.startsWith(ONIZLEME_KLASORU + sep) || !existsSync(tam)) return bulunamadi(yanit);
    dosyaGonder(yanit, tam, { 'Content-Security-Policy': csp });
  });

  return Promise.all([
    new Promise((coz_) => oyunSunucusu.listen(oyunPort, '127.0.0.1', coz_)),
    new Promise((coz_) => onizlemeSunucusu.listen(onizlemePort, 'localhost', coz_)),
  ]).then(() => {
    if (!sessiz) {
      console.log(`${yesil('●')} önizleme      ${onizlemeKokeni}/`);
      console.log(`${yesil('●')} oyun sunucusu ${oyunKokeni}/  ${soluk('(vercel.json başlıklarıyla)')}`);
      if (siteKokenleri.length) console.log(`${yesil('●')} çerçeveye izinli: ${siteKokenleri.join(' ')}`);
    }
    return {
      oyunKokeni,
      onizlemeKokeni,
      kapat: () =>
        Promise.all([
          new Promise((c) => oyunSunucusu.close(c)),
          new Promise((c) => onizlemeSunucusu.close(c)),
        ]),
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await sunuculariBaslat();
}
