# Punkt — todo-app inspirerad av Things

Status: **Namn och datalagring beslutade.** Inget appkod byggt än.

- Namn: **Punkt**
- Datalagring: samma repo (`Notes/punkt/data/tasks.md`), skrivet via en
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

Beslutat: data ligger i det här repot (`Notes/punkt/data/tasks.md`),
skrivet via en serverless-funktion som committar till GitHub (samma
mönster som `netlify/functions/contact.js` redan använder mot SendGrid).

För att slippa att varje bock-i-ruta triggar en ny Netlify-build av
**fridgren.se** har `netlify.toml` fått en `ignore`-regel:

```toml
[build]
  ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ':!Notes/punkt/data'"
```

Kommandot diffar allt *utom* `Notes/punkt/data` mellan senast byggda
commit och den nya. Är den diffen tom (inga ändringar utanför
datamappen) hoppar Netlify över builden. Så fort en ändring rör
sajtkod, layout eller annat utanför datamappen körs builden som vanligt.

**En skrivare i taget.** En serverless-funktion bör vara enda
instansen som skriver till filen (läs → ändra → committa), så att inte
två enheter råkar skriva samtidigt och skapar en merge-konflikt. Med en
ensam användare (du) är detta ett litet problem, men värt att bygga in
från start ändå.

Markdown fungerar bra som **källa**, t.ex.:

```markdown
## Inbox
- [ ] Handla mjölk

## Today (2026-09-05)
- [ ] Skicka faktura #deadline:2026-09-06
- [x] Träna (klar 08:12)
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

## 6. Nästa steg

1. ~~Du väljer namn.~~ ✅ Punkt
2. ~~Bestäm var data ska bo.~~ ✅ Samma repo + `netlify.toml`-ignore
3. Sätt upp grundskelett: vyer (Inbox/Today/Upcoming/Logbook),
   markdown-läsning/skrivning via en Netlify function, PWA-manifest.
4. Web push som separat steg när grundflödet funkar.
