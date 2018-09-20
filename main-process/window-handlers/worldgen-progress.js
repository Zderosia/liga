// @flow
import path from 'path';
import { ipcMain } from 'electron';
import ProgressBar from 'electron-progressbar';
import Models from '../../database/models';
import { ScraperFactory } from '../../common/scraper-factory';

import type {
  Team as ESEA_CSGO_Team,
  Player as ESEA_CSGO_Player,
  Division as ESEA_CSGO_Division,
  Region as ESEA_CSGO_Region,
  Regions as ESEA_CSGO_Regions,
} from '../../common/scraper-factory/scrapers/esea-csgo';
import type {
  Regions as ESEA_CSGO_FA_Regions,
  Player as ESEA_CSGO_FA_Player
} from '../../common/scraper-factory/scrapers/esea-csgo-freeagents';


const CACHE_DIR = path.join( __dirname, 'cache' );
const WIN_OPTS = {
  text: 'Creating world.',
  detail: 'Generating free agents...',
  browserWindow: {
    titleBarStyle: 'hidden'
  }
};

const {
  Country,
  Division,
  Game,
  Meta,
  Team,
  Player
} = Models;

function generateFreeAgents(): Promise<ESEA_CSGO_FA_Regions> {
  return new ScraperFactory(
    CACHE_DIR, 'esea-csgo-freeagents'
  ).generate();
}

function generateTeamsAndPlayers(): Promise<ESEA_CSGO_Regions> {
  return new ScraperFactory(
    CACHE_DIR, 'esea-csgo'
  ).generate();
}

async function savePlayers(
  playerList: Array<Object>,
  teamObj: Object | void = undefined
): Promise<any> {
  const countries = await Country.findAll();

  // loop through our playerList and add to a collection of promises
  const playerPromises = playerList.map( async ( player: Object ) => {
    // create the initial player model and save to the DB
    // necessary in order to register model associations
    const playerObj = await Player.create({
      username: player.username,
      transferValue: player.transferValue
    });

    // add the player's country (if found)
    const countryObj = countries.find( country => (
      country.code === player.countryCode
    ) );

    if( countryObj ) {
      playerObj.setCountry( countryObj );
    }

    // anything that isn't the below fields is a metadata
    // field that needs to be registered with the DB first
    const keys = Object.keys( player ).filter( ( key: string ) => (
      key !== 'id'
      && key !== 'username'
      && key !== 'transferValue'
      && key !== 'countryCode'
      && key !== 'teamId'
    ) );

    // register all the metadata associated with this player
    // and store it in an array of promises. only continue when
    // all metadata has been saved to the DB...
    const metapromises = keys.map( async ( key: string ) => {
      // if the metadata field exists return it
      let metaObj = await Meta.findAll({
        where: { name: key }
      });

      // otherwise create it
      if( !metaObj ) {
        metaObj = await Meta.create({ name: key });
      }

      // Skipping flow checks for now. Complaining about the
      // player object not being iterable...
      return playerObj.addMeta( metaObj, {
        // $FlowSkip
        through: { value: player[ key ] }
      });
    });

    // return only after all metadata promises
    // have resolved
    return Promise.all( metapromises );
  });

  // return after all player promises have resolved
  return Promise.all( playerPromises );
}

async function saveFreeAgents( regions: ESEA_CSGO_FA_Regions ): Promise<any> {
  // merge the arrays that are separated by region into
  // one so that *all* players can be looped through and added
  // to our collection of promises
  const playerList = [];

  Object.keys( regions ).forEach( ( regionKey: string ) => {
    playerList.push( ...regions[ regionKey ] );
  });

  // loop through our playerList and add to a collection of promises
  const playerPromises = savePlayers( playerList );

  // return after all regions' promises have resolved
  return Promise.all( [ playerPromises ] );
}

async function saveTeamsAndPlayers( regions: ESEA_CSGO_Regions ): Promise<any> {
  const countries = await Country.findAll();
  const divisions = await Division.findAll();

  // game is hardcoded for now
  const gameObj = await Game.fineOne({
    where: { shortname: 'csgo' }
  });

  regions.forEach( ( region: ESEA_CSGO_Region ) => {
    region.divisions.forEach( ( division: ESEA_CSGO_Division ) => {
      // fetch the current division object model
      const divisionObj = divisions.find( div => (
        div.name === division.name
      ) );

      const divisionPromises = division.teams.map( async ( team: ESEA_CSGO_Team ) => {
        // create the team object model
        const teamObj = await Team.create({
          name: team.name,
          budget: 0.00
        });

        // get the team's country object model
        const countryObj = countries.find( country => (
          country.code === team.countryCode
        ) );

        // add the rest of the team's associations
        teamObj.setCountry( countryObj );
        teamObj.setDivision( divisionObj );
        teamObj.setGame( gameObj );

        // look for the following keys to associate as metadata
        const keys = Object.keys( team ).filter( ( key: string ) => (
          key === 'placement'
          || key === 'tag'
          || key === 'skillTemplate'
        ) );

        // register all the metadata associated with this team
        // and store it in an array of promises. only continue when
        // all metadata has been saved to the DB...
        const metapromises = keys.map( async ( key: string ) => {
          // if the metadata field exists return it
          let metaObj = await Meta.findAll({
            where: { name: key }
          });

          // otherwise create it
          if( !metaObj ) {
            metaObj = await Meta.create({ name: key });
          }

          // Skipping flow checks for now. Complaining about the
          // team object not being iterable...
          return teamObj.addMeta( metaObj, {
            // $FlowSkip
            through: { value: team[ key ] }
          });
        });

        // create all players within this team's squad
        // and associate with the team as well. note we're also
        // storing the results in an array of promises
        const squadpromises = savePlayers( team.squad, teamObj );

        // return once metadata and squad has been saved to the database
        return Promise.all( [ ...metapromises, squadpromises ] );
      });

      // return once all divisions and their teams have been saved to the database
      return Promise.all( divisionPromises );
    });
  });
  return Promise.resolve( 'boop' );
}

async function ipcHandler( event: Object, data: Array<Object> ) {
  // create a new window that shows the world gen progress
  // to the user
  const win = new ProgressBar( WIN_OPTS );

  generateFreeAgents()
    .then( ( regions: ESEA_CSGO_FA_Regions ) => {
      win.detail = 'Saving free agents to database...';
      return saveFreeAgents( regions );
    })
    .then( () => {
      win.detail = 'Generating teams and players...';
      return generateTeamsAndPlayers();
    })
    .then( ( regions: ESEA_CSGO_Regions ) => {
      win.detail = 'Saving teams and players to database...';
      return Promise.resolve();
      // return saveTeamsAndPlayers( regions );
    })
    .then( () => {
      win.detail = 'Generating leagues...';
    })
    .catch( ( err: Error ) => {
      console.log( err );
    })
    .finally( () => {
      setTimeout( () => win.setCompleted(), 5000 );
    });
}

export default () => {
  ipcMain.on( 'new-career', ipcHandler );
};