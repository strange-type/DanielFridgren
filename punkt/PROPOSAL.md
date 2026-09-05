# Punkt — todo-app inspirerad av Things

Status: **Namn och datalagring beslutade.** Inget appkod byggt än.

- Namn: **Punkt**
- Datalagring: samma repo (`punkt/data/tasks.md`), skrivet via en
  Netlify function. Netlify-builden för fridgren.se hoppas över när en
  commit bara rör den mappen (se `netlify.toml`, `[build].ignore`).

## 1. Bantad funktionslista (v1)

Fyra vyer, ingen GTD, inga "areas":

- **Inbox** — nya uppgifter utan datum/kategori hamnar här.
- **Today** — dagens uppgifter + ev. schemalagda för idag. Stjärnmarkering
  som i Things är trevlig men inte nödvändig för v1.
- **Upcoming** — kommande uppgifter grupperade per datum.
- **Logbook** — avklarade uppgifter, grupperade per dag (senaste överst).

Per uppgift (minimalt fältset):
- Titel (obligatorisk)
- Anteckning (valfri fritext)
- `when`: idag / specifikt datum / someday (utan eget datum)
- `deadline` (valfri flagga/datum, separat från `when` precis som i Things)
- Klarmarkerad + tidsstämpel

Medvetet **bort** från v1: areas/projects, taggar, checklistor inom
uppgifter, upprepning, natural-language-datumparsing. Allt går att lägga
till senare om det visar sig behövas — men klarar man sig utan är appen
mycket enklare att bygga och underhålla.

## 2. Datalagring — markdown i repot, med ignore-regel

Beslutat: data ligger i det här repot (`punkt/data/tasks.md`),
skrivet via en serverless-funktion som committar till GitHub (samma
mönster som `netlify/functions/contact.js` redan använder mot SendGrid).

För att slippa att varje bock-i-ruta triggar en ny Netlify-build av
**fridgren.se** har `netlify.toml` fått en `ignore`-regel:

```toml
[build]
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':!punkt/data'"
```

Kommandot diffar allt *utom* `punkt/data` mellan senast byggda
commit och den nya. Är den diffen tom (inga ändringar utanför
datamappen) hoppar Netlify över builden. Så fort en ändring rör
sajtkod, layout eller annat utanför datamappen körs builden som vanligt.

**En skrivare i taget.** En serverless-funktion bör vara enda
instansen som skriver till filen (läs → ändra → committa), så att inte
två enheter råkar skriva samtidigt och skapar en merge-konflikt. Med en
ensam användare (du) är detta ett litet problem, men värt att bygga in
från start ändå.

Filen har en enda `## Tasks`-sektion — Inbox/Today/Upcoming/Logbook
räknas fram i appen från `when`/`done`, uppgifterna flyttas alltså inte
mellan sektioner i filen. Format:

```markdown
## Tasks

- [ ] Handla mjölk (id: 1725500000000-a1b2c)
- [ ] Skicka faktura (id: 1725500000001-d3e4f, when: 2026-09-10, deadline: 2026-09-06)
  > Kom ihåg kvitto
- [x] Träna (id: 1725400000000-x9y8z, done: 2026-09-04T18:32:00.000Z)
```

Appen parsar/skriver filen i detta format. Enkelt att läsa direkt i
GitHub, enkelt att versionshantera, enkelt att flytta ut ur appen om du
byter verktyg senare.

## 3. iOS-notiser utan native app

Web push fungerar på iOS **om** sajten är tillagd på hemskärmen
("Lägg till på hemskärm"), sedan iOS 16.4 (mars 2023). Krav:
- Manifest + service worker (gör sajten till en installerbar PWA)
- Push-prenumeration sparas per enhet, notiser skickas via en
  serverless-funktion med VAPID-nycklar (`web-push`-biblioteket)
- Fungerar **inte** i en vanlig Safari-flik som inte lagts till på
  hemskärmen — måste installeras som app-ikon.
- iOS 18.4 (Safari) förenklade detta med "Declarative Web Push" (kräver
  inte service worker för själva pushen).
- Notis: EU hade en period 2024 där DMA-regler stängde av standalone-läge
  för PWA:er (och därmed push), men Apple rullade tillbaka det. Värt att
  dubbelkolla läget för din region innan notiser byggs, men det bör
  fungera i Sverige idag.

Slutsats: en PWA med web push täcker sannolikt ditt behov för
`deadline`/tids-påminnelser utan att du behöver bygga en native iOS-app.

Källor:
- https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- https://www.mobiloud.com/blog/progressive-web-apps-ios/
- https://developer.apple.com/forums/thread/697024

## 4. Teknisk stack (förslag)

Konsekvent med hur du redan jobbar i det här repot:
- **Astro** för UI (samma som fridgren.se), i det här repot
- **Netlify Functions** för att läsa/skriva `tasks.md` via GitHub API och
  för web-push
- **PWA**: manifest.json + service worker, `astro-pwa`-liknande setup
  eller handskriven service worker (litet scope, inte mycket att vinna på
  ett stort PWA-ramverk)

## 5. Namn: Punkt

Svenska för "period/prick" — en uppgift, en punkt att bocka av. Kort,
lätt att säga, matchar den avskalade känslan.

## 7. Säkerhet och synlighet

Punkt ligger på samma domän (fridgren.se) men ska varken synas för
sökmotorer eller vara öppen för andra än dig. Byggt in:

- `robots.txt` (via `astro-robots`) disallowar `/punkt`.
- Sitemapen exkluderar `/punkt/*` (filter i `@astrojs/sitemap`).
- Sidan har `<meta name="robots" content="noindex, nofollow">`.
- `netlify.toml` sätter `X-Robots-Tag: noindex, nofollow`,
  `X-Frame-Options: DENY` och `Referrer-Policy: no-referrer` på
  `/punkt/*` och på API-funktionen, samt `Cache-Control: no-store` på
  API-svaren.
- Åtkomst till appen och API:t kräver en delad hemlighet
  (`PUNKT_ACCESS_TOKEN`) som skickas i en header och jämförs
  konstant-tid (`crypto.timingSafeEqual`) för att undvika
  timing-attacker.
- Netlify-funktionen har enkel rate limiting per IP (max 30
  anrop/minut) för att bromsa brute-force-gissning av hemligheten.
- GitHub-skrivåtkomsten sker via en egen token (`PUNKT_GITHUB_TOKEN`) —
  använd en fine-grained personal access token begränsad till just det
  här repot med enbart "Contents: Read and write".

Det här är rimlig säkerhet för ett personligt enanvändarverktyg, men
inte samma nivå som en riktig inloggning (t.ex. Netlify Identity/OAuth).
Om appen ska nås av fler än dig, eller innehålla känsligare data, är
det värt att byta ut den delade hemligheten mot riktig autentisering.

## 8. Driftsättning — miljövariabler

Lägg till i Netlifys site settings (Environment variables):

| Variabel | Krävs | Beskrivning |
|---|---|---|
| `PUNKT_ACCESS_TOKEN` | Ja | Valfri lång slumpad hemlighet du själv väljer — din "lösenkod" för appen. |
| `PUNKT_GITHUB_TOKEN` | Ja | Fine-grained GitHub PAT med `Contents: Read and write` scopat till `strange-type/DanielFridgren`. |
| `PUNKT_GITHUB_OWNER` | Nej | Default `strange-type`. |
| `PUNKT_GITHUB_REPO` | Nej | Default `DanielFridgren`. |
| `PUNKT_GITHUB_BRANCH` | Nej | Default `main` — vilken branch datafilen läses/skrivs mot. |
| `PUNKT_DATA_PATH` | Nej | Default `punkt/data/tasks.md`. |

## 9. Nästa steg

1. ~~Du väljer namn.~~ ✅ Punkt
2. ~~Bestäm var data ska bo.~~ ✅ Samma repo + `netlify.toml`-ignore
3. ~~Grundskelett: vyer, Netlify function, PWA-manifest, säkerhet.~~ ✅
   Klart för granskning i PR:en.
4. Sätt miljövariablerna ovan i Netlify, testa i produktion.
5. Web push som separat steg när grundflödet funkar i praktiken.
