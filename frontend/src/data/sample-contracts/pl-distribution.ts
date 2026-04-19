/**
 * SP-2 — Sample Polish commercial distribution agreement for the demo.
 *
 * Polish jurisdiction with explicit governing-law clause so Pass 0 returns
 * source_type="stated", country="PL". Drafted to exercise PL catalog entries
 * plus the EU Commercial Agents directive.
 *
 * SP-2 statute coverage:
 *   - PL_KC_484 (kara umowna judicial reduction) → §7 penalties: €50k for
 *     each breach of territorial exclusivity, €200k for breach of
 *     non-compete; §8 daily penalty for late reporting
 *   - PL_KC_471 (contractual liability baseline) → §6 limitation of
 *     liability clause that tries to exclude liability even for intentional
 *     breach
 *   - PL_KC_353_1 (public-order ceiling on autonomía) → §9 one-sided
 *     unilateral-termination right and §11 waiver of statutory protections
 *   - PL_KP_101_2 (post-termination non-compete) — not naturally applicable
 *     (commercial distribution, not employment); skipped
 *   - EU_DIR_86_653_EEC (commercial agents indemnity) → §10 termination
 *     compensation waiver — common Rome I / Ingmar-style risk
 *   - EU_GDPR → §12 data sharing between principal and distributor
 */

import type { UploadResponse } from "@/types";

export const PL_DISTRIBUTION_TEXT = `\
UMOWA DYSTRYBUCJI WYŁĄCZNEJ

Zawarta w dniu 18 kwietnia 2026 r. w Warszawie pomiędzy:

Baltic Components Sp. z o.o., spółką z ograniczoną odpowiedzialnością, \
wpisaną do rejestru przedsiębiorców Krajowego Rejestru Sądowego prowadzonego \
przez Sąd Rejonowy dla m.st. Warszawy w Warszawie, XIII Wydział Gospodarczy, \
pod numerem KRS 0000456789, NIP 5252468159, z siedzibą przy ul. Prostej 70, \
00-838 Warszawa, reprezentowaną przez pana Tomasza Kowalskiego, Prezesa \
Zarządu (zwaną dalej "Dostawcą"),

a

Handlowo-Dystrybucyjne Centrum Wschód S.A., spółką akcyjną wpisaną do \
Krajowego Rejestru Sądowego pod numerem KRS 0000612345, NIP 7832156987, z \
siedzibą przy ul. Piłsudskiego 25, 20-011 Lublin, reprezentowaną przez panią \
Annę Nowak, Członka Zarządu (zwaną dalej "Dystrybutorem"),

zwanymi dalej łącznie "Stronami", a każda z osobna "Stroną".

§ 1. PRZEDMIOT UMOWY

Na mocy niniejszej Umowy Dostawca przyznaje Dystrybutorowi wyłączne prawo do \
dystrybucji produktów wymienionych w Załączniku nr 1 ("Produkty") na \
terytorium Rzeczypospolitej Polskiej, a Dystrybutor zobowiązuje się do \
zakupu i odsprzedaży tych Produktów we własnym imieniu i na własny rachunek.

§ 2. OKRES OBOWIĄZYWANIA

Umowa zostaje zawarta na okres pięciu (5) lat, z możliwością przedłużenia o \
kolejne okresy roczne, chyba że którakolwiek ze Stron zawiadomi drugą o \
zamiarze nieprzedłużenia Umowy co najmniej dwanaście (12) miesięcy przed \
upływem bieżącego okresu.

§ 3. MINIMALNE ZOBOWIĄZANIA ZAKUPOWE

Dystrybutor zobowiązuje się do zakupu Produktów o łącznej wartości nie \
niższej niż dwa miliony euro (2.000.000 €) rocznie. Niedotrzymanie tego \
minimum uprawnia Dostawcę do jednostronnego rozwiązania Umowy ze skutkiem \
natychmiastowym.

§ 4. CENY I WARUNKI PŁATNOŚCI

Ceny Produktów wskazane są w Załączniku nr 2. Dostawca zastrzega sobie \
prawo do jednostronnej zmiany cennika z zachowaniem trzydziestodniowego \
(30) okresu wypowiedzenia, bez obowiązku uzasadniania takiej zmiany i bez \
prawa Dystrybutora do rozwiązania Umowy z tego tytułu. Płatność następuje \
w terminie czternastu (14) dni od daty wystawienia faktury.

§ 5. OBOWIĄZKI DYSTRYBUTORA

Dystrybutor zobowiązuje się do (i) aktywnej promocji Produktów na \
Terytorium, (ii) utrzymywania magazynu zapewniającego dostawy do klientów w \
terminie nie dłuższym niż czterdzieści osiem (48) godzin, (iii) \
miesięcznego raportowania sprzedaży w formacie wymaganym przez Dostawcę \
oraz (iv) zakazu dystrybucji konkurencyjnych produktów w trakcie \
obowiązywania Umowy i przez okres trzech (3) lat po jej zakończeniu, na \
całym Terytorium.

§ 6. ODPOWIEDZIALNOŚĆ

(1) Łączna odpowiedzialność Dostawcy z tytułu niniejszej Umowy, \
niezależnie od podstawy prawnej, jest ograniczona do równowartości rocznych \
opłat licencyjnych uiszczonych przez Dystrybutora w roku poprzedzającym \
wystąpienie szkody.

(2) Dostawca nie odpowiada za utracone korzyści, szkody pośrednie ani \
następcze, również w przypadku winy umyślnej lub rażącego niedbalstwa.

§ 7. KARY UMOWNE

(1) W przypadku naruszenia przez Dystrybutora zakazu dystrybucji \
konkurencyjnych produktów, o którym mowa w § 5 pkt (iv), Dystrybutor \
zapłaci Dostawcy karę umowną w wysokości dwustu tysięcy euro \
(200.000 €) za każde naruszenie.

(2) Za każde naruszenie wyłączności terytorialnej, o której mowa w § 1, \
Dystrybutor zapłaci Dostawcy karę umowną w wysokości pięćdziesięciu tysięcy \
euro (50.000 €) za każde stwierdzone naruszenie.

(3) Kary umowne kumulują się i nie wyłączają prawa Dostawcy do \
dochodzenia odszkodowania przewyższającego wysokość zastrzeżonych kar \
umownych. Dystrybutor zrzeka się prawa do żądania miarkowania kar umownych \
w postępowaniu sądowym.

§ 8. OBOWIĄZKI SPRAWOZDAWCZE

Dystrybutor zobowiązuje się do składania miesięcznych raportów sprzedaży do \
piątego (5) dnia roboczego każdego miesiąca. Za każdy dzień opóźnienia w \
złożeniu raportu Dystrybutor zapłaci karę umowną w wysokości pięciu tysięcy \
euro (5.000 €).

§ 9. ROZWIĄZANIE UMOWY

Dostawca ma prawo do jednostronnego rozwiązania Umowy w trybie \
natychmiastowym, bez zachowania okresu wypowiedzenia i bez obowiązku \
zapłaty jakiegokolwiek odszkodowania, w następujących przypadkach: \
(i) niedotrzymania minimum zakupowego określonego w § 3, \
(ii) opóźnienia płatności przekraczającego czternaście (14) dni, \
(iii) zmiany struktury właścicielskiej Dystrybutora, lub \
(iv) w każdym innym przypadku uznanym przez Dostawcę za naruszenie \
interesów handlowych Dostawcy.

§ 10. ODSZKODOWANIE PO ROZWIĄZANIU UMOWY

Strony wyraźnie postanawiają, że w przypadku rozwiązania Umowy — \
niezależnie od przyczyny — Dystrybutorowi nie przysługuje jakiekolwiek \
odszkodowanie, rekompensata, świadczenie wyrównawcze ani odszkodowanie za \
utracone korzyści, goodwill czy inwestycje poczynione w okresie \
obowiązywania Umowy. Niniejsze postanowienie stanowi wyczerpujące \
uregulowanie rozliczeń pomiędzy Stronami po rozwiązaniu Umowy.

§ 11. ZRZECZENIE SIĘ UPRAWNIEŃ

Dystrybutor zrzeka się wszelkich uprawnień, jakie mogłyby mu przysługiwać na \
podstawie bezwzględnie obowiązujących przepisów prawa polskiego lub \
europejskiego, w najszerszym zakresie dopuszczalnym przez prawo.

§ 12. OCHRONA DANYCH OSOBOWYCH

Strony zobowiązują się do przetwarzania danych osobowych zgodnie z \
Rozporządzeniem (UE) 2016/679 ("RODO"). W zakresie, w jakim Strony \
udostępniają sobie dane osobowe klientów końcowych, działają jako \
współadministratorzy, a szczegółowe zasady tego współadministrowania \
zostaną ustalone w odrębnym porozumieniu, którego brak nie wstrzymuje \
wykonywania niniejszej Umowy.

§ 13. PRAWO WŁAŚCIWE I JURYSDYKCJA

Niniejsza Umowa podlega prawu polskiemu. Wszelkie spory wynikające z lub \
związane z niniejszą Umową będą rozstrzygane wyłącznie przez sąd właściwy \
dla siedziby Dostawcy, tj. Sąd Okręgowy w Warszawie.

§ 14. POSTANOWIENIA KOŃCOWE

14.1 Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla \
każdej ze Stron.

14.2 Wszelkie zmiany Umowy wymagają formy pisemnej pod rygorem nieważności.

Warszawa, 18 kwietnia 2026 r.

Za Dostawcę                               Za Dystrybutora
Tomasz Kowalski                           Anna Nowak
Prezes Zarządu                            Członek Zarządu`;

export const PL_DISTRIBUTION_UPLOAD: UploadResponse = {
  filename: "umowa-dystrybucji-pl.pdf",
  file_type: "pdf",
  page_count: 5,
  extracted_text: PL_DISTRIBUTION_TEXT,
  char_count: PL_DISTRIBUTION_TEXT.length,
  text_source: "native",
};
