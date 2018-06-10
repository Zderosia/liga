/* eslint-disable no-console */

import path from 'path';
import fs from 'fs';
import mock from 'mock-fs';

import { Factory } from '../';

// NOTE: workaround for a bug in mock-fs
// SEE: https://github.com/facebook/jest/issues/5792#issuecomment-376678248
console.log = jest.fn();
console.warn();

describe( 'factory', () => {
  beforeAll( () => {
    // declare config as a variable
    // to later add a key whose value is derived from a function
    const config = {
      '/var/cache/1527561594990_my-file.html': fs.readFileSync(
        path.join( __dirname, '1527561594990_my-file.html' )
      )
    };

    // add the parent directory as a path to test default path later
    config[ path.join( __dirname, '../' ) ] = {/* empty directory */};
    mock( config );
  });

  afterAll( () => {
    mock.restore();
  });

  it( 'generates an array of competitors from a specified website', async () => {
    const factoryObj = new Factory( 'http://nowhere.com', 'my-file', '/var/cache' );
    factoryObj.scraperObj.setThrottleDelay( 100 );

    console.warn( await factoryObj.generate() );
  });
});