/**
 * Betiklerin ortak parçası: klasör düzeni, yayın haritası, başlıklar,
 * klasör özeti. Bağımlılık YOK — yalnızca Node'un kendisi.
 *
 * ══ YAYIN DÜZENİ ═══════════════════════════════════════════════════════
 *
 *   depo                              oyun sunucusunda (lisemoyun.vercel.app)
 *   ────────────────────────────────  ─────────────────────────────────────
 *   oyunlar/<oyun>/<sürüm>/…          /<oyun>/<sürüm>/…
 *   paylasilan/sdk/<n>/…              /sdk/<n>/…
 *   paylasilan/marka/<n>/…            /marka/<n>/…
 *   oyunlar/<oyun>/oyun.json, kapak   YAYINLANMAZ (panel için bilgi)
 *   oyunlar/<oyun>/kaynak/            YAYINLANMAZ (derleyicili oyunun kaynağı)
 *   sablon/                           YAYINLANMAZ (yalnızca `npm run dev`)
 *
 * lisem.com.tr'nin paneline yazılan "oyun klasörü" `<oyun>/<sürüm>/`dür;
 * site tam adresi `OYUN_ORIGIN` + klasör + `index.html` diye kurar.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OYUNLAR = join(KOK, 'oyunlar');
export const PAYLASILAN = join(KOK, 'paylasilan');
export const SABLON = join(KOK, 'sablon');
export const KILIT = join(KOK, 'kilit.json');

/**
 * TOPLULUK KİTİ mi? Bu betikler iki yerde çalışır: Lisem'in özel deposunda
 * (lisemoyun) ve öğrencilerin kopyaladığı açık şablon deposunda
 * (lisemoyun-sablon, `npm run kit` üretir). Kitte bu işaret dosyası vardır;
 * kilit, sunucu başlığı ve lisem-web renk eşliği denetimleri orada koşmaz
 * (öğrencinin işi değil), oyun türü `topluluk` olmak zorundadır.
 */
export const KIT = existsSync(join(KOK, '.lisemoyun-kit'));

/** lisem-web › lib/oyun/origin.ts ve migrasyon 0024 ile AYNI biçimler. */
export const OYUN_ADI_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SURUM_RE = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
export const KLASOR_RE = /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+([.-][a-z0-9]+)*\/$/;

/** Oyunun derleyiciyle (Vite vb.) yazılmış KAYNAĞI; yayınlanmaz. */
export const KAYNAK_KLASORU = 'kaynak';

/** Oyun sunucusunda ortak dosyalara ayrılmış adlar: oyun bu adları alamaz. */
export const AYRILMIS_ADLAR = new Set(['sdk', 'marka', 'sablon', 'api', 'index']);

export const TURLER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.wasm': 'application/wasm',
};

export function uzanti(yol) {
  const i = yol.lastIndexOf('.');
  return i < 0 ? '' : yol.slice(i).toLowerCase();
}

/** Bir klasördeki bütün dosyalar (göreli yol, `/` ayraçlı, sıralı). */
export function dosyalar(klasor) {
  const cikti = [];
  const gez = (d) => {
    for (const ad of readdirSync(d).sort()) {
      const tam = join(d, ad);
      const bilgi = statSync(tam);
      if (bilgi.isDirectory()) gez(tam);
      else cikti.push(relative(klasor, tam).split(sep).join('/'));
    }
  };
  if (existsSync(klasor)) gez(klasor);
  return cikti;
}

function altKlasorler(d) {
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((ad) => !ad.startsWith('.') && statSync(join(d, ad)).isDirectory())
    .sort();
}

/** `oyunlar/` altındaki her oyun: ad, klasör, sürümler, oyun.json. */
export function oyunlar() {
  return altKlasorler(OYUNLAR).map((ad) => {
    const klasor = join(OYUNLAR, ad);
    const bilgiYolu = join(klasor, 'oyun.json');
    let bilgi = null;
    let bilgiHatasi = null;
    if (existsSync(bilgiYolu)) {
      try {
        bilgi = JSON.parse(readFileSync(bilgiYolu, 'utf8'));
      } catch (hata) {
        bilgiHatasi = hata.message;
      }
    } else {
      bilgiHatasi = 'oyun.json yok';
    }
    // `kaynak/` bir sürüm değil: derleyici kullanan oyunun kaynağı (yayınlanmaz).
    const surumler = altKlasorler(klasor).filter((s) => s !== KAYNAK_KLASORU);
    return { ad, klasor, surumler, bilgi, bilgiHatasi };
  });
}

/** Ortak dosyaların sürümleri: { sdk: ['1'], marka: ['1'] }. */
export function paylasilanlar() {
  return {
    sdk: altKlasorler(join(PAYLASILAN, 'sdk')),
    marka: altKlasorler(join(PAYLASILAN, 'marka')),
  };
}

/**
 * Yayınlanan her klasör: sunucudaki yolu (`lisem-bird/1/`) → depodaki yeri.
 * `sablonDahil` yalnızca geliştirme sunucusu için.
 */
export function yayinKlasorleri({ sablonDahil = false } = {}) {
  const cikti = [];
  const p = paylasilanlar();
  for (const n of p.sdk) cikti.push({ yol: `sdk/${n}/`, kaynak: join(PAYLASILAN, 'sdk', n), tur: 'sdk' });
  for (const n of p.marka) cikti.push({ yol: `marka/${n}/`, kaynak: join(PAYLASILAN, 'marka', n), tur: 'marka' });
  for (const oyun of oyunlar()) {
    for (const s of oyun.surumler) {
      cikti.push({ yol: `${oyun.ad}/${s}/`, kaynak: join(oyun.klasor, s), tur: 'oyun', oyun: oyun.ad });
    }
  }
  if (sablonDahil) {
    for (const s of altKlasorler(SABLON)) {
      cikti.push({ yol: `sablon/${s}/`, kaynak: join(SABLON, s), tur: 'sablon' });
    }
  }
  return cikti;
}

/**
 * Bir klasörün özeti: dosya adları + içerikleri. Kilitli sürümün tek bir
 * baytı değişse özet değişir (kilit.json bunu yakalar).
 */
export function klasorOzeti(klasor) {
  const ozet = createHash('sha256');
  for (const ad of dosyalar(klasor)) {
    ozet.update(ad);
    ozet.update('\0');
    ozet.update(createHash('sha256').update(readFileSync(join(klasor, ad))).digest('hex'));
    ozet.update('\n');
  }
  return `sha256-${ozet.digest('hex')}`;
}

export function kilitOku() {
  if (!existsSync(KILIT)) return {};
  return JSON.parse(readFileSync(KILIT, 'utf8')).kilitli ?? {};
}

/** Kitte `vercel.json` yok; başlıklar `npm run kit`in yazdığı kopyadan okunur. */
export const KIT_BASLIKLARI = 'sunucu-basliklari.json';

/** `vercel.json`un "/(.*)" kuralındaki başlıklar ([{ key, value }]). */
export function sunucuBasliklari() {
  if (KIT) return JSON.parse(readFileSync(join(KOK, KIT_BASLIKLARI), 'utf8')).basliklar;
  const vercel = JSON.parse(readFileSync(join(KOK, 'vercel.json'), 'utf8'));
  const kural = (vercel.headers ?? []).find((h) => h.source === '/(.*)');
  if (!kural) throw new Error('vercel.json: "/(.*)" başlık kuralı yok');
  return kural.headers;
}

/**
 * Oyun sunucusunun başlıkları — TEK kaynak `vercel.json` (kitte onun
 * kopyası). Geliştirme sunucusu da bunları gönderir, yerelde çalışan oyun
 * üretimde de çalışsın. `ekAtalar`: frame-ancestors'a eklenecek kökenler
 * (yerel önizleme).
 */
export function basliklar(ekAtalar = []) {
  const cikti = {};
  for (const { key, value } of sunucuBasliklari()) {
    let deger = value;
    if (key.toLowerCase() === 'content-security-policy' && ekAtalar.length) {
      deger = deger.replace(/frame-ancestors ([^;]*)/, (_, var_) => `frame-ancestors ${var_} ${ekAtalar.join(' ')}`);
    }
    cikti[key] = deger;
  }
  return cikti;
}

export function renkli(kod, metin) {
  return process.stdout.isTTY ? `\x1b[${kod}m${metin}\x1b[0m` : metin;
}
export const kirmizi = (m) => renkli(31, m);
export const yesil = (m) => renkli(32, m);
export const sari = (m) => renkli(33, m);
export const soluk = (m) => renkli(2, m);
