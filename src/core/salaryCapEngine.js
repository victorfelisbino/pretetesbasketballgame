/**
 * Salary Cap Engine — Quadra Legacy
 *
 * Manages team budgets, player salaries, and salary cap enforcement
 * across the tiered league system.
 *
 * Pure functions — no side effects.
 */

export const TIER_SALARY_CAPS = Object.freeze({
  amateur: 5_000_000,
  semi_pro: 12_000_000,
  professional: 18_000_000,
  premier: 20_000_000,
});

export const REVENUE_CONFIG = Object.freeze({
  PER_WIN: 250_000,
  PER_PLAYOFF_APPEARANCE: 500_000,
  PER_CHAMPIONSHIP: 1_000_000,
  PLAYER_OF_WEEK: 100_000,
  TIER_BASE_SPONSORSHIP: Object.freeze({
    amateur: 500_000,
    semi_pro: 1_500_000,
    professional: 3_000_000,
    premier: 5_000_000,
  }),
});

const SALARY_TIER_MULTIPLIER = Object.freeze({
  amateur: 5_000,
  semi_pro: 12_000,
  professional: 20_000,
  premier: 30_000,
});

const POSITION_SCARCITY = Object.freeze({
  C: 1.1, PG: 1.05, SG: 1.0, SF: 1.0, PF: 1.0,
});

// Functions:

export function getTierSalaryCap(leagueTier) {
  return TIER_SALARY_CAPS[leagueTier] || TIER_SALARY_CAPS.amateur;
}

export function createTeamBudget(teamId, leagueTier = 'amateur', season = 1) {
  const cap = getTierSalaryCap(leagueTier);
  return {
    teamId,
    salaryCap: cap,
    playerSalaries: {},
    totalSalaryCommitted: 0,
    availableCapSpace: cap,
    revenue: { wins: 0, playoffBonus: 0, championship: 0, sponsorship: 0, awards: 0 },
    expenses: { playerSalaries: 0, staffCosts: 0 },
    season,
  };
}

export function calculateAvailableCapSpace(budget) {
  return budget.salaryCap - budget.totalSalaryCommitted;
}

export function canAffordPlayer(budget, salary) {
  return calculateAvailableCapSpace(budget) >= salary;
}

export function signPlayer(budget, playerId, salary) {
  if (!canAffordPlayer(budget, salary)) {
    throw new Error(`Cannot afford player ${playerId}: salary ${salary} exceeds available cap space ${calculateAvailableCapSpace(budget)}`);
  }
  const newSalaries = { ...budget.playerSalaries, [playerId]: salary };
  const newTotal = budget.totalSalaryCommitted + salary;
  return {
    ...budget,
    playerSalaries: newSalaries,
    totalSalaryCommitted: newTotal,
    availableCapSpace: budget.salaryCap - newTotal,
    expenses: { ...budget.expenses, playerSalaries: newTotal },
  };
}

export function releasePlayer(budget, playerId) {
  if (!(playerId in budget.playerSalaries)) return { ...budget };
  const salary = budget.playerSalaries[playerId];
  const newSalaries = { ...budget.playerSalaries };
  delete newSalaries[playerId];
  const newTotal = budget.totalSalaryCommitted - salary;
  return {
    ...budget,
    playerSalaries: newSalaries,
    totalSalaryCommitted: newTotal,
    availableCapSpace: budget.salaryCap - newTotal,
    expenses: { ...budget.expenses, playerSalaries: newTotal },
  };
}

export function calculatePlayerSalary(player, leagueTier = 'amateur') {
  // Determine overall rating
  let overall;
  if (player.overall != null) {
    overall = player.overall;
  } else if (player.Attack != null && player.Defense != null && player.Stamina != null && player.ThreePoint != null) {
    overall = Math.round((player.Attack + player.Defense + player.Stamina + player.ThreePoint) / 4);
  } else {
    overall = 50;
  }

  const tierMult = SALARY_TIER_MULTIPLIER[leagueTier] || SALARY_TIER_MULTIPLIER.amateur;
  let salary = overall * tierMult;

  // Age modifier
  const age = player.age || 25;
  if (age >= 23 && age <= 28) salary *= 1.2;
  else if (age >= 18 && age <= 22) salary *= 0.8;
  else if (age >= 29 && age <= 33) salary *= 0.9;
  else if (age >= 34) salary *= 0.6;

  // Position scarcity
  const positionMod = POSITION_SCARCITY[player.position] || 1.0;
  salary *= positionMod;

  // Round to nearest 10000
  return Math.round(salary / 10_000) * 10_000;
}

export function processSeasonRevenue(budget, seasonResults, leagueTier = 'amateur') {
  const { wins = 0, playoffAppearance = false, championship = false, playerOfWeekAwards = 0 } = seasonResults;
  const winRevenue = wins * REVENUE_CONFIG.PER_WIN;
  const playoffRevenue = playoffAppearance ? REVENUE_CONFIG.PER_PLAYOFF_APPEARANCE : 0;
  const champRevenue = championship ? REVENUE_CONFIG.PER_CHAMPIONSHIP : 0;
  const awardRevenue = playerOfWeekAwards * REVENUE_CONFIG.PLAYER_OF_WEEK;
  const sponsorship = REVENUE_CONFIG.TIER_BASE_SPONSORSHIP[leagueTier] || REVENUE_CONFIG.TIER_BASE_SPONSORSHIP.amateur;
  const totalRevenue = winRevenue + playoffRevenue + champRevenue + awardRevenue + sponsorship;

  return {
    ...budget,
    revenue: {
      wins: winRevenue,
      playoffBonus: playoffRevenue,
      championship: champRevenue,
      sponsorship,
      awards: awardRevenue,
    },
    salaryCap: budget.salaryCap + totalRevenue,
    availableCapSpace: (budget.salaryCap + totalRevenue) - budget.totalSalaryCommitted,
  };
}

export function validateTradeFinancials(budgetA, budgetB, playersFromA, playersFromB) {
  const salaryFromA = playersFromA.reduce((sum, p) => sum + p.salary, 0);
  const salaryFromB = playersFromB.reduce((sum, p) => sum + p.salary, 0);

  // 15% salary match rule: each side's outgoing must be within 15% of incoming
  const tolerance = 0.15;
  // Team A sends salaryFromA, receives salaryFromB
  if (salaryFromA > 0 && salaryFromB > 0) {
    const ratioAtoB = salaryFromA / salaryFromB;
    const ratioBtoA = salaryFromB / salaryFromA;
    if (ratioAtoB > (1 + tolerance) || ratioBtoA > (1 + tolerance)) {
      return {
        valid: false,
        reason: `Salary mismatch: $${salaryFromA} vs $${salaryFromB} exceeds 15% tolerance`,
        teamANewCap: null,
        teamBNewCap: null,
      };
    }
  }

  // Check cap space: after trade, team A loses playersFromA salaries, gains playersFromB salaries
  const teamANewCommitted = budgetA.totalSalaryCommitted - salaryFromA + salaryFromB;
  const teamBNewCommitted = budgetB.totalSalaryCommitted - salaryFromB + salaryFromA;

  if (teamANewCommitted > budgetA.salaryCap) {
    return {
      valid: false,
      reason: `Team A would exceed salary cap: $${teamANewCommitted} > $${budgetA.salaryCap}`,
      teamANewCap: budgetA.salaryCap - teamANewCommitted,
      teamBNewCap: budgetB.salaryCap - teamBNewCommitted,
    };
  }
  if (teamBNewCommitted > budgetB.salaryCap) {
    return {
      valid: false,
      reason: `Team B would exceed salary cap: $${teamBNewCommitted} > $${budgetB.salaryCap}`,
      teamANewCap: budgetA.salaryCap - teamANewCommitted,
      teamBNewCap: budgetB.salaryCap - teamBNewCommitted,
    };
  }

  return {
    valid: true,
    reason: null,
    teamANewCap: budgetA.salaryCap - teamANewCommitted,
    teamBNewCap: budgetB.salaryCap - teamBNewCommitted,
  };
}
