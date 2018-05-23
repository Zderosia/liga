// @flow
import { find, chunk } from 'lodash';
import cuid from 'cuid';
import GroupStage from 'groupstage';
import Division from './division';

class League {
  name: string
  divisions: Array<Division> = []

  constructor( name: string ) {
    this.name = name;
  }

  addDivision = ( name: string, size: number = 128, conferenceSize: number = 8 ): Division => {
    // TODO: first check that division does not already exist in array
    const div = new Division( name, size, conferenceSize );
    this.divisions.push( div );

    return div;
  }

  getDivision = ( name: string ) => {
    const div = find( this.divisions, item => item.name === name );
    return div;
  }

  start = (): void => {
    this.divisions.forEach( ( div: Division ) => {
      // keep a copy of the groupstage object and store into memory
      // groupstage lib makes each competitor face *all* others in same group.
      // so — split each division into "conferences" where each competitor only plays N matches
      const conferences = chunk( div.competitors, div.conferenceSize ).map( ( conf: Array<Competitor> ) => ({
        id: cuid(),
        competitors: conf,
        groupObj: new GroupStage( conf.length, { groupSize: div.conferenceSize })
      }) );
      div.setConferences( conferences );
    });
  }

  isGroupStageDone = (): boolean => {
    // loop through each division and ensure all are done
    // bail on first false instance
    let done = true;

    // using a for loop here instead of Array.forEach
    // because the latter does not support `break`
    for( let i = 0; i < this.divisions.length; i++ ) {
      const divObj = this.divisions[ i ];
      if( !divObj.isGroupStageDone() ) {
        done = false;
        break;
      }
    }

    return done;
  }

  isDone = (): boolean => {
    // loop through each division and ensure all are done
    // bail on first false instance
    let done = true;

    // using a for loop here instead of Array.forEach
    // because the latter does not support `break`
    for( let i = 0; i < this.divisions.length; i++ ) {
      const divObj = this.divisions[ i ];
      if( !divObj.isDone() ) {
        done = false;
        break;
      }
    }

    return done;
  }

  startPostSeason = (): void => {
    this.divisions.forEach( ( divObj: Division ) => {
      divObj.startPostSeason();
    });
  }

  endPostSeason = (): void => {
    this.divisions.forEach( ( divObj: Division ) => {
      divObj.endPostSeason();
    });
  }
}

export default League;