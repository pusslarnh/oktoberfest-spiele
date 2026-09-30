// Facit till meningsquizet och musikquizet.
// Ligger utanför public/ så att bara servern kan läsa det. Webbläsaren får det via
// /api/facit, och bara med rätt PIN. Ordningen måste följa QUIZ och MUSIC i public/grenar.js.

export interface QuizAnswer { sv: string; note?: string }
export interface SongAnswer { artist: string; title: string; year: number; fact: string }

export const FACIT = {
  quiz: [
    { sv: 'En öl, tack!' },
    { sv: 'Var ligger toaletten?' },
    { sv: 'Jag är hungrig som en björn.', note: 'Varg på svenska går lika bra.' },
    { sv: 'Korven är för varm.' },
    { sv: 'Min bror dansar på bordet.' },
    { sv: 'Det angår inte mig, det är inte mitt bord.', note: 'Ordagrant: det är inte min öl.' },
    { sv: 'Jag fattar ingenting.', note: 'Ordagrant: jag förstår bara järnvägsstation.' },
    { sv: 'Hunden har ätit upp min kringla.' },
    { sv: 'Skål, mina vänner!' },
    { sv: 'Jag orkar inte dricka mer.' },
    { sv: 'Du ser inte vad som händer framför näsan på dig.', note: 'Ordagrant: du har tomater på ögonen.' },
    { sv: 'I morgon har jag huvudvärk.' },
    { sv: 'Kyparen kommer med tio sejdlar öl.', note: 'Ein Maß rymmer exakt en liter.' },
    { sv: 'Hur mycket kostar ölen?' },
    { sv: 'Mina skinnbyxor är för trånga.' },
    { sv: 'Livet är ingen dans på rosor.', note: 'Ordagrant: livet är ingen ponnygård.' },
    { sv: 'Blåsorkestern spelar för högt.' },
    { sv: 'Nu kör vi, nu drar det igång!' },
  ] satisfies QuizAnswer[],
  bonus: {
    sv: 'En skål för gemytligheten.',
    note: 'Skålsången som spelas i varje öltält i München, ungefär var tjugonde minut hela kvällen.',
  } satisfies QuizAnswer,
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
  ] satisfies SongAnswer[],
  tiebreak: {
    answer: 4,
    accept: [4, 5],
    note: 'Fyra: nummer 1, 3, 11 och 12. Godkänn fem om laget räknar in Falco, som blandar tyska och engelska. Närmast utan att gå över vinner vid lika poäng.',
  },
};
