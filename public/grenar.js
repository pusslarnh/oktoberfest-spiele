// Grenar och poängregler enligt Oktoberfest-quizpaketet (3 oktober).
// Delas mellan webbläsaren och servern.

export const WIN_POINTS = 3;
export const PART_POINTS = 1;

export const LEKAR = [
  {
    id: 'masskrug', icon: '🍺', sv: 'Sejdelhållning', de: 'Masskrugstemmen',
    desc: 'Fylld literssejdel hålls i rak arm, handflatan uppåt, armen parallell med golvet. Sänks armen eller spills det, är man ute. Klassikern från Theresienwiese.',
    kit: 'Sejdel, vatten, tidtagarur',
  },
  {
    id: 'hammer', icon: '🔨', sv: 'Spika i stubben', de: 'Hammerschlagen',
    desc: 'Alla får varsin spik i en vedklabb. Man slår bara med hammarens smala klyvände. Först ner med spiken vinner, och den som böjer sin spik får en minuspoäng.',
    kit: 'Vedklabb, spikar, hammare',
    penalty: { label: 'Böjd spik', value: -1 },
  },
  {
    id: 'fingerhakeln', icon: '☝️', sv: 'Fingerbrottning', de: 'Fingerhakeln',
    desc: 'Två personer krokar långfingret i varandras över bordet och drar. Den som dras över mittlinjen förlorar. Lägg en handduk under armarna, det går fort.',
    kit: 'Ett stadigt bord',
  },
  {
    id: 'bierdeckel', icon: '🎯', sv: 'Underläggssnärt', de: 'Bierdeckel schnippen',
    desc: 'Lägg ölunderlägg så att halva sticker ut över bordskanten. Snärta upp och fånga i luften med samma hand. Bygg på med ett underlägg i taget.',
    kit: 'Ölunderlägg',
  },
  {
    id: 'brezel', icon: '🥨', sv: 'Kringelgalgen', de: 'Brezelschnappen',
    desc: 'Häng kringlor i snören i huvudhöjd. Händerna bakom ryggen, den som ätit upp sin kringla först vinner. Sätt snörena på olika höjd så det blir rättvist.',
    kit: 'Kringlor, snöre, en list eller kvast',
  },
  {
    id: 'stiefel', icon: '👢', sv: 'Stövelkastning', de: 'Gummistiefelweitwurf',
    desc: 'En gummistövel kastas så långt det går, utomhus. Två försök var, bästa kastet räknas. Mät med stegräkning så slipper du måttbandet.',
    kit: 'Gummistövel, plats utomhus',
  },
  {
    id: 'kellner', icon: '🍻', sv: 'Brickstafett', de: 'Kellnerlauf',
    desc: 'Bär en bricka med fyra fyllda glas runt en bana med en sväng och en tröskel. Tiden gäller, plus fem sekunders tillägg för varje glas som spills.',
    kit: 'Bricka, glas, något att runda',
  },
  {
    id: 'stoldans', icon: '🪑', sv: 'Schlagerstoldans', de: 'Reise nach Jerusalem',
    desc: 'Stoldans till tysk schlager. Musiken stoppas mitt i refrängen, och den som blir utan stol sjunger nästa refräng högt för alla. Funkar bäst sent på kvällen.',
    kit: 'Stolar, högtalare',
  },
  {
    id: 'zungen', icon: '👅', sv: 'Tungvrickning', de: 'Zungenbrecher',
    desc: 'Tre tyska tungvrickare ska sägas tre gånger i rad utan att snubbla. Publiken avgör om det godkänns.',
    kit: 'Tungvrickarna nedan',
    twisters: [
      { de: 'Fischers Fritz fischt frische Fische.', sv: 'Fiskaren Fritz fiskar färsk fisk.' },
      { de: 'Zehn zahme Ziegen zogen zehn Zentner Zucker zum Zoo.', sv: 'Tio tama getter drog ett halvt ton socker till zoo.' },
      { de: 'Blaukraut bleibt Blaukraut und Brautkleid bleibt Brautkleid.', sv: 'Rödkål förblir rödkål och brudklänning förblir brudklänning.' },
    ],
  },
  {
    id: 'tracht', icon: '👗', sv: 'Bäst klädd', de: 'Trachtenschau',
    desc: 'Catwalk för lederhosen, dirndl och allt hemmasnickrat. Publiken röstar med applåder. Ge pris även till den mest långsökta tolkningen av tysk folkdräkt.',
    kit: 'Fri golvyta, en jury',
  },
  {
    id: 'verboten', icon: '🤫', sv: 'Förbjudna ordet', de: 'Verbotenes Wort',
    desc: 'Hela kvällen heter det Bier, aldrig öl. Den som säger fel ord och blir påkommen bjuder nästa runda. Avslöja regeln när första gästen kliver in.',
    kit: 'Inget alls',
  },
  {
    id: 'prosit', icon: '🥂', sv: 'Skålritualen', de: 'Ein Prosit',
    desc: 'Var tjugonde minut spelas Ein Prosit der Gemütlichkeit. Alla reser sig, skålar med sina grannar och sätter sig igen. Den som missar skålen får minuspoäng.',
    kit: 'Låten, och en klocka',
    penalty: { label: 'Missad skål', value: -1 },
  },
];

export const QUIZ = {
  id: 'meningar', icon: '📝', sv: 'Vad betyder meningen?', de: 'Frågesport',
  desc: 'Skriv den svenska betydelsen av varje mening. De som är märkta med ★ är talesätt, så översätt vad de betyder, inte ord för ord. Halv poäng för nästan rätt, rättaren bestämmer.',
  kit: 'Blatt 2 och facit (blatt 3)',
  max: 20,
  bonusPoints: 2,
  sentences: [
    { de: 'Ein Bier, bitte!', sv: 'En öl, tack!' },
    { de: 'Wo ist die Toilette?', sv: 'Var ligger toaletten?' },
    { de: 'Ich habe Hunger wie ein Bär.', sv: 'Jag är hungrig som en björn.', note: 'Varg på svenska går lika bra.' },
    { de: 'Die Wurst ist zu heiß.', sv: 'Korven är för varm.' },
    { de: 'Mein Bruder tanzt auf dem Tisch.', sv: 'Min bror dansar på bordet.' },
    { de: 'Das ist nicht mein Bier.', idiom: true, sv: 'Det angår inte mig, det är inte mitt bord.', note: 'Ordagrant: det är inte min öl.' },
    { de: 'Ich verstehe nur Bahnhof.', idiom: true, sv: 'Jag fattar ingenting.', note: 'Ordagrant: jag förstår bara järnvägsstation.' },
    { de: 'Der Hund hat meine Brezel gefressen.', sv: 'Hunden har ätit upp min kringla.' },
    { de: 'Prost, meine Freunde!', sv: 'Skål, mina vänner!' },
    { de: 'Ich kann nicht mehr trinken.', sv: 'Jag orkar inte dricka mer.' },
    { de: 'Du hast Tomaten auf den Augen.', idiom: true, sv: 'Du ser inte vad som händer framför näsan på dig.', note: 'Ordagrant: du har tomater på ögonen.' },
    { de: 'Morgen habe ich Kopfschmerzen.', sv: 'I morgon har jag huvudvärk.' },
    { de: 'Der Kellner bringt zehn Maß Bier.', sv: 'Kyparen kommer med tio sejdlar öl.', note: 'Ein Maß rymmer exakt en liter.' },
    { de: 'Wie viel kostet das Bier?', sv: 'Hur mycket kostar ölen?' },
    { de: 'Meine Lederhose ist zu eng.', sv: 'Mina skinnbyxor är för trånga.' },
    { de: 'Das Leben ist kein Ponyhof.', idiom: true, sv: 'Livet är ingen dans på rosor.', note: 'Ordagrant: livet är ingen ponnygård.' },
    { de: 'Die Blaskapelle spielt zu laut.', sv: 'Blåsorkestern spelar för högt.' },
    { de: 'Jetzt geht’s los!', sv: 'Nu kör vi, nu drar det igång!' },
  ],
  bonus: {
    de: 'Ein Prosit der Gemütlichkeit!',
    sv: 'En skål för gemytligheten.',
    note: 'Skålsången som spelas i varje öltält i München, ungefär var tjugonde minut hela kvällen.',
  },
};

export const MUSIC = {
  id: 'musik', icon: '🎵', sv: 'Musikquiz', de: 'Tolv Lieder',
  desc: 'Varje låt spelas i trettio sekunder. Skriv artist och låttitel, ett poäng för vardera. Alla tolv har en tysk koppling, även de som sjungs på engelska. Byt blankett med ett annat lag vid rättningen. Stavfel ger poäng ändå.',
  kit: 'Blatt 4, högtalare och facit (blatt 5)',
  max: 25,
  songs: [
    { artist: 'Nena', title: '99 Luftballons', year: 1983, fact: 'Sjungs på tyska. Handlar om nittionio ballonger som misstas för ett kärnvapenanfall.' },
    { artist: 'Modern Talking', title: 'You’re My Heart, You’re My Soul', year: 1984, fact: 'Duo från Berlin. Falsettstämman är producenten Dieter Bohlen, inte frontfiguren.' },
    { artist: 'Rammstein', title: 'Du hast', year: 1997, fact: 'Ordvitsen är att du hast och du hasst låter likadant, du har och du hatar.' },
    { artist: 'Falco', title: 'Rock Me Amadeus', year: 1985, fact: 'Österrikare från Wien, och den enda tyskspråkiga etta som USA-listan haft.' },
    { artist: 'Kraftwerk', title: 'Das Model', year: 1978, fact: 'Från Düsseldorf. Utan dem finns varken house, techno eller elektropop.' },
    { artist: 'Trio', title: 'Da Da Da', year: 1982, fact: 'Nya tyska vågen i sin renaste form, byggd på ett billigt Casiotangentbord.' },
    { artist: 'Scorpions', title: 'Wind of Change', year: 1990, fact: 'Skriven efter en resa till Moskva och blev ljudspåret till Berlinmurens fall.' },
    { artist: 'Snap!', title: 'Rhythm Is a Dancer', year: 1992, fact: 'Eurodance från Frankfurt. Två tyska producenter som hyrde in sina sångare.' },
    { artist: 'Alphaville', title: 'Forever Young', year: 1984, fact: 'Tyskt band från Münster, trots det engelska namnet och den engelska texten.' },
    { artist: 'Lou Bega', title: 'Mambo No. 5', year: 1999, fact: 'Född i München. Melodin är lånad från en kubansk instrumentallåt från 1949.' },
    { artist: 'DJ Ötzi', title: 'Anton aus Tirol', year: 1999, fact: 'Sjungs på tyska. Spelas i öltälten varje kväll, alla kan refrängen efter en gång.' },
    { artist: 'Helene Fischer', title: 'Atemlos durch die Nacht', year: 2013, fact: 'Sjungs på tyska. Nutidens största schlager, den självklara avslutningen.' },
  ],
  tiebreak: {
    q: 'Hur många av de tolv låtarna sjungs på tyska?',
    answer: 4,
    accept: [4, 5],
    note: 'Fyra: nummer 1, 3, 11 och 12. Godkänn fem om laget räknar in Falco, som blandar tyska och engelska. Närmast utan att gå över vinner vid lika poäng.',
  },
};

export const ALL_GRENAR = [...LEKAR, QUIZ, MUSIC];
export const GREN_IDS = ALL_GRENAR.map((g) => g.id);
export const LEK_IDS = LEKAR.map((g) => g.id);
export const MAX_LEKAR = LEKAR.length * WIN_POINTS;
export const MAX_TOTAL = MAX_LEKAR + QUIZ.max + MUSIC.max;
