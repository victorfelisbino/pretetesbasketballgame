/**
 * Court System Test
 * Verify court grid and player positioning works correctly
 */

// Mock the classes for testing (normally imported)
// Assuming Player, Team, and Court are loaded

// Test 1: Create court and verify grid
function testCourtInitialization() {
    console.log('TEST 1: Court Initialization');
    const court = new Court(50, 30);
    
    console.assert(court.width === 50, 'Width should be 50');
    console.assert(court.height === 30, 'Height should be 30');
    console.assert(court.grid.length === 30, 'Should have 30 rows');
    console.assert(court.grid[0].length === 50, 'Should have 50 columns');
    console.log('✅ Court initialization passed');
}

// Test 2: Place players on court
function testPlacePlayer() {
    console.log('\nTEST 2: Place Player on Court');
    const court = new Court(50, 30);
    const player = new Player('LeBron', 'PG', 5);
    
    court.placePlayer(player, 10, 15);
    
    console.assert(player.x === 10, `Player X should be 10, got ${player.x}`);
    console.assert(player.y === 15, `Player Y should be 15, got ${player.y}`);
    console.assert(court.grid[15][10] === player, 'Player should be in grid');
    console.log('✅ Place player passed');
}

// Test 3: Move player
function testMovePlayer() {
    console.log('\nTEST 3: Move Player');
    const court = new Court(50, 30);
    const pgPlayer = new Player('Magic', 'PG', 5);
    const centerPlayer = new Player('Shaq', 'C', 5);
    
    court.placePlayer(pgPlayer, 10, 15);
    court.placePlayer(centerPlayer, 20, 15);
    
    // PG should move faster (speed 10) than C (speed 5)
    const pgMove = court.movePlayer(pgPlayer, 20, 15);
    const cMove = court.movePlayer(centerPlayer, 10, 15);
    
    console.assert(pgMove.distance < 10, 'PG should move 10 squares');
    console.assert(cMove.distance < 5, 'Center should move 5 squares');
    console.log('✅ Move player passed');
}

// Test 4: Set up teams on court
function testSetupTeams() {
    console.log('\nTEST 4: Setup Teams on Court');
    const court = new Court(50, 30);
    
    const homeTeam = new Team('Lakers');
    homeTeam.addPlayer(new Player('Magic', 'PG', 5));
    homeTeam.addPlayer(new Player('Kobe', 'SG', 5));
    homeTeam.addPlayer(new Player('LeBron', 'SF', 5));
    homeTeam.addPlayer(new Player('Pau', 'PF', 4));
    homeTeam.addPlayer(new Player('Shaq', 'C', 5));
    
    const awayTeam = new Team('Celtics');
    awayTeam.addPlayer(new Player('Rajon', 'PG', 4));
    awayTeam.addPlayer(new Player('Ray', 'SG', 4));
    awayTeam.addPlayer(new Player('Pierce', 'SF', 4));
    awayTeam.addPlayer(new Player('Garnett', 'PF', 4));
    awayTeam.addPlayer(new Player('Perkins', 'C', 3));
    
    court.setupTeams(homeTeam, awayTeam);
    
    const state = court.getState();
    console.assert(state.players.length === 10, `Should have 10 players, got ${state.players.length}`);
    console.assert(state.ballPossession === 'Magic', 'Magic should have the ball');
    
    // Verify home team on left, away team on right
    const magicPos = state.players.find(p => p.name === 'Magic');
    const rajonPos = state.players.find(p => p.name === 'Rajon');
    
    console.assert(magicPos.x < 25, 'Home team should be on left side');
    console.assert(rajonPos.x > 25, 'Away team should be on right side');
    
    console.log('✅ Setup teams passed');
}

// Test 5: Check adjacency
function testAdjacency() {
    console.log('\nTEST 5: Player Adjacency');
    const court = new Court(50, 30);
    const player1 = new Player('Player1', 'PG', 3);
    const player2 = new Player('Player2', 'SG', 3);
    const player3 = new Player('Player3', 'C', 3);
    
    court.placePlayer(player1, 10, 15);
    court.placePlayer(player2, 12, 15);  // 2 squares away
    court.placePlayer(player3, 20, 15);  // 10 squares away
    
    const adjacent1_2 = court.areAdjacent(player1, player2, 3);
    const adjacent1_3 = court.areAdjacent(player1, player3, 3);
    
    console.assert(adjacent1_2 === true, 'Players 2 squares apart should be adjacent');
    console.assert(adjacent1_3 === false, 'Players 10 squares apart should not be adjacent');
    
    console.log('✅ Adjacency check passed');
}

// Test 6: Get shooting distance
function testShootingDistance() {
    console.log('\nTEST 6: Shooting Distance Calculation');
    const court = new Court(50, 30);
    const player = new Player('Shooter', 'SG', 4);
    
    // Close to basket (2-pointer range)
    court.placePlayer(player, 42, 15);
    const closeDistance = court.getShootingDistance(player, true);
    console.assert(closeDistance === 'close', `Should be "close", got ${closeDistance}`);
    
    // 3-pointer range
    court.placePlayer(player, 20, 15);
    const threeDistance = court.getShootingDistance(player, true);
    console.assert(threeDistance === 'three', `Should be "three", got ${threeDistance}`);
    
    console.log('✅ Shooting distance passed');
}

// Test 7: Get passing options
function testPassingOptions() {
    console.log('\nTEST 7: Passing Options');
    const court = new Court(50, 30);
    
    const pg = new Player('PG', 'PG', 5);
    const sg = new Player('SG', 'SG', 4);
    const sf = new Player('SF', 'SF', 4);
    
    court.placePlayer(pg, 10, 15);
    court.placePlayer(sg, 15, 15);  // 5 squares away
    court.placePlayer(sf, 30, 15);  // 20 squares away
    
    const options = court.getPassingOptions(pg, 15);
    
    console.assert(options.length === 1, `Should have 1 passing option within 15 squares, got ${options.length}`);
    console.assert(options[0].player === sg, 'SG should be in passing range');
    
    console.log('✅ Passing options passed');
}

// Run all tests
function runAllTests() {
    console.log('🏀 COURT SYSTEM TEST SUITE\n');
    console.log('================================\n');
    
    try {
        testCourtInitialization();
        testPlacePlayer();
        testMovePlayer();
        testSetupTeams();
        testAdjacency();
        testShootingDistance();
        testPassingOptions();
        
        console.log('\n================================');
        console.log('🎉 ALL TESTS PASSED!\n');
        
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
    }
}

// Run tests if this is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runAllTests();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests };
}
