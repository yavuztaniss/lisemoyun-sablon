#!/usr/bin/env node
/**
 * DENEME — `npm run dene [-- <oyun>[/<sürüm>]] [--kapak]`
 *
 * Oyunu GERÇEK bir tarayıcıda, lisem.com.tr'deki koşullarla açar ve
 * sözleşmeyi sınar. `npm run check` dosyalara bakar; bu betik oyunu
 * ÇALIŞTIRIR:
 *
 *   • önizlemede (kısıtlı çerçeve + üretim başlıkları) "hazır" 20 sn içinde
 *     geliyor mu, konsolda hata ya da CSP ihlali var mı
 *   • boşluk / oklar / PageDown SAYFAYI kaydırıyor mu
 *   • birkaç saniye oynanınca bir skor mesajı geliyor mu (bilgi)
 *   • telefon dikey ve yatay ölçüde açılıyor mu
 *   • adres DOĞRUDAN açılınca (çerçevesiz) hata veriyor mu, WebAssembly
 *     derleniyor mu (sunucu başlıkları)
 *
 * Ekran görüntüleri `.dene/<oyun>-<sürüm>-*.png`. `--kapak`: oyunu
 * `?kapak` ile 1600 × 1000 açıp `oyunlar/<oyun>/kapak.jpg`i yazar (oyun
 * kapak sahnesini destekliyorsa — Lisem Bird'deki gibi).
 *
 * Playwright gerekir (depoya eklenmez, isteğe bağlı):
 *   npm i --no-save playwright && npx playwright install chromium
 * Başka yerde kuruluysa: PLAYWRIGHT_MODULE=/yol/playwright/index.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sunuculariBaslat } from './dev.mjs';
import { KOK, kirmizi, oyunlar, sari, soluk, yesil } from './ortak.mjs';

async function playwright() {
  const adaylar = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  for (const aday of adaylar) {
    try {
      return await import(aday);
    } catch {
      // bir sonraki aday
    }
  }
  console.log(`${kirmizi('✗ Playwright yok')} — deneme KOŞMADI.`);
  console.log(soluk('  npm i --no-save playwright && npx playwright install chromium'));
  process.exit(1);
}

const argumanlar = process.argv.slice(2);
const kapakIste = argumanlar.includes('--kapak');
const secim = argumanlar.find((a) => !a.startsWith('--'));
const CIKTI = join(KOK, '.dene');
mkdirSync(CIKTI, { recursive: true });

const hedefler = [];
for (const oyun of oyunlar()) {
  for (const s of oyun.surumler) {
    if (secim && secim !== oyun.ad && secim.replace(/\/$/, '') !== `${oyun.ad}/${s}`) continue;
    hedefler.push({ ad: oyun.ad, surum: s, bilgi: oyun.bilgi });
  }
}
if (!hedefler.length) {
  console.log(`${kirmizi('✗')} "${secim}" diye bir oyun yok`);
  process.exit(1);
}

const { chromium } = await playwright();
const sunucu = await sunuculariBaslat({ oyunPort: 4410, onizlemePort: 4411, sessiz: true });
const tarayici = await chromium.launch();
const sorunlar = [];

function sonuc(etiket, tamam, ayrinti = '') {
  console.log(`  ${tamam ? yesil('✓') : kirmizi('✗')} ${etiket}${ayrinti ? soluk(` — ${ayrinti}`) : ''}`);
  if (!tamam) sorunlar.push(`${etiket}${ayrinti ? ` (${ayrinti})` : ''}`);
}

async function hazirBekle(sayfa) {
  const baslangic = Date.now();
  await sayfa.waitForFunction(
    () => ['tamam', 'hata'].includes(document.getElementById('hazir')?.dataset.durum ?? ''),
    null,
    { timeout: 25000 },
  );
  const durum = await sayfa.getAttribute('#hazir', 'data-durum');
  return { tamam: durum === 'tamam', ms: Date.now() - baslangic };
}

for (const h of hedefler) {
  const on = `${h.ad}-${h.surum}`;
  console.log(`\n${h.bilgi?.baslik ?? h.ad} ${soluk(`(${h.ad}/${h.surum}/)`)}`);

  const baglam = await tarayici.newContext({ viewport: { width: 1280, height: 900 } });
  const sayfa = await baglam.newPage();
  const hatalar = [];
  sayfa.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(m.text());
  });
  sayfa.on('pageerror', (e) => hatalar.push(e.message));

  // 1. Önizleme: kısıtlı çerçeve + "hazır"
  await sayfa.goto(`${sunucu.onizlemeKokeni}/#${h.ad}/${h.surum}`);
  const hazir = await hazirBekle(sayfa);
  sonuc('"hazır" 20 sn içinde geldi', hazir.tamam, `${(hazir.ms / 1000).toFixed(1)} sn`);
  await sayfa.waitForTimeout(600);
  await sayfa.locator('#sahne').screenshot({ path: join(CIKTI, `${on}-1-baslik.png`) });

  // 2. Tuşlar sayfayı kaydırmamalı. Önce çerçeveye bir kez tıklanır (gerçek
  //    ziyaretçi gibi); sonra tuşlar.
  const kutu = await sayfa.locator('#sahne iframe').boundingBox();
  await sayfa.mouse.click(kutu.x + kutu.width / 2, kutu.y + kutu.height / 2);
  for (const tus of ['Space', 'ArrowDown', 'PageDown', 'ArrowUp', 'Space']) {
    await sayfa.keyboard.press(tus);
    await sayfa.waitForTimeout(120);
  }
  const kayma = await sayfa.evaluate(() => window.scrollY);
  sonuc('boşluk / oklar / PageDown sayfayı kaydırmıyor', kayma === 0, `scrollY ${kayma}`);

  // 3. Biraz oyna, skor gelir mi? (bilgi — skorsuz oyun olabilir)
  const bitis = Date.now() + 9000;
  let skor = '—';
  while (Date.now() < bitis) {
    skor = (await sayfa.textContent('#skor')) ?? '—';
    if (skor !== '—') break;
    await sayfa.waitForTimeout(300);
  }
  await sayfa.waitForTimeout(900);
  await sayfa.locator('#sahne').screenshot({ path: join(CIKTI, `${on}-2-oynadiktan-sonra.png`) });
  console.log(`  ${skor !== '—' ? yesil('✓') : sari('·')} skor mesajı ${skor !== '—' ? `geldi (${skor})` : 'gelmedi (9 sn)'}`);
  const tanınmayan = await sayfa.locator('#gunluk li[data-tur="hata"]').allTextContents();
  sonuc('tanınmayan mesaj yok', tanınmayan.length === 0, tanınmayan.join(' | '));

  // 4. Telefon ölçüleri
  for (const [dugme, ad] of [['telefon-dikey', '3-telefon-dikey'], ['telefon-yatay', '4-telefon-yatay']]) {
    await sayfa.click(`[data-sahne="${dugme}"]`);
    const t = await hazirBekle(sayfa);
    sonuc(`${dugme.replace('-', ' ')}: hazır`, t.tamam);
    await sayfa.waitForTimeout(600);
    await sayfa.locator('#sahne').screenshot({ path: join(CIKTI, `${on}-${ad}.png`) });
  }
  sonuc('konsolda hata / CSP ihlali yok', hatalar.length === 0, hatalar.slice(0, 3).join(' | '));
  await baglam.close();

  // 5. Adres doğrudan açılınca (çerçevesiz; CSP sandbox yine geçerli)
  const dogrudan = await tarayici.newContext({ viewport: { width: 420, height: 760 } });
  const ds = await dogrudan.newPage();
  const dHatalar = [];
  ds.on('console', (m) => {
    if (m.type() === 'error') dHatalar.push(m.text());
  });
  ds.on('pageerror', (e) => dHatalar.push(e.message));
  await ds.goto(`${sunucu.oyunKokeni}/${h.ad}/${h.surum}/index.html`);
  await ds.waitForTimeout(1500);
  const koken = await ds.evaluate(() => self.origin);
  sonuc('doğrudan açılınca köken "null" (CSP sandbox başlığı)', koken === 'null', koken);
  // `.wasm` izinli tür: sunucu başlıkları (script-src 'wasm-unsafe-eval')
  // derlemeye izin vermeli. Küçük bir modül: add(a, b).
  const wasm = await ds.evaluate(async () => {
    const bayt = [0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 127, 127, 1, 127, 3, 2, 1, 0, 7, 7, 1, 3, 97, 100, 100, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 106, 11];
    try {
      return String((await WebAssembly.instantiate(new Uint8Array(bayt))).instance.exports.add(2, 3));
    } catch (e) {
      return `${e.name}: ${e.message}`;
    }
  });
  sonuc("WebAssembly derleniyor (CSP 'wasm-unsafe-eval')", wasm === '5', wasm === '5' ? '' : wasm.slice(0, 160));
  sonuc('doğrudan açılınca hata yok', dHatalar.length === 0, dHatalar.slice(0, 3).join(' | '));
  await dogrudan.close();

  // 6. Kapak
  if (kapakIste) {
    const kb = await tarayici.newContext({ viewport: { width: 1600, height: 1000 } });
    const kp = await kb.newPage();
    await kp.goto(`${sunucu.oyunKokeni}/${h.ad}/${h.surum}/index.html?kapak`);
    await kp.evaluate(() => document.fonts.ready);
    await kp.waitForTimeout(800);
    const dosya = join(KOK, 'oyunlar', h.ad, 'kapak.jpg');
    writeFileSync(dosya, await kp.screenshot({ type: 'jpeg', quality: 90 }));
    console.log(`  ${yesil('✓')} kapak → oyunlar/${h.ad}/kapak.jpg ${soluk('(1600 × 1000)')}`);
    await kb.close();
  }
}

await tarayici.close();
await sunucu.kapat();

console.log(`\n${soluk(`ekran görüntüleri: .dene/`)}`);
if (sorunlar.length) {
  console.log(kirmizi(`✗ ${sorunlar.length} sorun`));
  process.exit(1);
}
console.log(yesil('✓ deneme temiz'));
