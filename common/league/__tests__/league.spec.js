// @flow
import adjectiveAnimal from 'adjective-animal';
import { League, Division } from '../';
import { generateGroupStageScores, generatePlayoffScores } from './division.spec';

/**
  * Promotional playoffs exists for all divs below Invite (Array.length - 1).
  * Taking a look at the EPL and the Championship's promotion format:
  *
  * EPL: 15% move down (20 players, 3 move down = 15%)
  * Championship: 12.5% (24 players, 3 move up = 12.5%)
  *
  * That means:
  * OPEN Division
  * = 256 competitors, 32 conferences, 8 competitors each
  * = 38 move up (256 * 15% = 38.4)
  *   = 32 automatic promotion (1st place)
  *   = 6 promotion playoff winners (see below)
  *
  *   Promotion Playoffs
  *   = 96 qualify for playoffs (3 from each conference(2nd, 3rd, 4th) * 32 conferences)
  *   = 6 playoff brackets (96/6 = 16 competitors per bracket)
  *
  * INTERMEDIATE Division
  * = 128 competitors, 16 conferences, 8 competitors each
  * = 19 move up (128 * 15% = 19.2)
  *   = 16 automatic promotion (1st place)
  *   = 3 promotion playoff winners (see below)
  *
  *   Promotion Playoffs
  *   = 48 qualify for playoffs (3 from each conference(2nd, 3rd, 4th) * 16 conferences)
  *   = 3 playoff brackets (48/3 = 16 competitors per bracket)
  *
  * MAIN Division
  * = 64 competitors, 8 conferences, 8 competitors each
  * = 10 move up (64 * 15% = 9.6)
  *   = 8 automatic promotion (1st place)
  *   = 2 promotion playoff winners (see below)
  *
  *   Promotion Playoffs
  *   = 24 qualify for playoffs (3 from each conference(2nd, 3rd, 4th) * 8 conferences)
  *   = 2 playoff brackets (24/2 = 12 competitors per bracket)
  *
  * PREMIER Division
  * = 32 competitors, 4 conferences, 8 competitors each
  * = 5 move up (32 * 15% = 4.8)
  *   = 4 automatic promotion (1st place)
  *   = 1 promotion playoff winner (see below)
  *
  *   Promotion Playoffs
  *   = 12 qualify for playoffs (3 from each conference(2nd, 3rd, 4th) * 4 conferences)
  *   = 1 playoff bracket
**/
describe( 'league', () => {
  const LEAGUE_NAME = 'CAL';
  const DIVISIONS = [
    { name: 'Open', size: 256, confSize: 8 },
    { name: 'Intermediate', size: 128, confSize: 8 },
    { name: 'Main', size: 64, confSize: 8 },
    { name: 'Premier', size: 32, confSize: 8 },
    { name: 'Invite', size: 16, confSize: 16 }
  ];

  // used for division tests
  const RAND_DIV_NAME = 'Random Division';
  const RAND_DIV_SIZE = 64;
  const RAND_DIV_CONF_SIZE = 8;

  let leagueObj;

  beforeEach( () => {
    // initialize league
    leagueObj = new League( LEAGUE_NAME );

    // populate the league with divisions and competitors
    DIVISIONS.forEach( ( div ) => {
      const divObj = leagueObj.addDivision( div.name, div.size, div.confSize );

      for( let i = 0; i < div.size; i++ ) {
        divObj.addCompetitor( adjectiveAnimal.generateName() );
      }
    });
  });

  it( 'adds a division and returns it', () => {
    const divObj = leagueObj.addDivision( RAND_DIV_NAME, RAND_DIV_SIZE, RAND_DIV_CONF_SIZE );
    expect( divObj ).toBeInstanceOf( Division );
  });

  it( 'gets a division by name', () => {
    const divObj = leagueObj.addDivision( RAND_DIV_NAME, RAND_DIV_SIZE, RAND_DIV_CONF_SIZE );
    expect( leagueObj.getDivision( RAND_DIV_NAME ) ).toEqual( divObj );
  });

  it( "checks that all division's group stage matches are done", () => {
    // start the league
    leagueObj.start();

    // generate group stage scores for each division
    leagueObj.divisions.forEach( ( division: Division ) => {
      const divObj = leagueObj.getDivision( division.name );
      generateGroupStageScores( divObj.conferences );
    });

    expect( leagueObj.isGroupStageDone() ).toBeTruthy();
  });

  it( "checks that a division's promotion playoffs are done", () => {
    // start the league
    leagueObj.start();

    // generate group stage scores for each division
    leagueObj.divisions.forEach( ( division: Division ) => {
      const divObj = leagueObj.getDivision( division.name );
      generateGroupStageScores( divObj.conferences );
    });

    // start post-season if all group stages are done
    if( leagueObj.isGroupStageDone() ) {
      leagueObj.startPostSeason();
    }

    // generate playoff scores for each division
    leagueObj.divisions.forEach( ( division: Division ) => {
      const divObj = leagueObj.getDivision( division.name );
      generatePlayoffScores( divObj.promotionConferences );
    });

    expect( leagueObj.isDone() ).toBeTruthy();
  });

  it( 'runs through a whole season', () => {
    // start the league
    leagueObj.start();

    // generate group stage scores
    leagueObj.divisions.forEach( ( division: Division ) => {
      const divObj = leagueObj.getDivision( division.name );
      const { conferences } = divObj;

      generateGroupStageScores( conferences );
    });

    // start the league's post-season if all group stage matches are done
    if( leagueObj.isGroupStageDone() ) {
      leagueObj.startPostSeason();
    }

    // loop through each division and generate playoff scores
    leagueObj.divisions.forEach( ( division: Division ) => {
      const divObj = leagueObj.getDivision( division.name );

      // now generate the playoff scores
      generatePlayoffScores( divObj.promotionConferences );
    });

    // if league's post-season is done compile list of winners
    if( leagueObj.isDone() ) {
      leagueObj.endPostSeason();
    }

    // handle promotions and relegations
    // start the next season
    // promotions = conferenceWinners, promotionWinners
    // relegations = conferenceWinners.length + promotionWinners.length
    // TODO: leagueObj.end()
  });
});