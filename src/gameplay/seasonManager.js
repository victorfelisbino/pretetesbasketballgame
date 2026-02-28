/**
 * Season Manager — Quadra Legacy
 *
 * Controls the full season lifecycle as defined in the Mobile Game Master Plan
 * Section 6.9 (Season Structure) and Firestore schema (Section 8.2).
 *
 * Season calendar (real-time durations):
 *   Pre-Season Draft  →  3 days
 *   Regular Season    →  14 days  (~18 games/team)
 *   Trade Deadline    →  Day 10 of Regular Season (blocks trades after)
 *   Playoffs          →  5 days
 *   Off-Season        →  3 days
 *
 * Pure JavaScript — no Firebase, no React, no external date libraries.
 * All exports are named ES module exports.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Phase identifiers that match the Firestore `seasons/{id}.status` enum. */
export const SEASON_PHASES = Object.freeze({
    DRAFT:     'draft',
    REGULAR:   'regular',
    PLAYOFFS:  'playoffs',
    OFFSEASON: 'offseason'
});

/** Real-world duration in days for each phase (defaults). Overridable per season. */
const DEFAULT_PHASE_DURATIONS = Object.freeze({
    draft:     3,
    regular:   14,
    playoffs:  5,
    offseason: 3
});

/** Day of the regular season on which the trade deadline falls. */
const TRADE_DEADLINE_DAY = 10;

/** Milliseconds in one day — used for all date arithmetic. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds in one week */
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic-looking unique ID without external libs.
 *
 * @returns {string}
 */
function generateId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// createSeason
// ---------------------------------------------------------------------------

/**
 * Create a new season object ready to be persisted.
 *
 * @param {string}   leagueId - The league this season belongs to.
 * @param {string[]} teamIds  - Array of team IDs participating (4–12 teams).
 * @param {object}   [options]
 * @param {string}   [options.draftType='snake']          - 'snake' | 'auction'
 * @param {string}   [options.fantasyMode='headToHead']   - 'headToHead' | 'roto' | 'points'
 * @param {Date}     [options.startDate=new Date()]       - Season kick-off date
 * @param {number}   [options.matchesPerWeek=3]           - Simulated rounds per real-world week (1–3)
 * @param {number}   [options.seasonNumber=1]             - Season ordinal within the league
 * @param {object}   [options.phaseDurations]             - Override default phase durations (days)
 * @returns {object} Season object
 */
export function createSeason(leagueId, teamIds, options = {}) {
    if (!leagueId || typeof leagueId !== 'string') {
        throw new TypeError('createSeason: leagueId must be a non-empty string');
    }
    if (!Array.isArray(teamIds) || teamIds.length < 4 || teamIds.length > 12) {
        throw new RangeError('createSeason: teamIds must be an array of 4–12 team IDs');
    }

    const startDate      = options.startDate instanceof Date ? options.startDate : new Date();
    const matchesPerWeek = Math.max(1, Math.min(3, options.matchesPerWeek ?? 3));
    const seasonNumber   = options.seasonNumber ?? 1;
    const phaseDurations = { ...DEFAULT_PHASE_DURATIONS, ...(options.phaseDurations || {}) };

    // Regular season spans phaseDurations.regular days.
    // We split into weeks: Math.ceil(regularDays / 7) weeks.
    const totalWeeks  = Math.ceil(phaseDurations.regular / 7); // ~2 weeks for 14-day season

    // Compute timestamps for major phase boundaries (all relative to startDate)
    const regularSeasonStart = new Date(startDate.getTime() + phaseDurations.draft * ONE_DAY_MS);
    const tradeDeadline      = new Date(regularSeasonStart.getTime() + TRADE_DEADLINE_DAY * ONE_DAY_MS);
    const playoffsStart      = new Date(regularSeasonStart.getTime() + phaseDurations.regular * ONE_DAY_MS);
    const offseasonStart     = new Date(playoffsStart.getTime() + phaseDurations.playoffs * ONE_DAY_MS);
    const seasonEnd          = new Date(offseasonStart.getTime() + phaseDurations.offseason * ONE_DAY_MS);

    // Generate the regular-season schedule
    const schedule = generateSchedule(teamIds, totalWeeks, matchesPerWeek);

    // Attach real-world dates to each week's matchup block
    schedule.forEach(weekBlock => {
        const weekOffsetMs = (weekBlock.week - 1) * ONE_WEEK_MS;
        // Each week starts on regularSeasonStart + offset; matchdays spread across the week
        weekBlock.weekStartDate   = new Date(regularSeasonStart.getTime() + weekOffsetMs).toISOString();
        weekBlock.matchDate       = new Date(regularSeasonStart.getTime() + weekOffsetMs).toISOString();
        weekBlock.matchups.forEach(m => { m.status = m.status || 'scheduled'; });
    });

    // Initialise standings with all-zero records per team
    const standings = teamIds.map(teamId => ({
        teamId,
        wins:           0,
        losses:         0,
        pointsFor:      0,
        pointsAgainst:  0,
        fantasyPts:     0,
        streak:         'W0'   // e.g. "W3" or "L2"
    }));

    return {
        id:        generateId(),
        leagueId,
        number:    seasonNumber,
        status:    SEASON_PHASES.DRAFT,

        // Configuration
        config: {
            draftType:        options.draftType    ?? 'snake',
            fantasyMode:      options.fantasyMode   ?? 'headToHead',
            matchesPerWeek,
            totalWeeks,
            phaseDurations,
            teamIds:          [...teamIds]
        },

        // Key dates (ISO strings for serialisability)
        dates: {
            seasonStart:       startDate.toISOString(),
            draftEnd:          regularSeasonStart.toISOString(),
            regularSeasonStart: regularSeasonStart.toISOString(),
            tradeDeadline:     tradeDeadline.toISOString(),
            playoffsStart:     playoffsStart.toISOString(),
            offseasonStart:    offseasonStart.toISOString(),
            seasonEnd:         seasonEnd.toISOString()
        },

        schedule,
        standings,
        playoffBracket: null,
        champion:       null,
        createdAt:      new Date().toISOString()
    };
}

// ---------------------------------------------------------------------------
// generateSchedule
// ---------------------------------------------------------------------------

/**
 * Generate a round-robin schedule using the circle (polygon) rotation method.
 *
 * Guarantees:
 *   - Each team plays every other team at least once.
 *   - Even home/away distribution across cycles.
 *   - Supports 4–12 teams; bye added automatically for odd counts.
 *   - Returns enough rounds to fill totalWeeks × matchesPerWeek slots,
 *     repeating the round-robin (with home/away swapped) as needed.
 *
 * Circle method rotation for N teams (N even):
 *   - Anchor:   teams[0]
 *   - Rotating: teams[1..N-1]
 *   - Round r:  anchor vs rotating[r % (N-1)],
 *               then pair rotating[(r+1)%(N-1)] with rotating[(r+N-2)%(N-1)],
 *               rotating[(r+2)%(N-1)] with rotating[(r+N-3)%(N-1)], …
 *
 * @param {string[]} teamIds        - Array of 4–12 team IDs.
 * @param {number}   totalWeeks     - Number of calendar weeks to fill.
 * @param {number}   matchesPerWeek - Rounds of games per week (1–3).
 * @returns {Array<{ week: number, round: number, matchups: Array<{ homeTeamId, awayTeamId, status }> }>}
 */
export function generateSchedule(teamIds, totalWeeks = 2, matchesPerWeek = 3) {
    if (!Array.isArray(teamIds) || teamIds.length < 2) {
        throw new RangeError('generateSchedule: need at least 2 teams');
    }

    const clampedMPW = Math.max(1, Math.min(3, matchesPerWeek));
    const totalRounds = totalWeeks * clampedMPW;

    // Ensure even team count — add a BYE slot for odd numbers
    const teams  = [...teamIds];
    const hasBye = teams.length % 2 !== 0;
    if (hasBye) teams.push('BYE');

    const n             = teams.length;       // Always even
    const roundsPerCycle = n - 1;             // Single round-robin completes in N-1 rounds
    const anchor        = teams[0];
    const rotating      = teams.slice(1);     // Length = N-1

    const schedule = [];
    let   globalRound = 0;

    for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
        globalRound++;
        const cycleRound  = roundIdx % roundsPerCycle;
        const cycleNumber = Math.floor(roundIdx / roundsPerCycle);
        const swapHomeAway = cycleNumber % 2 === 1; // alternate home/away each cycle

        const matchups = [];

        // Anchor pairing
        const anchorOpponentIdx = cycleRound;
        const anchorOpponent    = rotating[anchorOpponentIdx];

        if (anchorOpponent !== 'BYE' && anchor !== 'BYE') {
            const home = swapHomeAway ? anchorOpponent : anchor;
            const away = swapHomeAway ? anchor         : anchorOpponent;
            matchups.push({ homeTeamId: home, awayTeamId: away, status: 'scheduled' });
        }

        // Remaining pairings (rotating pairs around the polygon)
        for (let i = 1; i <= Math.floor((n - 2) / 2); i++) {
            const leftIdx  = (cycleRound + i)         % (n - 1);
            const rightIdx = (cycleRound + (n - 1) - i) % (n - 1);

            const left  = rotating[leftIdx];
            const right = rotating[rightIdx];

            if (left === 'BYE' || right === 'BYE') continue;

            // Alternate home/away: even i → left is home in even cycle, swap in odd cycle
            const isEvenPair = i % 2 === 0;
            let home, away;
            if (swapHomeAway) {
                home = isEvenPair ? right : left;
                away = isEvenPair ? left  : right;
            } else {
                home = isEvenPair ? left  : right;
                away = isEvenPair ? right : left;
            }
            matchups.push({ homeTeamId: home, awayTeamId: away, status: 'scheduled' });
        }

        if (matchups.length > 0) {
            const week = Math.ceil(globalRound / clampedMPW);
            schedule.push({
                week,
                round:   globalRound,
                matchups
            });
        }
    }

    return schedule;
}

// ---------------------------------------------------------------------------
// calculateStandings
// ---------------------------------------------------------------------------

/**
 * Compute current standings from a list of completed match results.
 *
 * @param {string} seasonId      - Season identifier (informational, used in return value).
 * @param {Array}  matchResults  - Array of completed match result objects.
 *   Each entry: { homeTeamId, awayTeamId, homeScore, awayScore, playerStats? }
 *   playerStats: { [playerId]: { pts, reb, ast, stl, blk, to } }
 * @returns {Array<{ teamId, wins, losses, pointsFor, pointsAgainst, fantasyPts, streak }>}
 *   Sorted by wins descending; ties broken by fantasyPts descending then pointDiff.
 */
export function calculateStandings(seasonId, matchResults) {
    if (!Array.isArray(matchResults)) {
        throw new TypeError('calculateStandings: matchResults must be an array');
    }

    // Collect unique team IDs from all results
    const teamMap = new Map();

    const ensureTeam = teamId => {
        if (!teamMap.has(teamId)) {
            teamMap.set(teamId, {
                teamId,
                wins:          0,
                losses:        0,
                pointsFor:     0,
                pointsAgainst: 0,
                fantasyPts:    0,
                streak:        'W0',
                _streakType:   null,  // internal: 'W' or 'L'
                _streakCount:  0
            });
        }
        return teamMap.get(teamId);
    };

    for (const result of matchResults) {
        const { homeTeamId, awayTeamId, homeScore, awayScore } = result;
        if (!homeTeamId || !awayTeamId) continue;

        const home = ensureTeam(homeTeamId);
        const away = ensureTeam(awayTeamId);

        const hs = Number(homeScore) || 0;
        const as = Number(awayScore) || 0;

        home.pointsFor     += hs;
        home.pointsAgainst += as;
        away.pointsFor     += as;
        away.pointsAgainst += hs;

        if (hs > as) {
            home.wins++;
            away.losses++;
            _updateStreak(home, 'W');
            _updateStreak(away, 'L');
        } else if (as > hs) {
            away.wins++;
            home.losses++;
            _updateStreak(away, 'W');
            _updateStreak(home, 'L');
        } else {
            // Tie — rare in basketball, count as 0.5W each
            home.wins   += 0.5;
            home.losses += 0.5;
            away.wins   += 0.5;
            away.losses += 0.5;
            _updateStreak(home, 'T');
            _updateStreak(away, 'T');
        }

        // Accumulate fantasy points from playerStats if provided
        if (result.playerStats && typeof result.playerStats === 'object') {
            const { homeFP, awayFP } = _computeFantasyFromMatchStats(
                result.playerStats,
                homeTeamId,
                awayTeamId
            );
            home.fantasyPts += homeFP;
            away.fantasyPts += awayFP;
        } else {
            // Fallback: use game points as a proxy for fantasy points
            home.fantasyPts += hs;
            away.fantasyPts += as;
        }
    }

    // Clean up internal tracking fields and format streak string
    const standings = [];
    for (const entry of teamMap.values()) {
        const clean = { ...entry };
        delete clean._streakType;
        delete clean._streakCount;
        clean.fantasyPts = Math.round(clean.fantasyPts * 100) / 100;
        standings.push(clean);
    }

    return sortStandings(standings);
}

/**
 * Update a team's streak state machine.
 * @private
 */
function _updateStreak(team, result) {
    if (result === 'T') {
        team._streakType  = 'T';
        team._streakCount = 1;
    } else if (team._streakType === result) {
        team._streakCount++;
    } else {
        team._streakType  = result;
        team._streakCount = 1;
    }
    team.streak = `${team._streakType}${team._streakCount}`;
}

/**
 * Compute fantasy points from a match's playerStats block.
 * Uses simplified scoring weights from the default config (Section 6.4):
 *   pts×1, reb×1.2, ast×1.5, stl×2, blk×2, to×-1
 *
 * @private
 * @param {object}  playerStats  - { [playerId]: { pts, reb, ast, stl, blk, to, teamId? } }
 * @param {string}  homeTeamId
 * @param {string}  awayTeamId
 * @returns {{ homeFP: number, awayFP: number }}
 */
function _computeFantasyFromMatchStats(playerStats, homeTeamId, awayTeamId) {
    let homeFP = 0;
    let awayFP = 0;

    for (const [, stats] of Object.entries(playerStats)) {
        const fp = (
            (Number(stats.pts)  || 0) * 1    +
            (Number(stats.reb)  || 0) * 1.2  +
            (Number(stats.ast)  || 0) * 1.5  +
            (Number(stats.stl)  || 0) * 2    +
            (Number(stats.blk)  || 0) * 2    +
            (Number(stats.to)   || 0) * -1
        );

        if (stats.teamId === homeTeamId) {
            homeFP += fp;
        } else if (stats.teamId === awayTeamId) {
            awayFP += fp;
        }
    }

    return { homeFP, awayFP };
}

// ---------------------------------------------------------------------------
// advanceSeasonPhase
// ---------------------------------------------------------------------------

/**
 * Transition a season to its next lifecycle phase.
 *
 * Phase order: draft → regular → playoffs → offseason → (caller creates next season)
 *
 * @param {object} season - A season object as returned by createSeason().
 * @returns {object} A new season object (shallow copy) with the updated status
 *   and any phase-specific mutations applied.
 */
export function advanceSeasonPhase(season) {
    if (!season || typeof season !== 'object') {
        throw new TypeError('advanceSeasonPhase: season must be an object');
    }

    const transitions = {
        [SEASON_PHASES.DRAFT]:     SEASON_PHASES.REGULAR,
        [SEASON_PHASES.REGULAR]:   SEASON_PHASES.PLAYOFFS,
        [SEASON_PHASES.PLAYOFFS]:  SEASON_PHASES.OFFSEASON,
        [SEASON_PHASES.OFFSEASON]: null  // caller must create a new season
    };

    const nextPhase = transitions[season.status];

    if (nextPhase === null) {
        // Season fully complete — return with a 'completed' flag but same status
        return { ...season, isCompleted: true, completedAt: new Date().toISOString() };
    }

    if (!nextPhase) {
        throw new Error(`advanceSeasonPhase: unknown phase "${season.status}"`);
    }

    const updated = {
        ...season,
        status:          nextPhase,
        lastPhaseChange: new Date().toISOString()
    };

    // Phase-specific mutations
    if (nextPhase === SEASON_PHASES.PLAYOFFS) {
        // Auto-generate playoff bracket when transitioning to playoffs
        if (!updated.playoffBracket && updated.standings.length > 0) {
            updated.playoffBracket = generatePlayoffBracket(
                season.id,
                updated.standings,
                4  // Top 4 teams
            );
        }
    }

    if (nextPhase === SEASON_PHASES.OFFSEASON) {
        // Resolve champion from playoff bracket if not already set
        if (updated.playoffBracket && !updated.champion) {
            updated.champion = getLeagueChampion(updated.playoffBracket.rounds);
        }
    }

    return updated;
}

// ---------------------------------------------------------------------------
// generatePlayoffBracket
// ---------------------------------------------------------------------------

/**
 * Generate a single-elimination playoff bracket.
 *
 * Seeds are assigned from `standings` (standings[0] = #1 seed).
 * Seeding matchups:
 *   4 teams: (1 vs 4), (2 vs 3) in semis; winners meet in final.
 *   8 teams: (1v8), (4v5), (3v6), (2v7) in quarters; winners in semis; final.
 *   Other counts: best-vs-worst bracket.
 *
 * @param {string} seasonId            - Season ID for reference.
 * @param {Array}  standings           - Sorted standings array (best first).
 * @param {number} [teamsInPlayoffs=4] - Number of teams that qualify (typically 4).
 * @returns {object} Playoff bracket object.
 */
export function generatePlayoffBracket(seasonId, standings, teamsInPlayoffs = 4) {
    if (!Array.isArray(standings) || standings.length < 2) {
        throw new RangeError('generatePlayoffBracket: standings must have at least 2 teams');
    }

    const count = Math.min(teamsInPlayoffs, standings.length);
    // Enforce power-of-2 bracket size (2, 4, 8)
    const bracketSize = [2, 4, 8].reduce((best, s) => (s <= count ? s : best), 2);

    const qualifiers = standings.slice(0, bracketSize).map((entry, index) => ({
        seed:    index + 1,
        teamId:  entry.teamId,
        wins:    entry.wins,
        losses:  entry.losses
    }));

    // Generate bracket matchups: best vs worst (1v8, 2v7, 3v6, 4v5 or 1v4, 2v3)
    const firstRoundMatchups = [];
    for (let i = 0; i < bracketSize / 2; i++) {
        const high = qualifiers[i];
        const low  = qualifiers[bracketSize - 1 - i];
        firstRoundMatchups.push({
            id:           generateId(),
            round:        1,
            highSeed:     high.seed,
            lowSeed:      low.seed,
            homeTeamId:   high.teamId,   // Higher seed gets home-court
            awayTeamId:   low.teamId,
            homeTeamSeed: high.seed,
            awayTeamSeed: low.seed,
            status:       'scheduled',
            winner:       null
        });
    }

    // Build subsequent empty rounds (to be filled as results come in)
    const totalRounds = Math.log2(bracketSize);
    const rounds      = [firstRoundMatchups];

    for (let r = 2; r <= totalRounds; r++) {
        const roundMatchups = [];
        const prevRound     = rounds[r - 2];
        for (let i = 0; i < prevRound.length / 2; i++) {
            roundMatchups.push({
                id:           generateId(),
                round:        r,
                homeTeamId:   null,  // TBD — filled when previous round completes
                awayTeamId:   null,
                homeTeamSeed: null,
                awayTeamSeed: null,
                status:       'pending',
                winner:       null
            });
        }
        rounds.push(roundMatchups);
    }

    return {
        seasonId,
        bracketSize,
        totalRounds,
        qualifiers,
        rounds,     // rounds[0] = first round, rounds[totalRounds-1] = final
        champion:   null,
        createdAt:  new Date().toISOString()
    };
}

// ---------------------------------------------------------------------------
// getSeasonCalendar
// ---------------------------------------------------------------------------

/**
 * Return a human-readable calendar of all key dates in a season.
 *
 * @param {object} season - Season object as returned by createSeason().
 * @returns {Array<{ label: string, date: string, phase: string, isKeyDate: boolean }>}
 *   Sorted chronologically.
 */
export function getSeasonCalendar(season) {
    if (!season || !season.dates) {
        throw new TypeError('getSeasonCalendar: invalid season object');
    }

    const { dates, schedule, config } = season;
    const calendar = [];

    // Phase boundary dates
    calendar.push({
        label:      'Season Starts / Draft Opens',
        date:       dates.seasonStart,
        phase:      SEASON_PHASES.DRAFT,
        isKeyDate:  true
    });

    calendar.push({
        label:      'Draft Closes / Regular Season Begins',
        date:       dates.draftEnd,
        phase:      SEASON_PHASES.REGULAR,
        isKeyDate:  true
    });

    calendar.push({
        label:      `Trade Deadline (Day ${TRADE_DEADLINE_DAY} of Regular Season)`,
        date:       dates.tradeDeadline,
        phase:      SEASON_PHASES.REGULAR,
        isKeyDate:  true
    });

    calendar.push({
        label:      'Regular Season Ends / Playoffs Begin',
        date:       dates.playoffsStart,
        phase:      SEASON_PHASES.PLAYOFFS,
        isKeyDate:  true
    });

    calendar.push({
        label:      'Playoffs End / Off-Season Begins',
        date:       dates.offseasonStart,
        phase:      SEASON_PHASES.OFFSEASON,
        isKeyDate:  true
    });

    calendar.push({
        label:      'Off-Season Ends',
        date:       dates.seasonEnd,
        phase:      SEASON_PHASES.OFFSEASON,
        isKeyDate:  true
    });

    // Match days (one entry per week block)
    if (Array.isArray(schedule)) {
        const seenWeeks = new Set();
        for (const block of schedule) {
            if (!seenWeeks.has(block.week)) {
                seenWeeks.add(block.week);
                calendar.push({
                    label:      `Week ${block.week} Match Day (${block.matchups.length} game${block.matchups.length !== 1 ? 's' : ''})`,
                    date:       block.matchDate || block.weekStartDate || dates.regularSeasonStart,
                    phase:      SEASON_PHASES.REGULAR,
                    isKeyDate:  false,
                    week:       block.week,
                    matchCount: block.matchups.length
                });
            }
        }
    }

    // Sort all entries chronologically
    calendar.sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return da - db;
    });

    return calendar;
}

// ---------------------------------------------------------------------------
// isTradeDeadlinePassed
// ---------------------------------------------------------------------------

/**
 * Check whether the trade deadline for this season has already passed.
 *
 * @param {object} season    - Season object.
 * @param {Date}   [now]     - Current date (defaults to `new Date()`). Inject for testing.
 * @returns {boolean}
 */
export function isTradeDeadlinePassed(season, now = new Date()) {
    if (!season || !season.dates || !season.dates.tradeDeadline) return false;

    const deadline = new Date(season.dates.tradeDeadline);
    return now.getTime() >= deadline.getTime();
}

// ---------------------------------------------------------------------------
// getWeekNumber
// ---------------------------------------------------------------------------

/**
 * Given a date, return which week of the regular season it falls in.
 * Week 1 starts on the regularSeasonStart date.
 * Returns 0 if the date is before the regular season starts.
 * Returns (totalWeeks + 1) if the date is past the regular season.
 *
 * @param {object} season - Season object.
 * @param {Date}   date   - The date to check.
 * @returns {number} 1-indexed week number; 0 = pre-season; > totalWeeks = post-regular-season.
 */
export function getWeekNumber(season, date) {
    if (!season || !season.dates || !(date instanceof Date)) {
        return 0;
    }

    const regularStart = new Date(season.dates.regularSeasonStart).getTime();
    const checkTime    = date.getTime();

    if (checkTime < regularStart) return 0;

    const daysElapsed = (checkTime - regularStart) / ONE_DAY_MS;
    const weekNumber  = Math.floor(daysElapsed / 7) + 1;

    return weekNumber;
}

// ---------------------------------------------------------------------------
// getNextMatchDay
// ---------------------------------------------------------------------------

/**
 * Return the date/timestamp of the next scheduled (not yet played) match day.
 *
 * Scans the season schedule for the first block that has at least one
 * 'scheduled' matchup and returns its matchDate.
 *
 * @param {object} season - Season object.
 * @returns {Date|null} Date of the next match day, or null if no upcoming games.
 */
export function getNextMatchDay(season) {
    if (!season || !Array.isArray(season.schedule)) return null;

    for (const block of season.schedule) {
        const hasScheduled = block.matchups.some(m => m.status === 'scheduled');
        if (hasScheduled) {
            const dateStr = block.matchDate || block.weekStartDate;
            return dateStr ? new Date(dateStr) : null;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Standings helpers
// ---------------------------------------------------------------------------

/**
 * Sort standings by: wins descending → point differential descending → fantasyPts descending → pointsFor descending.
 *
 * Tiebreaker order rationale:
 *   1. Wins   — primary competitive metric
 *   2. Point differential (pointsFor - pointsAgainst) — traditional basketball tiebreaker
 *   3. Fantasy Points — used when point diff is also tied
 *   4. Total points scored — final fallback
 *
 * @param {Array} standings - Array of standing entries from calculateStandings().
 * @returns {Array} New sorted array (original is not mutated).
 */
export function sortStandings(standings) {
    if (!Array.isArray(standings)) return [];

    return [...standings].sort((a, b) => {
        // Primary: wins
        if (b.wins !== a.wins) return b.wins - a.wins;

        // Secondary: point differential
        const aDiff = (a.pointsFor || 0) - (a.pointsAgainst || 0);
        const bDiff = (b.pointsFor || 0) - (b.pointsAgainst || 0);
        if (bDiff !== aDiff) return bDiff - aDiff;

        // Tertiary: fantasy points
        if (b.fantasyPts !== a.fantasyPts) return b.fantasyPts - a.fantasyPts;

        // Quaternary: total points scored
        return (b.pointsFor || 0) - (a.pointsFor || 0);
    });
}

/**
 * Extract the top N teams from sorted standings (playoff qualifiers).
 *
 * @param {Array}  standings - Sorted standings array.
 * @param {number} count     - Number of playoff teams to select (typically 4).
 * @returns {Array} Slice of standings for the qualifying teams.
 */
export function getPlayoffTeams(standings, count = 4) {
    if (!Array.isArray(standings)) return [];
    return standings.slice(0, Math.max(2, count));
}

/**
 * Determine the league champion from a completed playoff bracket's rounds.
 *
 * The champion is the winner of the final-round (last round) only matchup.
 *
 * @param {Array} playoffRounds - The `rounds` array from a playoff bracket object.
 * @returns {{ teamId: string, seed: number } | null}
 */
export function getLeagueChampion(playoffRounds) {
    if (!Array.isArray(playoffRounds) || playoffRounds.length === 0) return null;

    const finalRound = playoffRounds[playoffRounds.length - 1];
    if (!Array.isArray(finalRound) || finalRound.length === 0) return null;

    const finalGame = finalRound[0]; // Championship game is the single matchup in the final round
    if (!finalGame || !finalGame.winner) return null;

    return {
        teamId: finalGame.winner,
        seed:   finalGame.winner === finalGame.homeTeamId
                    ? finalGame.homeTeamSeed
                    : finalGame.awayTeamSeed
    };
}
