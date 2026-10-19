// lectii.js — lecțiile antrenorului și antrenamentele de final jucate contra motorului.
// Exemplele pentru fiecare lecție vin din exercițiile generate din partidele tale (aceeași temă).

export const SECTIUNI = [
  ["deschidere", "Deschideri"], ["mijloc", "Mijlocul jocului"], ["final", "Finaluri"],
];

export const LECTII = [
  { id: "principii", sect: "deschidere", titlu: "Cele cinci reguli ale deschiderii", teme: ["opening"],
    text: [
      "Primele zece mutări au un singur scop: să-ți aduci piesele în joc mai repede decât adversarul și să ai regele în siguranță.",
      "Ocupă centrul cu un pion (e4 sau d4) și controlează-l cu piesele. Câmpurile d4, e4, d5 și e5 dau pieselor cele mai multe mutări.",
      "Scoate caii și nebunii înaintea damei. O damă ieșită devreme devine țintă: adversarul o alungă câștigând timp cu fiecare piesă pe care o dezvoltă.",
      "Fă rocada devreme, de obicei în primele opt-zece mutări, și nu muta aceeași piesă de două ori fără un motiv concret.",
      "Când turele se văd una pe alta, dezvoltarea e gata. Abia atunci începe planul de mijloc de joc.",
      "Și cea mai importantă regulă de la nivelul tău: după fiecare mutare a adversarului întreabă-te ce amenință. Cele mai multe partide pierdute în deschidere vin dintr-o piesă lăsată neapărată, nu dintr-o teorie necunoscută.",
    ] },
  { id: "f7", sect: "deschidere", titlu: "Câmpurile slabe f7 și f2", teme: ["opening", "mate"],
    text: [
      "La început, f7 (pentru negru) și f2 (pentru alb) sunt apărate doar de rege. De aceea majoritatea atacurilor timpurii țintesc exact aceste câmpuri.",
      "Nebunul de pe c4 și dama sau calul care vin spre f7 formează cel mai frecvent atac: matul școlarului și variantele lui.",
      "Apărarea e simplă dacă o faci la timp: un cal pe f6 sau o mutare de pion care închide diagonala nebunului, apoi rocada.",
      "Când atacul tău pe f7 nu merge imediat, nu forța: dezvoltă restul pieselor. Un atac cu două piese contra unui rege bine apărat doar pierde timp.",
    ] },
  { id: "neaparate", sect: "mijloc", titlu: "Piesele neapărate cad", teme: ["hangingPiece"],
    text: [
      "Cea mai frecventă greșeală din partidele tale e o piesă lăsată fără apărare sau mutată pe un câmp atacat.",
      "Înainte de fiecare mutare fă o verificare de trei secunde: ce piese ale mele nu sunt apărate deloc? Ce atacă mutarea pe care vreau s-o fac? Ce poate lua adversarul după ea?",
      "Și invers: după fiecare mutare a adversarului caută piesele lui neapărate. Un cal sau un nebun lăsat liber e adesea câștigat cu o simplă furculiță sau un șah.",
      "Numără atacatorii și apărătorii unui câmp: dacă el are mai mulți atacatori decât ai tu apărători, piesa de acolo se pierde.",
    ] },
  { id: "furculita", sect: "mijloc", titlu: "Furculița", teme: ["fork"],
    text: [
      "O furculiță e o mutare care atacă două piese deodată. Adversarul poate salva doar una.",
      "Calul e piesa clasică de furculiță, pentru că sare și atacă câmpuri pe care piesele lungi nu le pot apăra ușor. Dar și pionul, nebunul, turnul sau dama pot face furculițe.",
      "Cele mai puternice furculițe includ un șah: regele trebuie să iasă din șah, iar a doua piesă cade.",
      "Caută-le când piesele adversarului stau pe câmpuri de aceeași culoare sau la distanță de un salt de cal unele de altele, și când regele lui e încă în centru.",
    ] },
  { id: "legare", sect: "mijloc", titlu: "Legarea", teme: ["pin"],
    text: [
      "O piesă e legată când nu se poate mișca fără să descopere o piesă mai valoroasă din spatele ei.",
      "Legarea absolută e de rege: piesa legată nici nu are voie să se miște. Legarea relativă e de damă sau de turn: piesa se poate mișca, dar pierzi ce era în spate.",
      "O piesă legată nu mai apără nimic cu adevărat. Atac-o încă o dată, de obicei cu un pion, și o câștigi.",
      "Când tu ești cel legat, ieși din legare din timp: mută regele sau pune o piesă între ele înainte ca adversarul să adune atacatorii.",
    ] },
  { id: "frigare", sect: "mijloc", titlu: "Frigarea", teme: ["skewer"],
    text: [
      "Frigarea e legarea pe dos: atacul lovește întâi piesa mai valoroasă, care trebuie să se mute, iar piesa din spatele ei cade.",
      "Apare mai ales cu nebunii, turele și dama pe diagonale și coloane deschise, iar cea mai des întâlnită e șahul care obligă regele să se mute și lasă dama sau turnul din spate.",
      "În finalurile de turnuri, frigarea e motivul pentru care regele nu trebuie lăsat pe aceeași linie cu propriul turn.",
    ] },
  { id: "descoperit", sect: "mijloc", titlu: "Atacul descoperit și șahul dublu", teme: ["discoveredAttack", "doubleCheck"],
    text: [
      "Când muți o piesă care stătea în fața unei piese lungi (nebun, turn, damă), descoperi un atac. Piesa mutată poate ataca la rândul ei altceva: două amenințări dintr-o singură mutare.",
      "Dacă atacul descoperit e un șah, piesa mutată poate face aproape orice, chiar și să ia dama, pentru că adversarul trebuie mai întâi să răspundă la șah.",
      "Șahul dublu, când și piesa mutată și cea descoperită dau șah, e cel mai puternic: singura apărare e mutarea regelui.",
    ] },
  { id: "ultima-linie", sect: "mijloc", titlu: "Matul pe ultima linie", teme: ["backRankMate", "mateIn1", "mateIn2"],
    text: [
      "Un rege care a făcut rocada stă în spatele a trei pioni. E în siguranță până când o tură sau dama adversă ajunge pe ultima linie.",
      "Verifică mereu: câte piese îmi apără ultima linie? Dacă turnul tău e singurul apărător și e atras sau schimbat, primești mat.",
      "Soluția e o „fereastră”: o mutare de pion (h3 sau g3, respectiv h6 sau g6) făcută într-un moment liniștit, care îi dă regelui un câmp de scăpare.",
      "Când adversarul nu are fereastră, caută șahurile pe ultima linie și sacrificiile care îi elimină apărătorul.",
    ] },
  { id: "plan", sect: "mijloc", titlu: "Cum îți faci un plan", teme: ["middlegame", "advantage"],
    text: [
      "Când nu există nimic tactic de calculat, ai nevoie de un plan pe trei-patru mutări, nu de mutări la întâmplare.",
      "Găsește-ți piesa cea mai pasivă și du-o pe un câmp mai bun. Adesea asta e tot planul.",
      "Pune turele pe coloanele deschise sau semideschise. O tură pe a șaptea linie e de obicei o problemă serioasă pentru adversar.",
      "Caută câmpuri pe care pionii adversarului nu le mai pot ataca (avanposturi) și instalează acolo un cal.",
      "Gândește-te la mutările de pion care deschid poziția acolo unde ai mai multe piese: atacul se dă pe flancul unde ești mai puternic.",
    ] },
  { id: "rege-activ", sect: "final", titlu: "Regele devine piesă de atac", teme: ["endgame", "pawnEndgame"], final: "pion_rege6",
    text: [
      "Când damele au ieșit de pe tablă, pericolul de mat dispare aproape complet. Regele devine o piesă puternică și trebuie adus în centru.",
      "Într-un final de pioni, regele care ajunge primul în fața pionilor adversari decide de obicei partida.",
      "Regula de bază pentru rege și pion contra rege: dacă regele tău stă pe a șasea linie în fața pionului (nu pe coloana a sau h), câștigi indiferent cine e la mutare.",
    ] },
  { id: "opozitie", sect: "final", titlu: "Opoziția", teme: ["pawnEndgame"], final: "opozitie2",
    text: [
      "Doi regi stau în opoziție când sunt pe aceeași coloană sau linie, cu un singur câmp între ei. Cine trebuie să mute atunci, cedează terenul.",
      "Cu rege și pion contra rege, scopul e să duci regele pe unul dintre câmpurile cheie, de regulă cele aflate cu două linii în fața pionului.",
      "Apărătorul încearcă să păstreze opoziția: răspunde la fiecare mutare a regelui atacator astfel încât regii să rămână față în față.",
      "Exersează ambele roluri: câștigarea opoziției cu albul și apărarea cu negrul.",
    ] },
  { id: "patrat", sect: "final", titlu: "Regula pătratului", teme: ["pawnEndgame", "advancedPawn"],
    text: [
      "Poate regele să prindă un pion liber? Imaginează-ți un pătrat cu o latură de la pion până la linia de promovare.",
      "Dacă regele care apără poate intra în acest pătrat cu mutarea lui, prinde pionul. Dacă nu, pionul promovează.",
      "Atenție la pionul de pe linia a doua: el poate avansa două câmpuri, deci pătratul se socotește de pe linia a treia.",
      "Regula te scutește de calcul în finalurile de pioni: te uiți la pătrat, nu numeri mutări.",
    ] },
  { id: "turnuri", sect: "final", titlu: "Lucena și Philidor", teme: ["rookEndgame"], final: "lucena",
    text: [
      "Cele două poziții pe care orice jucător de turnuri trebuie să le știe.",
      "Lucena (câștigă partea cu pionul): regele stă în fața propriului pion pe linia a opta, iar regele advers e tăiat de turn. Câștigul vine prin „construirea podului”: turnul merge pe a patra linie ca să oprească șahurile din lateral.",
      "Philidor (remiză pentru apărător): turnul apărătorului stă pe linia a șasea a atacatorului (a treia linie văzută de apărător) și nu lasă regele advers să înainteze. Când pionul ajunge pe a șasea, turnul trece în spate și dă șah de la distanță.",
      "Le exersezi pe amândouă contra motorului: Lucena cu albul, Philidor cu negrul.",
    ] },
  { id: "maturi", sect: "final", titlu: "Maturile de bază", teme: ["mate", "mateIn2"], final: "mat_dama",
    text: [
      "Mat cu dama: împinge regele spre margine cu dama la un salt de cal de el, apoi adu-ți regele. Atenție la pat: nu-i lua regelui toate câmpurile când nu e în șah.",
      "Mat cu două turnuri: turnurile urcă pe rând, ca pe o scară, și împing regele până pe ultima linie.",
      "Mat cu un turn: e nevoie de rege. Folosește opoziția regilor și turnul ca să tai câte o linie, apoi dă șahul final.",
      "Exersează-le contra motorului până le dai fără să te gândești: în partidele rapide fiecare secundă contează.",
    ] },
];

// Antrenamente de final jucate contra Stockfish. tinta: "mat", "promovare" sau "remiza".
export const FINALURI = [
  { id: "mat_dama", titlu: "Mat cu dama", nivel: "Ușor", fen: "8/8/8/4k3/8/8/8/4K2Q w - - 0 1", eu: "w", tinta: "mat", maxMut: 30,
    text: "Dă mat cu dama și regele. Împinge regele negru spre margine fără să-i dai pat." },
  { id: "mat_doua_turnuri", titlu: "Mat cu două turnuri", nivel: "Ușor", fen: "8/8/8/3k4/8/8/8/R3K2R w - - 0 1", eu: "w", tinta: "mat", maxMut: 20,
    text: "Folosește turnurile ca pe o scară: unul taie o linie, celălalt dă șah." },
  { id: "mat_turn", titlu: "Mat cu un turn", nivel: "Mediu", fen: "8/8/8/4k3/8/8/8/4K2R w - - 0 1", eu: "w", tinta: "mat", maxMut: 50,
    text: "Fără ajutorul regelui nu merge. Taie liniile cu turnul și folosește opoziția regilor." },
  { id: "pion_rege6", titlu: "Regele pe a șasea", nivel: "Ușor", fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", eu: "w", tinta: "promovare", maxMut: 30,
    text: "Regele tău e în fața pionului pe a șasea linie: câștigi indiferent cine mută. Promovează pionul." },
  { id: "opozitie2", titlu: "Câștigă opoziția", nivel: "Mediu", fen: "8/8/4k3/8/8/4K3/4P3/8 w - - 0 1", eu: "w", tinta: "promovare", maxMut: 30,
    text: "Rege și pion contra rege. Du regele înaintea pionului și câștigă opoziția, apoi promovează." },
  { id: "opozitie", titlu: "Ține opoziția cu negrul", nivel: "Mediu", fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1", eu: "b", tinta: "remiza", maxMut: 25,
    text: "Joci cu negrul. Poziția e remiză dacă păstrezi opoziția. Nu lăsa regele alb să treacă." },
  { id: "lucena", titlu: "Poziția Lucena", nivel: "Avansat", fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1", eu: "w", tinta: "promovare", maxMut: 30,
    text: "Rege, turn și pion contra rege și turn. Construiește podul și promovează pionul." },
  { id: "philidor", titlu: "Apărarea Philidor", nivel: "Avansat", fen: "4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1", eu: "b", tinta: "remiza", maxMut: 25,
    text: "Joci cu negrul. Ține turnul pe a șasea linie, iar când pionul înaintează, dă șahuri din spate." },
  { id: "mat_nebuni", titlu: "Mat cu doi nebuni", nivel: "Avansat", fen: "8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1", eu: "w", tinta: "mat", maxMut: 50,
    text: "Nebunii lucrează împreună ca un zid diagonal. Împinge regele într-un colț, cu ajutorul regelui tău." },
];

export const TEME_RO = {
  fork: "Furculiță", pin: "Legare", skewer: "Frigare", discoveredAttack: "Atac descoperit", doubleCheck: "Șah dublu",
  hangingPiece: "Piesă neapărată", trappedPiece: "Piesă prinsă", sacrifice: "Sacrificiu", deflection: "Deviere", attraction: "Atragere",
  clearance: "Eliberarea liniei", interference: "Interceptare", intermezzo: "Mutare intermediară", backRankMate: "Mat pe ultima linie",
  smotheredMate: "Mat sufocat", mate: "Mat", mateIn1: "Mat la o mutare", mateIn2: "Mat în 2", mateIn3: "Mat în 3", mateIn4: "Mat în 4",
  kingsideAttack: "Atac la rege", quietMove: "Mutare liniștită", defensiveMove: "Apărare", zugzwang: "Zugzwang", promotion: "Promovare",
  advancedPawn: "Pion avansat", opening: "Deschidere", middlegame: "Mijlocul jocului", endgame: "Final", rookEndgame: "Final de turnuri",
  pawnEndgame: "Final de pioni", queenEndgame: "Final de dame", bishopEndgame: "Final de nebuni", knightEndgame: "Final de cai",
  advantage: "Avantaj", crushing: "Câștig decisiv", equality: "Egalare", oneMove: "O mutare", short: "Scurt", long: "Lung", veryLong: "Foarte lung",
  attackingF2F7: "Atac pe f2/f7", exposedKing: "Rege expus", capturingDefender: "Eliminarea apărătorului", xRayAttack: "Raze X",
  discoveredCheck: "Șah descoperit", cornerMate: "Mat în colț", hookMate: "Mat cu cârlig", anastasiaMate: "Matul Anastasiei",
  arabianMate: "Matul arab", bodenMate: "Matul Boden", doubleBishopMate: "Mat cu doi nebuni", dovetailMate: "Mat în coadă de rândunică",
  enPassant: "En passant", castling: "Rocadă", underPromotion: "Subpromovare", queensideAttack: "Atac pe flancul damei",
  master: "Partide de maeștri", superGM: "Partide de mari maeștri",
};
// temele oferite la exercițiile Lichess (online)
export const TEME_LICHESS = ["fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "hangingPiece", "trappedPiece", "sacrifice",
  "deflection", "attraction", "intermezzo", "backRankMate", "smotheredMate", "mateIn1", "mateIn2", "mateIn3", "kingsideAttack", "attackingF2F7",
  "quietMove", "defensiveMove", "zugzwang", "promotion", "advancedPawn", "opening", "middlegame", "endgame", "rookEndgame", "pawnEndgame",
  "queenEndgame", "knightEndgame", "bishopEndgame"];

// ce să exersezi după tipul greșelii din partidă
export const TEME_DIN_TIP = {
  piesa_in_priza: ["hangingPiece"], piesa_neaparata: ["hangingPiece"], furculita: ["fork"],
  mat_permis: ["mateIn1", "mateIn2", "backRankMate", "mate"], mat_ratat: ["mateIn1", "mateIn2", "mate"],
  tactica_permisa: ["pin", "skewer", "discoveredAttack", "fork"], pion_pierdut: ["hangingPiece"],
  material_ratat: ["hangingPiece", "fork", "discoveredAttack", "pin"], atac_rege: ["kingsideAttack", "mate"],
  pat: ["endgame", "pawnEndgame"], tehnica_final: ["endgame", "rookEndgame", "pawnEndgame"], pozitional: ["middlegame", "advantage"],
};
export const FAZA_TEMA = { deschidere: "opening", mijloc: "middlegame", final: "endgame" };
