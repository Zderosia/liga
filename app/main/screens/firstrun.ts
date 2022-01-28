import path from 'path';
import moment from 'moment';
import is from 'electron-is';
import * as IPCRouting from 'shared/ipc-routing';
import * as Models from 'main/database/models';
import { ipcMain, Menu } from 'electron';
import { IterableObject } from 'shared/types';
import { Screen } from 'main/lib/screen-manager/types';
import { AppLogo } from 'main/lib/cached-image';
import Worldgen from 'main/lib/worldgen';
import ScreenManager from 'main/lib/screen-manager';
import DefaultMenuTemplate from 'main/lib/default-menu';
import Application from 'main/constants/application';


/**
 * Module level variables, constants, and types
 */

// variables
let screen: Screen;
const applogo = new AppLogo();


// constants
const PORT = process.env.PORT || 3000;
const WIDTH = 1024;
const HEIGHT = 768;
const CONFIG = {
  url: is.production()
    ? `file://${path.join( __dirname, 'dist/renderer/screens/firstrun/index.html' )}`
    : `http://localhost:${PORT}/screens/firstrun/index.html`,
  opts: {
    backgroundColor: '#f5f5f5', // "whitesmoke"
    width: WIDTH,
    height: HEIGHT,
    minWidth: WIDTH,
    minHeight: HEIGHT,
    maximizable: false,
    resizable: false,
    minimizable: false,
    icon: applogo.getPath()
  }
};


/**
 * Utility functions
 */

function openMainWindow() {
  // wait a few seconds before opening the main window
  setTimeout( () => {
    ipcMain.emit( IPCRouting.Worldgen.EMAIL_INTRO );
    ipcMain.emit( IPCRouting.Main.OPEN );
    screen.handle.close();
  }, 2000 );
}


/**
 * World gen functions
 */

async function saveplayer( data: IterableObject<any>[] ) {
  const [ userinfo, teaminfo, squadinfo ] = data;

  // get the countryids
  const teamcountry = await Models.Country.findOne({ where: { name: teaminfo.country }});
  const playercountry = await Models.Country.findOne({ where: { name: userinfo.country }});

  // build team object
  const team = await Models.Team.create({
    name: teaminfo.name,
    tier: 4,
  });

  // build player object
  const player = await Models.Player.create({
    alias: userinfo.alias,
    tier: 4,
  });

  // save player's squad to their team
  const squad = await Models.Player.findAll({
    where: {
      id: squadinfo.map( ( p: any ) => p.id )
    }
  });
  await Promise.all([
    ...squad.map( squadmember => squadmember.setTeam( team ) ),
    ...squad.map( squadmember => squadmember.update({ transferListed: false }) ),
  ]);

  // build the first season date
  const today = moment([
    Application.PRESEASON_FIRST_YEAR,
    Application.PRESEASON_START_MONTH,
    Application.PRESEASON_START_DAY,
  ]);

  // create the new user profile
  const profile = await Models.Profile.create({
    currentDate: today,
    currentSeason: Application.PRESEASON_FIRST_YEAR,
  });

  // save associations and return as a single promise
  return Promise.all([
    team.setCountry( teamcountry as Models.Country ),
    player.setTeam( team ),
    player.setCountry( playercountry as Models.Country ),
    profile.setTeam( team ),
    profile.setPlayer( player )
  ]);
}


/**
 * IPC Handlers
 */

async function saveFirstRunHandler( evt: object, data: IterableObject<any>[] ) {
  Promise.resolve( data )
    // save the player information
    .then( saveplayer )

    // assign a manager+astmanager to the new team
    .then( Worldgen.assignManagers )

    // generate the competitions
    .then( Worldgen.Competition.genAllComps )

    // generate wages
    .then( Worldgen.calculateWages )

    // add preseason checks
    .then( Worldgen.preseasonChecks )

    // set a start date for the next season
    .then( Worldgen.Competition.nextSeasonStartDate )

    // schedule the end of season prize money distribution
    .then( Worldgen.schedulePrizeMoneyDistribution )

    // schedule the end of season report
    .then( Worldgen.scheduleEndSeasonReport )

    // finished!
    .then( openMainWindow )
  ;
}


function openWindowHandler() {
  screen = ScreenManager.createScreen(
    IPCRouting.FirstRun._ID,
    CONFIG.url,
    CONFIG.opts
  );
  screen.handle.setMenu( DefaultMenuTemplate );

  // the `setMenu` function above doesn't work on
  // osx so we'll have to accomodate for that
  if( is.osx() ) {
    Menu.setApplicationMenu( DefaultMenuTemplate );
  }
}


export default () => {
  // ipc listeners
  ipcMain.on( IPCRouting.FirstRun.OPEN, openWindowHandler );
  ipcMain.on( IPCRouting.FirstRun.SAVE, saveFirstRunHandler );
};
