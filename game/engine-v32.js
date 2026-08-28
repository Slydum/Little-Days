import * as core from "./engine-v31.js?v=1";
import * as timeline from "./engine-v29.js?core=adulthood-v1";

export * from "./engine-v31.js?v=1";

const ADULT_START=18*12;
const FOUNDATION_END=25*12;

export function createNewLife(seed=Date.now()){const state=core.createNewLife(seed);state.lifePhase="childhood";return state;}
export function continueLife(state){const age=state.character?.ageMonths||0;if(age<ADULT_START)return core.continueLife(state);if(age>=FOUNDATION_END)return state;if(state.completed)state.completed=false;state.lifePhase="adulthood";state.currentEventId=null;const next=timeline.continueLife(state);const nextAge=next.character?.ageMonths||0;if(nextAge<FOUNDATION_END){next.completed=false;next.lifePhase="adulthood";next.currentEventId=null;}else{next.completed=true;next.lifePhase="young-adulthood-foundation-complete";next.currentEventId=null;}return next;}