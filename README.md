# Șah local 4.0

Analiza partidelor tale de șah cu mentor, cursuri de deschideri și exerciții, cu aspectul inspirat de Chess.com.
Stockfish 19 rulează direct pe Mac sau pe iPhone; datele stau doar pe dispozitivul tău.

## Ce face

**Acasă** — ca pagina principală Chess.com: antrenamentul zilei, ultima partidă, lecția următoare la deschideri,
Istoria jocului (rezultat, precizie, mutări, dată), Puzzle-ul zilei, seria de zile și statisticile.

**Analiza partidei (cu mentor)**
- raportul partidei: precizia, clasificarea mutărilor (Genial … Gafă), evaluarea jocului, fazele și graficul;
- mentorul explică fiecare mutare: ce face, ce problemă creează (răspunsul adversarului și ce pierzi),
  ce era mai bun și de ce, plus un sfat practic pentru tipul de greșeală;
- „Lecțiile partidei”: greșelile care se repetă, unde ai ieșit din cursul de deschidere, faza cea mai slabă, ceasul;
- „Învață din greșeli”: reiei pe rând pozițiile în care ai greșit; „Încearcă din nou” la orice greșeală;
- explorare liberă: muți orice piesă, Stockfish răspunde și mentorul îți spune cât de bună e mutarea.

**Deschideri**
- Top 8 cursuri cu albul și Top 8 cu negrul (54 de capitole, inclusiv capcane), verificate cu Stockfish;
- „Învață”: săgeata îți arată mutarea și mentorul îți spune de ce se joacă;
- „Exersează”: joci din memorie; capitolele revin la recapitulare după 1, 3, 7, 14, 30 și 60 de zile;
- statistica ta pe fiecare curs și cursurile „prioritare” (unde ai scor mic);
- toate cele 3865 de linii din teorie, cu Stockfish live, și „Ce joci tu”.

**Dezlegări**
- exerciții noi pe nivelul tău, din partide reale, fără repetări (aplicația ține minte ce ai rezolvat);
- Puzzle Rush (3 minute, 3 greșeli), Puzzle-ul zilei, teme, exerciții Lichess online;
- exercițiile greșite revin după 1, 3, 7 și 14 zile, până le rezolvi din prima;
- după fiecare exercițiu, mentorul explică soluția.

**Învață** — greșelile tale pe faze și pe tipuri, 14 lecții, 9 finaluri contra Stockfish.
**Statistici** — ratingul în timp, rezultatele pe culori și deschideri, precizia pe faze, greșelile frecvente.

## Cum o publici pe GitHub Pages (pentru iPhone)

1. Pe github.com, în depozitul tău (de exemplu `sah`): Add file → Upload files.
2. Tragi toate fișierele din folder (Cmd+A) și apeși Commit changes.
3. După un minut, aplicația e la `https://UTILIZATOR.github.io/sah/`.
4. Pe iPhone: Safari → Partajează → „Adaugă pe ecranul principal”.

## Licențe

- Stockfish.js 19 — GPLv3 (vezi `COPYING-stockfish.txt`)
- chess.js — BSD 2-Clause (vezi `LICENSE-chessjs.txt`)
- deschiderile — lichess-org/chess-openings, CC0; exercițiile online — API-ul public Lichess
- piesele — setul cburnett, CC BY-SA 3.0
- Aspectul e inspirat de Chess.com. Aplicația nu e afiliată Chess.com și nu folosește logo-ul, pictogramele,
  piesele, sunetele sau imaginile lor; pictogramele și mentorul sunt desenate special pentru aplicație.
