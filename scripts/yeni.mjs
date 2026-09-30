#!/usr/bin/env node
/**
 * YENİ OYUN — `npm run yeni -- <oyun-adi> "Oyunun Adı"`
 *
 * `sablon/`u `oyunlar/<oyun-adi>/`e kopyalar ve oyun.json'a adı yazar.
 * Oyun adı sitedeki adres olur: lisem.com.tr/oyun/<oyun-adi>.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AYRILMIS_ADLAR, OYUNLAR, OYUN_ADI_RE, SABLON, kirmizi, soluk, yesil } from './ortak.mjs';

const [ad, ...baslikParcalari] = process.argv.slice(2);
const baslik = baslikParcalari.join(' ').trim();

if (!ad || !OYUN_ADI_RE.test(ad) || ad.length < 3 || ad.length > 60 || AYRILMIS_ADLAR.has(ad)) {
  console.log(`${kirmizi('Kullanım:')} npm run yeni -- <oyun-adi> "Oyunun Adı"`);
  console.log(soluk('  oyun-adi: küçük harf, rakam, tire; 3–60 karakter (ör. kelime-avi)'));
  process.exit(1);
}
const hedef = join(OYUNLAR, ad);
if (existsSync(hedef)) {
  console.log(`${kirmizi('HATA')} oyunlar/${ad} zaten var`);
  process.exit(1);
}

cpSync(SABLON, hedef, { recursive: true });
const bilgiYolu = join(hedef, 'oyun.json');
const bilgi = JSON.parse(readFileSync(bilgiYolu, 'utf8'));
bilgi.baslik = baslik || ad;
writeFileSync(bilgiYolu, `${JSON.stringify(bilgi, null, 2)}\n`);

const html = join(hedef, '1', 'index.html');
writeFileSync(html, readFileSync(html, 'utf8').replace(/<title>[^<]*<\/title>/, `<title>${bilgi.baslik}</title>`));

console.log(`${yesil('✓')} oyunlar/${ad}/ hazır`);
console.log(soluk(`  npm run dev → http://localhost:4401/#${ad}/1`));
