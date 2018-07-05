/* eslint-disable no-console */

import path from 'path';
import { Factory } from '../';

describe( 'factory', () => {
  it( 'generates an array of competitors from a specified website', async () => {
    const CACHE_DIR = path.join( __dirname, 'cache' );
    const factoryObj = new Factory( CACHE_DIR );
    factoryObj.scraperObj.setThrottleDelay( 100 );

    const regions = await factoryObj.generate();

    regions.forEach( ( region ) => {
      region.divisions.forEach( ( division ) => {
        division.teams.forEach( team => console.warn( team.squad ) );
      });
    });
  });
});