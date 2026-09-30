# Oktoberfest Spiele 🍺

En live-poängtavla för Oktoberfest den 3 oktober. Tavlan följer quizpaketets regler:

| Gren | Poäng |
| --- | --- |
| 12 lekar (Masskrugstemmen, Hammerschlagen, Fingerhakeln, Bierdeckel schnippen, Brezelschnappen, Gummistiefelweitwurf, Kellnerlauf, Reise nach Jerusalem, Zungenbrecher, Trachtenschau, Verbotenes Wort, Ein Prosit) | **3p** för vinst, **1p** för deltagande. Minuspoäng för böjd spik (Hammerschlagen) och missad skål (Ein Prosit), −1p per gång |
| Meningsquiz (blatt 2) | 18 meningar × 1p, där halv poäng går bra, plus bonus 2p. Max **20p** |
| Musikquiz (blatt 4) | 12 låtar × (artist 1p + låt 1p) plus utslagsfråga 1p. Max **25p** |

Vid lika totalpoäng avgör utslagsfrågan: den som är närmast 4 utan att gå över vinner. Svaret 5 godkänns också.

## Sidor

- **Topplista**: pallen och övriga lag. Den är gjord för storskärm och uppdateras live. Knappen *Storskärm* växlar till helskärm.
- **Poängutdelning**: domarbordet. Här finns flikar per gren, snabbknappar och facit till quizen, utrop till salen och en händelselogg.
- **Deltagare & Lag**: lägg till, redigera, pausa och ta bort lag. Här kan du också ladda ner en säkerhetskopia eller nollställa.
- **Grenar & Regler**: alla regler, tungvrickarna och hur långt kvällen har kommit.

Alla enheter som har sidan öppen synkas direkt, till exempel domarens mobil och tv:n i vardagsrummet.

## Kör med Docker

### Alternativ 1: bygg direkt från GitHub (inget att klona)

```bash
docker build -t oktoberfest-spiele https://github.com/pusslarnh/oktoberfest-spiele.git#main
docker run -d --name oktoberfest -p 8080:3000 -v oktoberfest-data:/data oktoberfest-spiele
```

### Alternativ 2: färdig image från GitHub Container Registry

Workflowet i `.github/workflows/docker.yml` bygger och publicerar en image vid varje push till `main`:

```bash
docker run -d --name oktoberfest -p 8080:3000 -v oktoberfest-data:/data ghcr.io/pusslarnh/oktoberfest-spiele:latest
```

> Första gången: gå till repot på GitHub, sedan **Packages → oktoberfest-spiele → Package settings**, och gör paketet *Public*. Annars måste du köra `docker login ghcr.io` först.

### Alternativ 3: docker compose

```bash
git clone https://github.com/pusslarnh/oktoberfest-spiele.git
cd oktoberfest-spiele
docker compose up -d
```

Öppna sedan **http://localhost:8080**. Från andra enheter i nätverket använder du `http://<datorns-ip>:8080`.

## Inställningar

| Miljövariabel | Standard | Beskrivning |
| --- | --- | --- |
| `ADMIN_PIN` | *(tom)* | Om du sätter en PIN kan bara den som anger den dela ut poäng. Alla kan fortfarande titta. |
| `PORT` | `3000` | Porten inuti containern. |
| `DATA_DIR` | `/data` | Här sparas `state.json`. Montera en volym så att poängen överlever en omstart. |

Exempel: `docker run -e ADMIN_PIN=1516 ...`

## Utveckling utan Docker

Du behöver Node 24 eller senare. Det finns inga beroenden att installera.

```bash
npm start      # http://localhost:3000
npm run dev    # startar om automatiskt vid ändringar
```

Servern (`server.ts`) är TypeScript och körs direkt av Node. Grenarna, facit och poängreglerna finns i `public/grenar.js`, och där ändrar du om du vill byta frågor eller låtar.
