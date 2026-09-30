# Lisem Oyun şablonu — oyun kuralları

Bu depo **lisem.com.tr/oyun**'a oyun yapmak içindir. Oyun, Lisem'in oyun
sunucusundan kısıtlı bir çerçeveyle sitenin oyun sayfasına gömülür. Aşağıdaki
kurallar o çerçevede gerçek tarayıcılarda ÖLÇÜLMÜŞ kısıtlardan gelir. Uymayan
oyun sitede çalışmaz ya da yayına alınmaz. `npm run check` çoğunu otomatik
yakalar.

Kaynak: Lisem'in özel oyun deposu (`lisemoyun`). Bu dosya oradaki
`kit/CLAUDE.md`den eşitlenir; burada elle değiştirme.

---

## Kurallar

1. **Oyun kısıtlı çerçevede, AYRI kökende çalışır** (`sandbox="allow-scripts"`
   + sunucunun `Content-Security-Policy: sandbox allow-scripts; default-src 'self'`
   başlığı). Oyun "null" kökenle çalışır. Bunun sonuçları:

   - `localStorage`, `sessionStorage`, IndexedDB ve `document.cookie`e
     **okumak bile** `SecurityError` fırlatır. Skoru localStorage'a yazan
     tipik bir klon açılışta ÇÖKER. En iyi skoru SAYFA tutar.
   - `alert`, `confirm` ve `prompt` yok sayılır. Açılır pencere, dış
     bağlantı, `target=_blank/_top` ve form gönderimi engelli.
   - Dışarıya istek YOK. Betik, stil, yazı tipi, görsel ve `fetch` yalnızca
     kendi klasöründen gelir. CDN'den kütüphane yüklenmez, dosyası klasöre
     konur. İzleme, analitik ve reklam kodu çalışamaz.
   - Satır içi `<script>`, `<style>`, `style="…"`, `onclick="…"`, `eval` ve
     `new Function` ÇALIŞMAZ. Kod `.js` dosyasına, stil `.css` dosyasına
     yazılır.
   - `new Worker('dosya.js')` açılmaz; `blob:` worker açılır.
   - `SharedArrayBuffer` ve çok iş parçacıklı dışa aktarımlar (Godot 4,
     Unity) yok. Tek iş parçacıklı dışa aktarım kullanılır.

2. **Sözleşme SDK'dan geçer:** `/sdk/1/lisem-oyun.js`. `index.html` onu
   MUTLAK yoldan, kendi betiğinden önce bağlar. Oyun iki şey söyler:

   - `LisemOyun.hazir()` **ZORUNLU**, 20 saniye içinde. Yazı tipleri ve
     görseller yüklendikten sonra çağrılır.
   - `LisemOyun.skor(n)`: bir el bitince çağrılır; tam sayı, 0 ile 1e9
     arası.

   Diğer yardımcılar: `LisemOyun.tuval()` (tuvali iki eksene göre ölçekler),
   `LisemOyun.renk('--p-pink')`, `LisemOyun.yaziTipleri()`,
   `LisemOyun.hareketiAzalt()`. `paylasilan/` klasörüne DOKUNULMAZ:
   sitede senin kopyan değil Lisem'inki kullanılır. Değiştirirsen
   `npm run check` durur.

3. **Dosyalar:**
   - Oyun `oyunlar/<oyun-adi>/<sürüm>/` içinde yaşar; giriş sayfası
     `index.html`.
   - Oyunun kendi dosyaları GÖRELİ yolla bağlanır; mutlak yol yalnızca
     `/sdk/N/` ve `/marka/N/` için.
   - İzinli türler: html css js mjs json txt svg png jpg webp gif woff2
     mp3 ogg wav m4a wasm.
   - Tek dosya en fazla 5 MB, bir sürüm en fazla 20 MB. 5 MB'ın üstü
     telefonda yavaş açılır.
   - Hazır kütüphaneler (Phaser vb.) `kutuphane/` klasörüne konur ve
     lisansları açık kaynak olmalı.
   - Derleyici (Vite, TypeScript) kullanırsan kaynak
     `oyunlar/<oyun-adi>/kaynak/` klasöründe durur. Derleme çıktısı sürüm
     klasörüne konur; Vite'ta `base: './'`.

4. **Oynanış:**
   - Oyun klavyeyle VE dokunmatik ekranla oynanır. SDK yüklenince boşluk,
     ok tuşları ve PageDown sayfayı kaydırmaz.
   - Ölçek iki eksene göre kurulur (`LisemOyun.tuval()`). Oyun her iki
     yönde de açılabilmeli; telefonda "Oyna" tam ekran açar.
   - Odak kaybedince (`blur`) ve sekme gizlenince oyun DURAKLAR.
   - "Hareketi azalt" açıksa sarsıntı ve parlama olmaz.
   - Ses varsa kapatma düğmesi olur ve SOL ÜSTTE durur. Sağ üst köşe
     sitenin "Kapat" düğmesinin yeri.
   - `pointerdown`da `preventDefault()` çağrılmaz, yoksa çerçeve odağını
     kaybeder. Kaydırmayı ve yakınlaştırmayı CSS `touch-action: none` kapatır.

5. **Kitle 13–20 yaş.**
   - Oyun kişisel veri İSTEMEZ: ad, okul, yaş, konum, fotoğraf, kamera ve
     mikrofon yok.
   - Sohbet, kullanıcı içeriği, paylaşım düğmesi, skor tablosu, sıralama,
     reklam ve uygulama içi satın alma yok.
   - İçerik okul ortamına uygun olmalı: şiddet, korku ve kumar (ganimet
     kutusu dahil) yok.

6. **Kimlik:** Başka bir oyunun ya da markanın adı, logosu ve karakteri
   kullanılmaz. Mekanik serbest; ad ve görsel senin olmalı. Lisem'in
   renkleri ve yazı tipleri serbest (`/marka/1/marka.css`). Lisem adı ve
   logosu için önce başvuruda sor.

7. **Sürüm:** Başvurduğun sürüm klasörü (`1/`) kabul edilince değişmez.
   Güncelleme yeni klasördür (`2/`).

## Komutlar

```bash
npm run yeni -- kelime-avi "Kelime Avı"   # yeni oyun
npm run dev                               # önizleme http://localhost:4401
npm run check                             # kurallar
npm run dene -- kelime-avi                # gerçek tarayıcıda deneme (Playwright ister)
```
