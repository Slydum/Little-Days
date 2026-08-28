import * as core from "./engine-v30.js?v=1";
import * as timeline from "./engine-v29.js?core=adolescence-v1";

export * from "./engine-v30.js?v=1";

const TEEN_START=13*12;
const ADULT_START=18*12;

export function createNewLife(seed=Date.now()){const state=core.createNewLife(seed);state.lifePhase="childhood";return state;}

export function continueLife(state){const age=state.character?.ageMonths||0;if(age<TEEN_START){const next=core.continueLife(state);if((next.character?.ageMonths||0)>=TEEN_START&&(next.character?.ageMonths||0)<ADULT_START){next.completed=false;next.lifePhase="adolescence";next.currentEventId=null;}return next;}
if(age>=ADULT_START)return state;
if(state.completed)state.completed=false;
state.lifePhase="adolescence";
const next=timeline.continueLife(state);
const nextAge=next.character?.ageMonths||0;
if(nextAge<ADULT_START){next.completed=false;next.lifePhase="adolescence";next.currentEventId=null;}else{next.completed=true;next.lifePhase="adulthood-ready";next.currentEventId=null;}
return next;}
