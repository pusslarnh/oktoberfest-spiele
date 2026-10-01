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
    { artist: 'Alphaville', title: 'Forever Young', year: 1984, fact: 'Tyskt band från Münster, trots det engelska namnet och den engelska texten.' },
    { artist: 'Kraftwerk', title: 'Das Model', year: 1978, fact: 'Från Düsseldorf. Utan dem finns varken house, techno eller elektropop.' },
    { artist: 'Scorpions', title: 'Wind of Change', year: 1990, fact: 'Skriven efter en resa till Moskva och blev ljudspåret till Berlinmurens fall.' },
    { artist: 'Snap!', title: 'Rhythm Is a Dancer', year: 1992, fact: 'Eurodance från Frankfurt. Två tyska producenter som hyrde in sina sångare.' },
    { artist: 'The Killers', title: 'Human', year: 2008, fact: 'Spelades i tysk version: Thomas Anders, Modern Talkings sångare, med Menschen från 2018.' },
    { artist: 'The Monkees', title: 'I’m a Believer', year: 1966, fact: 'Spelades i tysk version: Frühstücks-Beat med Mit all deiner Liebe. Originalet är skrivet av Neil Diamond.' },
    { artist: 'Britney Spears', title: '…Baby One More Time', year: 1998, fact: 'Spelades i tysk version: a cappella-gruppen Wise Guys från Köln med Baby noch einmal. Skriven av svenske Max Martin.' },
    { artist: 'Billy Joel', title: 'Piano Man', year: 1973, fact: 'Spelades i tysk version: tjeckiskan Helena Vondráčková med Die Nachtbar från 1979.' },
    { artist: 'Radiohead', title: 'Creep', year: 1992, fact: 'Spelades i tysk version: Gunter Gabriel, Tysklands egen Johnny Cash, med Ich bin ein Nichts från 2009.' },
    { artist: 'Alanis Morissette', title: 'Ironic', year: 1996, fact: 'Spelades i tysk version: Queen Bee, Ina Müllers komikerduo, som gjorde om den till Sylt.' },
    { artist: 'Cher', title: 'Believe', year: 1998, fact: 'Spelades i tysk version: Wise Guys gjorde om den till karnevalslåten Do you believe (in Kölle Alaaf).' },
    { artist: 'Johnny Cash', title: 'Ring of Fire', year: 1963, fact: 'Spelades i tysk version: Jonny Hill med Ein Ring aus Feuer. Originalet är skrivet av June Carter och Merle Kilgore.' },
    { artist: 'Gotye feat. Kimbra', title: 'Somebody That I Used to Know', year: 2011, fact: 'Spelades i tysk version: schweiziska a cappella-gruppen Bliss med Eini woni gärn ha gha, på schweizertyska.' },
    { artist: 'Kenny Rogers', title: 'The Gambler', year: 1978, fact: 'Spelades i tysk version: Volker Lechtenbrink med Der Spieler. Texten ligger mycket nära originalet.' },
    { artist: 'Evie Sands', title: 'Angel of the Morning', year: 1967, fact: 'Spelades i tysk version: Juliane Werding med Der Engel der Verbannten. Godkänn även Merrilee Rush (1968) och Juice Newton (1981), som gjorde den till hit.' },
  ] satisfies SongAnswer[],
  tiebreak: {
    answer: 11,
    accept: [11],
    note: 'Elva: nummer 9 till 19 är tyska versioner av utländska original. Närmast utan att gå över vinner vid lika poäng.',
  },
};
