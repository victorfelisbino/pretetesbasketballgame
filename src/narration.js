/**
 * Pretetê's Basketball - Bilingual Narration System
 * Provides play-by-play commentary in Portuguese (BR) and English (US)
 */

// Narration templates for different game events
const templates = {
    // ===========================================
    // PORTUGUESE (BR) TEMPLATES
    // ===========================================
    pt: {
        // Match start/end
        matchStart: [
            "🏀 COMEÇA O JOGO! {homeTeam} contra {awayTeam}!",
            "🏀 BOLA AO AR! {homeTeam} enfrenta {awayTeam} nesta partida!",
            "🏀 É HORA DO SHOW! {homeTeam} x {awayTeam}!"
        ],
        matchEnd: [
            "🏆 FIM DE JOGO! {winnerTeam} vence por {winnerScore} a {loserScore}!",
            "🏆 ACABOU! Vitória do {winnerTeam}: {winnerScore} x {loserScore}!",
            "🏆 APITA O JUIZ! {winnerTeam} leva a melhor: {winnerScore} a {loserScore}!"
        ],
        matchTie: [
            "🤝 EMPATE! {score} a {score}! Que jogo equilibrado!",
            "🤝 FIM DE JOGO! Termina {score} a {score}!"
        ],

        // Ball possession
        possession: [
            "{player} tem a bola no ataque.",
            "{player} conduz a jogada para {team}.",
            "Bola com {player}."
        ],
        possessionChange: [
            "Posse de bola muda para {team}!",
            "{team} recupera a posse!",
            "Agora é {team} no ataque!"
        ],

        // Movement
        movement: [
            "{player} avança pela quadra.",
            "{player} se movimenta em direção à cesta.",
            "{player} busca posição no ataque.",
            "{player} penetra na defesa."
        ],

        // Scoring - 2 points
        score2pt: [
            "🏀 CESTA! {player} anota 2 pontos!",
            "🏀 ENTERRADA de {player}! Mais 2 para {team}!",
            "🏀 {player} converte! 2 pontos no placar!",
            "🏀 BONITO! {player} faz a bandeja e marca 2!",
            "🏀 {player} no garrafão! AFUNDOU! 2 pontos!"
        ],
        score2ptFastBreak: [
            "⚡ CONTRA-ATAQUE! {player} corre sozinho e ENTERRA! 2 pontos!",
            "⚡ FAST BREAK! {player} não perdoa! Bandeja fácil!",
            "⚡ QUE VELOCIDADE! {player} finaliza o contra-ataque! 2 pontos!",
            "⚡ ROUBADA E CESTA! {player} não deixa passar! 2 pontos!"
        ],

        // Scoring - 3 points
        score3pt: [
            "🎯 TRÊS PONTOS! {player} de longe! VALEU!",
            "🎯 DO PERÍMETRO! {player} acerta a bomba! 3 pontos!",
            "🎯 TRIPLAÇO de {player}! A bola nem tocou no aro!",
            "🎯 CHUTOU DE TRÊS! {player} CONVERTE!",
            "🎯 LÁ DE FORA! {player} manda a bola pro fundo da rede! 3 pontos!"
        ],
        score3ptFastBreak: [
            "⚡🎯 CONTRA-ATAQUE COM BOMBA! {player} arrisca de três e ACERTA!",
            "⚡🎯 FAST BREAK! {player} para, mira e... TRIPLA! 3 pontos!",
            "⚡🎯 QUE OUSADIA! {player} manda de três no contra-ataque!"
        ],

        // Missed shots
        miss2pt: [
            "❌ {player} tenta a bandeja mas erra!",
            "❌ A bola bate no aro e sai! {player} não consegue converter.",
            "❌ {player} força demais e a bola sai!",
            "❌ Tentativa de {player}... não entrou!"
        ],
        miss3pt: [
            "❌ {player} arrisca de três... não vai!",
            "❌ A bomba de {player} bate no ferro!",
            "❌ {player} tenta de longe mas não tem sucesso!",
            "❌ Três pontos de {player}... ERROU!"
        ],

        // Steals and defense
        steal: [
            "🔥 ROUBADA DE BOLA! {defender} toma a bola de {attacker}!",
            "🔥 INTERCEPTAÇÃO! {defender} lê a jogada e rouba!",
            "🔥 {defender} no momento certo! Bola recuperada!",
            "🔥 QUE DEFESA! {defender} arranca a bola de {attacker}!"
        ],
        stealAttemptFail: [
            "{defender} tenta roubar mas {attacker} protege a bola.",
            "{attacker} escapa da marcação de {defender}.",
            "Tentativa de roubo de {defender}... não conseguiu!"
        ],

        // Blocks
        block: [
            "🚫 TOCO! {defender} manda a bola de {player} pra arquibancada!",
            "🚫 BLOQUEIO ESPETACULAR! {defender} rejeita {player}!",
            "🚫 NÃO HOJE! {defender} bloqueia o arremesso de {player}!",
            "🚫 QUE DEFESA! {defender} com um tapão em {player}!"
        ],

        // Rebounds
        reboundDefense: [
            "📥 REBOTE DEFENSIVO! {player} pega a bola!",
            "📥 {player} sobe e agarra o rebote!",
            "📥 Rebote para {player}! Posse assegurada!",
            "📥 {player} domina as tabelas! Rebote defensivo!"
        ],
        reboundOffense: [
            "📤 REBOTE OFENSIVO! {player} mantém a posse viva!",
            "📤 SEGUNDA CHANCE! {player} pega o rebote!",
            "📤 {player} luta pelo rebote e consegue!",
            "📤 Esforço de {player}! Rebote ofensivo!"
        ],

        // Dribble
        dribble: [
            "🏃 {player} avança driblando!",
            "🏃 {player} conduz a bola com habilidade!",
            "🏃 Bela condução de {player}!",
            "🏃 {player} cruza a marcação no drible!"
        ],

        // Pass
        pass: [
            "➡️ {passer} passa para {receiver}!",
            "➡️ Bola de {passer} encontra {receiver}!",
            "➡️ Belo passe de {passer} para {receiver}!",
            "➡️ Assistência de {passer}! {receiver} recebe!"
        ],
        assist: [
            "🎯 ASSISTÊNCIA! {passer} deixa {player} na cara do gol!",
            "🎯 Belo passe de {passer}! {player} converte!",
            "🎯 {passer} com a visão de jogo! Assistência para {player}!"
        ],

        // Turnover
        turnover: [
            "❌ BOLA PERDIDA! {player} entrega a posse!",
            "❌ Erro de {player}! Turnover!",
            "❌ {player} perde a bola! Posse muda de lado!",
            "❌ Passe errado de {player}! Bola para o adversário!"
        ],

        // Fast break
        fastBreakStart: [
            "⚡ CONTRA-ATAQUE! {team} sai em velocidade!",
            "⚡ {player} puxa o fast break para {team}!",
            "⚡ SAÍDA RÁPIDA! {team} em transição!"
        ],

        // Quarter/Period transitions
        quarterEnd: [
            "📋 Final do {quarter}º período! {homeTeam} {homeScore} x {awayScore} {awayTeam}",
            "📋 Fim do {quarter}º quarto! Placar: {homeScore} a {awayScore}"
        ],

        // Score updates
        scoreUpdate: [
            "📊 Placar: {homeTeam} {homeScore} x {awayScore} {awayTeam}",
            "📊 {homeTeam} {homeScore} - {awayTeam} {awayScore}"
        ],

        // Exciting moments
        closeGame: [
            "🔥 JOGO APERTADO! Apenas {diff} ponto(s) de diferença!",
            "🔥 QUE EMOÇÃO! Diferença de apenas {diff}!"
        ],
        blowout: [
            "😮 {team} abre {diff} pontos de vantagem!",
            "😮 Domínio total de {team}! {diff} pontos na frente!"
        ],
        comeback: [
            "📈 {team} está voltando ao jogo!",
            "📈 REAÇÃO de {team}! A diferença está diminuindo!"
        ]
    },

    // ===========================================
    // ENGLISH (US) TEMPLATES
    // ===========================================
    en: {
        // Match start/end
        matchStart: [
            "🏀 TIP OFF! {homeTeam} vs {awayTeam}!",
            "🏀 THE GAME BEGINS! {homeTeam} takes on {awayTeam}!",
            "🏀 IT'S GAME TIME! {homeTeam} versus {awayTeam}!"
        ],
        matchEnd: [
            "🏆 FINAL! {winnerTeam} wins {winnerScore} to {loserScore}!",
            "🏆 THAT'S THE GAME! {winnerTeam} takes it {winnerScore}-{loserScore}!",
            "🏆 IT'S OVER! {winnerTeam} victorious: {winnerScore} to {loserScore}!"
        ],
        matchTie: [
            "🤝 IT'S A TIE! {score} all! What a game!",
            "🤝 FINAL! Tied at {score}!"
        ],

        // Ball possession
        possession: [
            "{player} has the ball on offense.",
            "{player} brings it up for {team}.",
            "Ball in {player}'s hands."
        ],
        possessionChange: [
            "Possession goes to {team}!",
            "{team} takes over!",
            "{team} now on offense!"
        ],

        // Movement
        movement: [
            "{player} advances up the court.",
            "{player} drives towards the basket.",
            "{player} looking for position.",
            "{player} penetrates the defense."
        ],

        // Scoring - 2 points
        score2pt: [
            "🏀 BUCKET! {player} scores 2!",
            "🏀 SLAM DUNK by {player}! 2 points for {team}!",
            "🏀 {player} converts! 2 points on the board!",
            "🏀 NICE! {player} with the layup for 2!",
            "🏀 {player} in the paint! THROWS IT DOWN! 2 points!"
        ],
        score2ptFastBreak: [
            "⚡ FAST BREAK! {player} goes coast to coast and SLAMS IT! 2 points!",
            "⚡ TRANSITION BUCKET! {player} finishes easy!",
            "⚡ WHAT SPEED! {player} completes the fast break! 2 points!",
            "⚡ STEAL AND SCORE! {player} won't miss that! 2 points!"
        ],

        // Scoring - 3 points
        score3pt: [
            "🎯 THREE POINTER! {player} from downtown! GOOD!",
            "🎯 FROM THE PERIMETER! {player} drains it! 3 points!",
            "🎯 SPLASH by {player}! Nothing but net!",
            "🎯 PULLED UP FOR THREE! {player} HITS IT!",
            "🎯 FROM DEEP! {player} buries the three! 3 points!"
        ],
        score3ptFastBreak: [
            "⚡🎯 FAST BREAK THREE! {player} pulls up and DRAINS IT!",
            "⚡🎯 TRANSITION THREE! {player} stops, pops, and... BANG! 3 points!",
            "⚡🎯 WHAT CONFIDENCE! {player} hits the fast break three!"
        ],

        // Missed shots
        miss2pt: [
            "❌ {player} tries the layup but misses!",
            "❌ The ball rattles out! {player} can't convert.",
            "❌ {player} forces it and the ball bounces out!",
            "❌ Shot attempt by {player}... no good!"
        ],
        miss3pt: [
            "❌ {player} shoots the three... won't go!",
            "❌ {player}'s three-pointer hits the rim!",
            "❌ {player} fires from deep but no luck!",
            "❌ Three-pointer by {player}... MISSED!"
        ],

        // Steals and defense
        steal: [
            "🔥 STEAL! {defender} takes it from {attacker}!",
            "🔥 INTERCEPTION! {defender} reads the play and picks it off!",
            "🔥 {defender} with perfect timing! Ball recovered!",
            "🔥 GREAT DEFENSE! {defender} rips it from {attacker}!"
        ],
        stealAttemptFail: [
            "{defender} reaches but {attacker} protects the ball.",
            "{attacker} escapes {defender}'s pressure.",
            "Steal attempt by {defender}... unsuccessful!"
        ],

        // Blocks
        block: [
            "🚫 BLOCKED! {defender} swats {player}'s shot away!",
            "🚫 REJECTION! {defender} denies {player}!",
            "🚫 NOT IN MY HOUSE! {defender} blocks {player}!",
            "🚫 GET THAT OUT OF HERE! {defender} with the block on {player}!"
        ],

        // Rebounds
        reboundDefense: [
            "📥 DEFENSIVE REBOUND! {player} grabs the board!",
            "📥 {player} goes up and secures the rebound!",
            "📥 Rebound to {player}! Possession secured!",
            "📥 {player} controls the glass! Defensive board!"
        ],
        reboundOffense: [
            "📤 OFFENSIVE REBOUND! {player} keeps the possession alive!",
            "📤 SECOND CHANCE! {player} grabs the board!",
            "📤 {player} fights for the rebound and gets it!",
            "📤 Hustle play by {player}! Offensive rebound!"
        ],

        // Dribble
        dribble: [
            "🏃 {player} advances with the dribble!",
            "🏃 {player} handles the ball with skill!",
            "🏃 Nice ball handling by {player}!",
            "🏃 {player} crosses over and beats the defender!"
        ],

        // Pass
        pass: [
            "➡️ {passer} passes to {receiver}!",
            "➡️ Ball from {passer} finds {receiver}!",
            "➡️ Great pass from {passer} to {receiver}!",
            "➡️ {passer} feeds {receiver}!"
        ],
        assist: [
            "🎯 ASSIST! {passer} sets up {player} perfectly!",
            "🎯 Beautiful pass from {passer}! {player} converts!",
            "🎯 {passer} with the court vision! Assist to {player}!"
        ],

        // Turnover
        turnover: [
            "❌ TURNOVER! {player} loses the ball!",
            "❌ Mistake by {player}! Turnover!",
            "❌ {player} gives it away! Possession changes!",
            "❌ Bad pass by {player}! Ball goes the other way!"
        ],

        // Fast break
        fastBreakStart: [
            "⚡ FAST BREAK! {team} pushes the pace!",
            "⚡ {player} leads the break for {team}!",
            "⚡ QUICK OUTLET! {team} in transition!"
        ],

        // Quarter/Period transitions
        quarterEnd: [
            "📋 End of Q{quarter}! {homeTeam} {homeScore} - {awayScore} {awayTeam}",
            "📋 Q{quarter} complete! Score: {homeScore} to {awayScore}"
        ],

        // Score updates
        scoreUpdate: [
            "📊 Score: {homeTeam} {homeScore} - {awayScore} {awayTeam}",
            "📊 {homeTeam} {homeScore} | {awayTeam} {awayScore}"
        ],

        // Exciting moments
        closeGame: [
            "🔥 CLOSE GAME! Only {diff} point(s) separating them!",
            "🔥 NAIL BITER! Just {diff} point(s) apart!"
        ],
        blowout: [
            "😮 {team} up by {diff} points!",
            "😮 Total domination by {team}! {diff} point lead!"
        ],
        comeback: [
            "📈 {team} is making a run!",
            "📈 COMEBACK ALERT! {team} is closing the gap!"
        ]
    }
};

/**
 * Narration class for generating play-by-play commentary
 */
class Narration {
    /**
     * Create a new Narration instance
     * @param {string} language - 'pt' for Portuguese or 'en' for English (default: 'pt')
     */
    constructor(language = 'pt') {
        this.language = language;
        this.events = [];
    }

    /**
     * Set the narration language
     * @param {string} language - 'pt' or 'en'
     */
    setLanguage(language) {
        if (language === 'pt' || language === 'en') {
            this.language = language;
        }
    }

    /**
     * Get a random template for the event type
     * @param {string} eventType - The type of event
     * @returns {string} A random template string
     */
    getTemplate(eventType) {
        const langTemplates = templates[this.language];
        if (!langTemplates || !langTemplates[eventType]) {
            return `[${eventType}]`;
        }
        const options = langTemplates[eventType];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Replace placeholders in a template with actual values
     * @param {string} template - The template string
     * @param {object} data - Key-value pairs for replacement
     * @returns {string} The formatted string
     */
    format(template, data) {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    /**
     * Generate narration for a game event
     * @param {string} eventType - The type of event
     * @param {object} data - Event data for template replacement
     * @returns {string} The narration text
     */
    narrate(eventType, data = {}) {
        const template = this.getTemplate(eventType);
        const narration = this.format(template, data);
        this.events.push({
            type: eventType,
            text: narration,
            timestamp: Date.now()
        });
        return narration;
    }

    /**
     * Get all narration events
     * @returns {Array} Array of narration events
     */
    getEvents() {
        return this.events;
    }

    /**
     * Clear all narration events
     */
    clear() {
        this.events = [];
    }

    // ===========================================
    // CONVENIENCE METHODS
    // ===========================================

    matchStart(homeTeam, awayTeam) {
        return this.narrate('matchStart', { homeTeam, awayTeam });
    }

    matchEnd(winnerTeam, loserTeam, winnerScore, loserScore) {
        return this.narrate('matchEnd', { winnerTeam, loserTeam, winnerScore, loserScore });
    }

    matchTie(score) {
        return this.narrate('matchTie', { score });
    }

    possession(player, team) {
        return this.narrate('possession', { player, team });
    }

    possessionChange(team) {
        return this.narrate('possessionChange', { team });
    }

    movement(player) {
        return this.narrate('movement', { player });
    }

    score2pt(player, team, isFastBreak = false) {
        const eventType = isFastBreak ? 'score2ptFastBreak' : 'score2pt';
        return this.narrate(eventType, { player, team });
    }

    score3pt(player, team, isFastBreak = false) {
        const eventType = isFastBreak ? 'score3ptFastBreak' : 'score3pt';
        return this.narrate(eventType, { player, team });
    }

    miss2pt(player) {
        return this.narrate('miss2pt', { player });
    }

    miss3pt(player) {
        return this.narrate('miss3pt', { player });
    }

    steal(defender, attacker) {
        return this.narrate('steal', { defender, attacker });
    }

    stealAttemptFail(defender, attacker) {
        return this.narrate('stealAttemptFail', { defender, attacker });
    }

    fastBreakStart(team, player) {
        return this.narrate('fastBreakStart', { team, player });
    }

    quarterEnd(quarter, homeTeam, homeScore, awayTeam, awayScore) {
        return this.narrate('quarterEnd', { quarter, homeTeam, homeScore, awayTeam, awayScore });
    }

    scoreUpdate(homeTeam, homeScore, awayTeam, awayScore) {
        return this.narrate('scoreUpdate', { homeTeam, homeScore, awayTeam, awayScore });
    }

    closeGame(diff) {
        return this.narrate('closeGame', { diff });
    }

    blowout(team, diff) {
        return this.narrate('blowout', { team, diff });
    }

    comeback(team) {
        return this.narrate('comeback', { team });
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Narration, templates };
}
