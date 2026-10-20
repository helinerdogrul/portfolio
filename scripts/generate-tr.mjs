// Regenerate the checked-in Turkish page after editing index.html:
// node scripts/generate-tr.mjs
// Both routes are static HTML; the English homepage is always the default.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
let html = readFileSync(new URL('index.html', root), 'utf8');
// Keep the existing Turkish draft while its public route is temporarily paused.
if (!html.includes('<nav class="language-switch"')) {
  console.log('Turkish is offline. Existing tr/index.html draft preserved; generation skipped.');
  process.exit(0);
}
const title = 'Helin Erdoğrul | İstanbul’da Tasarımcı & Sanat Yönetmeni';
const description = 'Helin Erdoğrul, İstanbul merkezli tasarımcı ve sanat yönetmeni. Marka kimliği, editoryal tasarım, dijital deneyimler ve hareketli görüntü projelerini keşfedin.';

const translations = [
  ['<html lang="en">', '<html lang="tr">'],
  ['Helin Erdoğrul | Designer &amp; Art Director in Istanbul', title.replaceAll('&', '&amp;')],
  ['Helin Erdoğrul is an Istanbul-based designer and art director creating brand identities, editorial design, digital experiences, and moving image.', description],
  ['<link rel="canonical" href="https://www.helinerdogrul.com/">', '<link rel="canonical" href="https://www.helinerdogrul.com/tr/">'],
  ['property="og:url" content="https://www.helinerdogrul.com/"', 'property="og:url" content="https://www.helinerdogrul.com/tr/"'],
  ['property="og:locale" content="en_US"', 'property="og:locale" content="tr_TR"'],
  ['property="og:locale:alternate" content="tr_TR"', 'property="og:locale:alternate" content="en_US"'],
  ['Abstract blue, black and orange motion artwork from Helin Erdoğrul’s design portfolio', 'Helin Erdoğrul’un portfolyosundan mavi, siyah ve turuncu soyut hareketli görsel çalışma'],
  ['href="hero-poster.jpg"', 'href="../hero-poster.jpg"'],
  ['href="favicon.png"', 'href="../favicon.png"'],
  ['poster="hero-poster.jpg"', 'poster="../hero-poster.jpg"'],
  ['src="hero-optimized.mp4"', 'src="../hero-optimized.mp4"'],
  ['src="portrait-01.jpg"', 'src="../portrait-01.jpg"'],
  ['>Skip to content</a>', '>İçeriğe geç</a>'],
  ['aria-label="Language"', 'aria-label="Dil seçimi"'],
  ['<a href="/tr/" data-local-href="tr/index.html" lang="tr" hreflang="tr" aria-label="Türkçe">TR</a>', '<a href="/tr/" data-local-href="index.html" lang="tr" hreflang="tr" aria-label="Türkçe" aria-current="page">TR</a>'],
  ['<a href="/" data-local-href="index.html" lang="en" hreflang="en" aria-label="English" aria-current="page">EN</a>', '<a href="/" data-local-href="../index.html" lang="en" hreflang="en" aria-label="English">EN</a>'],
  ['aria-label="Helin Erdoğrul, back to top"', 'aria-label="Helin Erdoğrul, başa dön"'],
  ['aria-label="Main navigation"', 'aria-label="Ana menü"'],
  ['href="#works">Works</a>', 'href="#works">İşler</a>'],
  ['href="#about">About</a>', 'href="#about">Hakkımda</a>'],
  ['href="#contact">Contact</a>', 'href="#contact">İletişim</a>'],
  ['aria-label="Abstract motion artwork"', 'aria-label="Soyut hareketli görsel çalışma"'],
  ['aria-label="Introduction"', 'aria-label="Giriş"'],
  [`Working across design, moving image, and digital media to shape thoughtful
          visual narratives that connect ideas, culture, and emotion.`, 'Tasarım, hareketli görüntü ve dijital medyayı bir araya getirerek fikirleri, kültürü ve duyguları buluşturan özgün görsel anlatılar oluşturuyorum.'],
  ['id="works-title">Works</h2>', 'id="works-title">İşler</h2>'],
  ['Selected projects across art direction, identity, editorial design, and moving image.', 'Sanat yönetimi, marka kimliği, editoryal tasarım ve hareketli görüntü alanlarından seçili projeler.'],
  ['aria-label="Grid Studio on Instagram"', 'aria-label="Grid Studio’nun Instagram profili"'],
  ['aria-label="Turkish Towels on Instagram"', 'aria-label="Turkish Towels’ın Instagram profili"'],
  ['aria-label="Altun Architects website"', 'aria-label="Altun Architects web sitesi"'],
  ['aria-label="Adidas x Beckham project on Ördek"', 'aria-label="Ördek’teki Adidas x Beckham projesi"'],
  ['aria-label="Arise website"', 'aria-label="Arise web sitesi"'],
  ['aria-label="Wilson project website"', 'aria-label="Wilson projesinin web sitesi"'],
  ['aria-label="Motion and Generative Studies project folder"', 'aria-label="Hareketli görüntü ve üretken tasarım projeleri klasörü"'],
  ['aria-label="University Projects folder"', 'aria-label="Üniversite projeleri klasörü"'],
  ['>Speculative Art Direction</span>', '>Spekülatif Sanat Yönetimi</span>'],
  ['>Social Media Design &amp; Art Direction - at Kontra Creative</span>', '>Sosyal Medya Tasarımı &amp; Sanat Yönetimi - Kontra Creative’de</span>'],
  ['>Brand Identity / UX &amp; UI Design - at ördek.co</span>', '>Marka Kimliği / UX &amp; UI Tasarımı - ördek.co’da</span>'],
  ['>Retouching - at ördek.co</span>', '>Rötuş - ördek.co’da</span>'],
  ['>Visual Design / UI Design - at ördek.co</span>', '>Görsel Tasarım / UI Tasarımı - ördek.co’da</span>'],
  ['>Visual Design - at ördek.co</span>', '>Görsel Tasarım - ördek.co’da</span>'],
  ['>Motion &amp; Generative Studies</a>', '>Hareketli Görüntü &amp; Üretken Tasarım</a>'],
  ['>Creative Video Design</span>', '>Yaratıcı Video Tasarımı</span>'],
  ['>University Projects</a>', '>Üniversite Projeleri</a>'],
  ['>Design &amp; Production</span>', '>Tasarım &amp; Üretim</span>'],
  ['2026–Present</time>', '2026–Günümüz</time>'],
  ['2021–Present</time>', '2021–Günümüz</time>'],
  ['id="about-title">About</h2>', 'id="about-title">Hakkımda</h2>'],
  [`I’m Helin Erdoğrul, a designer and art director interested in creating visual worlds where
              ideas, culture, and emotion come together.`, 'Ben Helin Erdoğrul. Fikirlerin, kültürün ve duyguların bir araya geldiği görsel dünyalar yaratmaya odaklanan bir tasarımcı ve sanat yönetmeniyim.'],
  [`My practice moves across art direction, brand identity, editorial design, digital experiences,
              and moving image. I approach each project as a narrative system, exploring how image,
              typography, motion, and context can shape the way a story is experienced.`, 'Sanat yönetimi, marka kimliği, editoryal tasarım, dijital deneyimler ve hareketli görüntü alanlarında çalışıyorum. Her projeyi bir anlatı sistemi olarak ele alıyor; görüntünün, tipografinin, hareketin ve bağlamın bir hikâyenin deneyimlenme biçimini nasıl şekillendirdiğini araştırıyorum.'],
  [`Alongside commercial collaborations, I develop self-initiated projects that allow me to
              experiment with new formats and ways of seeing. I’m especially drawn to work that begins
              with curiosity and grows through research, observation, and visual experimentation.`, 'Markalarla iş birliklerimin yanı sıra yeni formatları ve görme biçimlerini keşfetmek için kişisel projeler geliştiriyorum. Merakla başlayıp araştırma, gözlem ve görsel deneylerle gelişen işlere özellikle ilgi duyuyorum.'],
  [`My process is guided by strong concepts, thoughtful details, and a desire to create work
              that feels both clear and unexpected.`, 'Sürecime güçlü fikirler, özenli detaylar ve hem anlaşılır hem de beklenmedik işler üretme isteği yön veriyor.'],
  ['              collaborations with\n', '              iş birlikleri\n'],
  ['aria-label="Selected clients"', 'aria-label="Seçili iş birlikleri"'],
  ['>EU-Funded Initiatives</span>', '>AB Destekli Girişimler</span>'],
  ['aria-label="Professional highlights"', 'aria-label="Mesleki deneyim ve ödüller"'],
  ['>Years of Practice</span>', '>Yıllık Deneyim</span>'],
  ['>Awwwards<br>Honorable Mention</span>', '>Awwwards<br>Mansiyon Ödülü</span>'],
  ['>Move to explore</span>', '>Hareket ettir, keşfet</span>'],
  ['alt="Helin Erdoğrul wearing a red striped shirt and leaning on a dark green sofa"', 'alt="Kırmızı çizgili gömlekle koyu yeşil koltuğa yaslanan Helin Erdoğrul"'],
  ['>Let’s create something<br>meaningful together</h2>', '>Birlikte anlamlı<br>işler üretelim</h2>'],
  ['>Istanbul x Turkiye</span>', '>İstanbul x Türkiye</span>'],
  ['>Back to top</a>', '>Başa dön</a>']
];

for (const [source, translated] of translations) {
  if (!html.includes(source)) {
    throw new Error(`Update the Turkish translation for missing source text: ${source}`);
  }
  html = html.replaceAll(source, translated);
}

html = html.replace(/(<script type="application\/ld\+json">)\s*([\s\S]*?)(\s*<\/script>)/, (match, open, source, close) => {
  const data = JSON.parse(source);
  const page = data['@graph'].find((entry) => entry['@type'] === 'WebPage');
  const person = data['@graph'].find((entry) => entry['@type'] === 'Person');
  page['@id'] = 'https://www.helinerdogrul.com/tr/#webpage';
  page.url = 'https://www.helinerdogrul.com/tr/';
  page.name = title;
  page.description = description;
  page.inLanguage = 'tr';
  person.jobTitle = ['Tasarımcı', 'Sanat Yönetmeni'];
  person.description = 'Marka kimliği, editoryal tasarım, dijital deneyimler ve hareketli görüntü alanlarında çalışan tasarımcı ve sanat yönetmeni.';
  person.homeLocation.name = 'İstanbul';
  person.knowsAbout = ['Sanat yönetimi', 'Marka kimliği', 'Editoryal tasarım', 'UX ve UI tasarımı', 'Hareketli görüntü', 'Sosyal medya tasarımı'];
  return `${open}\n    ${JSON.stringify(data, null, 2).replaceAll('\n', '\n    ')}\n  </script>`;
});

mkdirSync(new URL('tr/', root), { recursive: true });
writeFileSync(new URL('tr/index.html', root), html);
console.log('Generated tr/index.html from the English source and Turkish translations.');
