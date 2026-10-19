# Șah local

Analiza gratuită a partidelor tale de șah, ca Game Review de pe Chess.com, cu Stockfish 19 rulând direct pe Mac sau pe iPhone.

**Analiza (etapa 1):**
- aduce partidele de pe Chess.com (API public, fără cont și fără abonament);
- analizează fiecare partidă local, cu Stockfish 19 (WebAssembly), pe toate nucleele libere;
- clasifică fiecare mutare: Genial, Grozav, Cel mai bun, Excelent, Bun, Teorie, Inexactitate, Greșeală, Ratare, Gafă;
- arată acuratețea, Evaluarea partidei (rating estimat) și Statistici avansate: Deschidere, Combinații tactice, Strategie, Finaluri, cu cifrele deblocate;
- mutare cu mutare, ca pe Chess.com: antrenorul explică fiecare mutare, tabla arată mereu poziția de după mutare cu iconița clasei, săgeata verde arată ce trebuia jucat, iar cea albastră mutarea recomandată acum;
- butoanele antrenorului: Arată piesa pierdută / furculița / matul (continuarea care explică greșeala), Cea mai bună, Încearcă din nou, Amenințarea și Următoarea (sare la momentul cheie următor);
- explorare liberă: muți orice piesă (atingi sau tragi) și Stockfish îți arată pe loc cât de bună ar fi fost mutarea și cum continua partida;
- liniile motorului (primele 3, cu evaluare), redare automată, sunete și antrenorul care poate citi cu voce;
- merge și fără internet după prima deschidere; datele stau doar pe dispozitivul tău.

**Antrenorul (etapa 2):**
- după fiecare analiză: „Exersează: 10 exerciții din greșelile partidei” (pozițiile în care ai greșit, plus exerciții pe aceleași teme);
- antrenamentul recomandat, exerciții pe faze (deschidere, mijloc, final) și pe tipul de greșeală pe care îl faci cel mai des;
- 14 lecții (deschidere, mijloc, final), fiecare cu exemplu din partide reale și „Exersează tema · 10”;
- 9 finaluri jucate contra Stockfish: mat cu dama, cu turnuri, cu doi nebuni, opoziția, Lucena, Philidor;
- rating separat la exerciții, progres pe teme, indicii și soluții.

**Baza de date:**
- 1705 exerciții verificate cu Stockfish, extrase din partidele tale și ale adversarilor tăi (merg offline);
- exerciții Lichess pe orice temă și dificultate, aduse pe loc (cu internet);
- 3865 de linii de deschidere din teorie (setul Lichess), cu căutare și în română („siciliana najdorf”, „gambitul damei”);
- repertoriul tău: 51 de linii cu idei, planuri, capcane și statistici din partidele tale; „Exersează linia”: tu muți partea ta, aplicația răspunde;
- „Ce joci tu”: toate partidele tale grupate pe deschideri, cu scorul pe fiecare variantă.

**Muți tu, adversarul răspunde singur:** în analiză și la deschideri, când joci o mutare pe tablă (inclusiv mutarea recomandată), Stockfish răspunde automat pentru adversar, fără să mai apeși ›. Pe linia partidei, dacă iei piesa celui care tocmai a mutat, tabla revine la poziția dinainte, ca să joci tu mutarea mai bună. Se poate opri din Setări → „Adversarul răspunde singur când muți tu”.

## Cum o încerci pe Mac

```
cd ~/Downloads/sah-local
python3 -m http.server 8000
```
Apoi deschide http://localhost:8000 în Safari sau Chrome.

## Cum o publici pe GitHub Pages (pentru iPhone)

1. Pe github.com creezi un depozit nou, public, de exemplu `sah`.
2. Add file → Upload files și tragi tot conținutul acestui folder (inclusiv folderele `css`, `js`, `engine`, `data`, `icons`).
3. Settings → Pages → Build and deployment → Source: „Deploy from a branch”, Branch: `main`, folder `/ (root)` → Save.
4. După un minut aplicația e la `https://UTILIZATOR.github.io/sah/`.
5. Pe iPhone: deschizi adresa în Safari → Partajează → „Adaugă pe ecranul principal”. Pe Mac: Safari → Fișier → „Adaugă în Dock”.

## Licențe

- Stockfish.js 19 — GPLv3 (vezi `engine/COPYING-stockfish.txt`)
- chess.js — BSD 2-Clause (vezi `js/LICENSE-chessjs.txt`)
- deschiderile — lichess-org/chess-openings, CC0
- exercițiile online — API-ul public Lichess (baza de exerciții Lichess, CC0)
- piesele — setul cburnett, CC BY-SA 3.0
