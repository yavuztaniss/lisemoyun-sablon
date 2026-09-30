# Lisem Oyun — oyun şablonu

**lisem.com.tr/oyun**'da yayımlanacak bir oyun yapmak istiyorsan buradan
başla. Bu depo bir şablon: kendi deponu açarsın, oyununu orada yazarsın,
hazır olunca bize başvurursun. Dosya göndermek, e-posta atmak yok.

Oyunlar tarayıcıda çalışan küçük HTML/JavaScript oyunlarıdır: indirme yok,
üyelik yok. Lisem beğendiği oyunu kendi oyun sunucusuna alır ve sitede
yayımlar.

## 1. Kendi deponu aç

Bu sayfanın üstünde **Use this template → Create a new repository**.

- Depon **açık** ya da **gizli** olabilir. Gizli tutarsan oyunun yayımlanana
  kadar kimse görmez.
- Gizliyse: deponda **Settings → Collaborators → Add people** →
  **`yavuztaniss`**. İnceleyebilmemiz için gerekli.

## 2. Oyununu yaz

Bilgisayarında **Node.js 20 ya da üstü** kurulu olmalı. Başka bir şey
kurman gerekmiyor.

```bash
npm run yeni -- kelime-avi "Kelime Avı"   # oyunlar/kelime-avi/ oluşur
npm run dev                               # http://localhost:4401
```

`npm run dev` iki şey açar:

- **http://localhost:4401** — önizleme. Oyununu lisem.com.tr'deki
  oynatıcının aynısında, aynı kısıtlarla açar. Burada çalışıyorsa sitede de
  çalışır. Masaüstü, telefon dikey ve telefon yatay ölçüleri var.
- **http://127.0.0.1:4400** — yerel oyun sunucusu.

Oyunun `oyunlar/<oyun-adi>/1/` klasöründe durur ve `index.html` ile açılır.
Şablon oyun (`sablon/`) en küçük eksiksiz örnektir: oku, sonra kendi
oyununla değiştir.

## 3. Kurallar

Oyun lisem.com.tr'de **kısıtlı bir çerçevede**, ayrı bir adresten çalışır.
Bu yüzden bazı şeyler çalışmaz. Kısaca:

- `localStorage`, çerez ve IndexedDB yok. Okumak bile hata verir.
  En iyi skoru site tutar; sen yalnızca skoru gönderirsin.
- Dışarıya istek yok: CDN'den kütüphane, dış görsel, yazı tipi, analitik
  yüklenmez. Ne gerekiyorsa klasörüne koy.
- Satır içi `<script>`, `<style>`, `onclick="…"` ve `eval` çalışmaz.
- `alert`, açılır pencere ve dış bağlantı çalışmaz.
- Yüklenince `LisemOyun.hazir()` çağrılmalı; 20 saniye içinde gelmezse
  site "Oyun yüklenemedi" der. El bitince `LisemOyun.skor(n)` çağrılır.
- Klavye ve dokunmatik ekranla oynanmalı; telefonda da çalışmalı.
- Kişisel veri istenmez. Reklam, sohbet, skor tablosu, satın alma yok.
  İçerik okul ortamına uygun olmalı.
- Başka bir oyunun ya da markanın adı, logosu ve karakteri kullanılmaz.

Ayrıntılar ve nedenleri: [`CLAUDE.md`](CLAUDE.md). Bir yapay zekâ
asistanıyla çalışıyorsan ona da bu dosyayı okut.

## 4. oyun.json'u doldur

`oyunlar/<oyun-adi>/oyun.json` oyunun vitrin bilgisidir:

| alan | ne yazılır |
|---|---|
| `baslik` | oyunun adı (2–60 karakter) |
| `ozet` | vitrindeki tek cümle (en fazla 160) |
| `nasil_oynanir` | kısa tarif (en fazla 600) |
| `kategori` | `aksiyon` · `bulmaca` · `spor` · `strateji` · `simulasyon` |
| `yon` | `yatay` ya da `dikey` (telefonda nasıl tutuluyor) |
| `gelistirici` | **Lisem kullanıcı adın** (lisem.com.tr/u/… adresindeki ad) |
| `anonim` | `true`: sitede adın görünmez. Kim yaptığını yalnızca Lisem bilir |
| `kapak_alt` | kapak görselini anlatan kısa cümle |
| `surum` | başvurduğun sürüm klasörü (`"1"`) |

Klasöre bir de **`kapak.jpg`** koy (1600 × 1000, önemli kısım ortada).

## 5. Denetle

```bash
npm run check    # dosyalara bakar: kurallara aykırı bir şey varsa nedenini yazar
npm run dene     # oyunu gerçek bir tarayıcıda açıp sınar (isteğe bağlı, Playwright ister)
```

Her gönderimde GitHub da `npm run check`i kendiliğinden koşar (Actions).

## 6. Başvur

Bu şablon deposunda: **Issues → New issue → Oyun başvurusu**.

Başvuru herkese açık görünür. Oraya telefon, e-posta, okul gibi kişisel
bilgi yazma. Lisem kullanıcı adını da oraya değil, deponda `oyun.json`a yaz.

## Sonra ne olur

1. Oyununu oynarız, kodunu okuruz. Sorumuz olursa başvurunun altına yazarız.
2. Beğenirsek oyunu Lisem'in oyun sunucusuna alır, lisem.com.tr/oyun'da
   yayımlarız.
3. **İmza:** Anonim seçmediysen ve Lisem profilin açıksa adın oyun
   sayfasında, vitrinde ve profilindeki "Oyunları" bölümünde görünür.
   Oynanma sayısı, beğeni ve sıralama yok.
4. **Güncelleme:** Yeni sürüm için `oyunlar/<oyun-adi>/2/` klasörünü aç
   (yayındaki sürüme dokunulmaz) ve başvurunun altına yaz.
5. **Kaldırma:** Oyununun kaldırılmasını istersen başvurunun altına yazman
   yeterli.

## Lisans

Bu şablondaki SDK, araçlar ve marka dosyaları yalnızca Lisem Oyun'a oyun
yapmak içindir. Lisem adı ve logosu Lisem'indir: oyununda kullanmadan önce
başvuruda sor. Yazı tipleri Inter ve Baloo 2, SIL Open Font License 1.1
kapsamındadır (`paylasilan/marka/1/fontlar/LISANS.md`). Oyununun kodu
senindir.
