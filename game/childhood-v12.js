import * as core from "./childhood-v11.js?v=1";
import { adolescenceEventForState, adolescenceSnapshot, advanceAdolescence, commitAdolescenceEvent, ensureAdolescenceState } from "./adolescence.js?v=1";

export * from "./childhood-v11.js?v=1";
export { adolescenceSnapshot } from "./adolescence.js?v=1";

const months=s=>Number(s.character?.ageMonths)||0;
const isTeen=s=>months(s)>=156;

function teenFriends(state){return(state.people||[]).filter(p=>p.role==="friend"&&!p.deceased&&p.school?.friendshipStatus!=="former").sort((a,b)=>(b.closeness||0)-(a.closeness||0));}
function teenClassmates(state,a){const ids=new Set(a?.education?.classmateIds||[]);return(state.people||[]).filter(p=>ids.has(p.id)&&!p.deceased);}

export function ensureChildhoodState(state){const next=core.ensureChildhoodState(state);if(isTeen(next))ensureAdolescenceState(next);return next;}

export function advanceChildhoodWorld(state,elapsedMonths=0,beforeAgeMonths=null){const before=beforeAgeMonths??Math.max(0,months(state)-elapsedMonths);let next=state;if(before<156)next=core.advanceChildhoodWorld(state,elapsedMonths,beforeAgeMonths);else core.ensureChildhoodState(next);if(isTeen(next)){ensureAdolescenceState(next);advanceAdolescence(next,elapsedMonths,beforeAgeMonths);}return next;}

export function childhoodEventForState(state){ensureChildhoodState(state);if(isTeen(state))return adolescenceEventForState(state);return core.childhoodEventForState(state);}

export function commitChildhoodEvent(state,event,choice){if(event?.adolescenceKey){commitAdolescenceEvent(state,event,choice);return state;}const next=core.commitChildhoodEvent(state,event,choice);if(isTeen(next))ensureAdolescenceState(next);return next;}

export function socialSnapshot(state){ensureChildhoodState(state);if(!isTeen(state))return core.socialSnapshot(state);const a=adolescenceSnapshot(state),fs=teenFriends(state),classmates=teenClassmates(state,a);const currentId=a?.romance?.current?.personId;const crush=currentId?(state.people||[]).find(p=>p.id===currentId)||null:null;return{stage:"adolescence",stageLabel:a?.stageLabel||"Adolescence",friends:fs,friendTiers:fs.map((person,index)=>({person,tier:index===0&&(person.closeness||0)>=74?"Best friend":(person.closeness||0)>=62?"Close friend":"Friend"})),closest:fs[0]||null,crush,crushIntensity:crush?65:null,crushReciprocity:a?.romance?.current?.status||null,socialConfidence:a?.social?.standing??state.childhood?.socialConfidence??50,classmates,school:schoolWorldSnapshot(state)};}

export function schoolWorldSnapshot(state){ensureChildhoodState(state);if(!isTeen(state))return core.schoolWorldSnapshot(state);const a=adolescenceSnapshot(state);if(!a)return null;const conventional=["public","private"].includes(a.education.mode);const classmates=conventional?teenClassmates(state,a):[];const fs=teenFriends(state);const teacher=a.education.teacherNames?.[0]?{id:"secondary-teachers",name:a.education.teacherNames.join(", "),role:"teacher"}:null;return{grade:a.education.grade,term:conventional?(state.date?.month<=3?"Term 3 · January–April":state.date?.month<=7?"Term 1 · June–August":"Term 2 · September–December"):a.education.mode==="homeschool"?"Flexible home-study schedule":"No current school term",teacher,teacherSupport:state.childhood?.school?.teacherSupport??55,attendance:a.education.mode==="out-of-school"?0:a.education.mode==="homeschool"?100:state.childhood?.school?.attendance??94,effort:state.childhood?.school?.effort??55,performance:{...(state.education?.subjects||{})},overallPerformance:Math.round(Object.values(state.education?.subjects||{}).reduce((n,v)=>n+(+v||0),0)/Math.max(1,Object.keys(state.education?.subjects||{}).length)),classmates,friends:fs,friendTiers:fs.map((person,index)=>({person,tier:index===0?"Close friend":"Friend"})),rivals:classmates.filter(p=>(p.conflict||0)>=55),activities:state.childhood?.school?.activities||[],access:{mode:a.education.mode,modeLabel:a.education.mode==="private"?"Private secondary school":a.education.mode==="public"?"Public secondary school":a.education.mode==="homeschool"?"Home study":"Not currently enrolled",name:a.education.institutionName,tuitionMonthly:a.education.tuitionMonthly,monthlyCost:a.education.monthlyCost,classSize:a.education.classSize,arrears:a.education.arrears}};}
