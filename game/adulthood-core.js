import { ensureHouseholdEconomy } from "./household-economy-v2.js?v=1";
import { ensureAdolescenceState } from "./adolescence.js?v=1";

const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const cash=v=>Math.max(0,Math.round(Number(v)||0));
const months=s=>Number(s.character?.ageMonths)||0;
const years=s=>Math.floor(months(s)/12);
function hash(v){let h=2166136261>>>0;for(const c of String(v??"")){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;return(h^(h>>>16))>>>0;}
const roll=(s,k)=>hash(`${Number(s.seed)||1}:${k}`)/4294967296;

export function adulthoodStage(state){const age=years(state);if(age<18)return null;if(age<21)return"emerging";return"early";}
export const adultStageLabel=state=>adulthoodStage(state)==="emerging"?"Emerging adulthood":"Early adulthood";

const JOBS=[
  {id:"service",title:"Service crew",income:13500,education:"any"},
  {id:"retail",title:"Retail associate",income:14500,education:"any"},
  {id:"customer_support",title:"Customer support",income:20500,education:"secondary"},
  {id:"office_assistant",title:"Office assistant",income:18500,education:"secondary"},
  {id:"logistics",title:"Logistics / delivery work",income:17000,education:"any"},
  {id:"technician",title:"Junior technician",income:21000,education:"technical"},
  {id:"junior_it",title:"Junior IT support",income:27000,education:"technical-or-academic"},
  {id:"tutoring",title:"Tutoring / academic support",income:15000,education:"academic"},
];

function queue(state,item){const a=state.adulthood;if(!item?.key||a.seen.includes(item.key)||a.queue.some(x=>x.key===item.key))return;a.queue.push({priority:50,createdAtMonths:months(state),...item});a.queue.sort((x,y)=>(y.priority||0)-(x.priority||0)||(x.createdAtMonths||0)-(y.createdAtMonths||0));a.queue=a.queue.slice(0,16);}
export function queueAdulthoodEvent(state,item){ensureAdulthoodState(state);queue(state,item);}
export function markAdulthoodSeen(state,event){const a=ensureAdulthoodState(state),key=event?.adulthoodKey;if(!a||!key)return;a.seen=[key,...a.seen.filter(x=>x!==key)].slice(0,180);a.queue=a.queue.filter(x=>x.key!==key);a.recentKinds=[event.adulthoodType,...a.recentKinds.filter(x=>x!==event.adulthoodType)].slice(0,5);}

function currentPartnerId(state){const a=state.adolescence;return a?.romance?.current?.personId||null;}
function childIds(state){return(state.people||[]).filter(p=>p.role==="child"&&!p.deceased).map(p=>p.id);}
function initialContribution(state){ensureHouseholdEconomy(state);return state.household.financeBand==="Tight"?2200:state.household.financeBand==="Getting by"?1500:800;}
function initialAdultState(state){const teen=ensureAdolescenceState(state),kids=childIds(state);return{
  version:1,enteredAtMonths:months(state),stage:adulthoodStage(state),queue:[],seen:[],recentKinds:[],lastAdvancedAtMonths:months(state),lastOrdinaryAtMonths:-24,
  education:{path:"undecided",status:"deciding",institution:null,course:null,tuitionMonthly:0,debt:0,startedAtMonths:null,completionAtMonths:null,completed:false},
  career:{status:"not-working",job:null,incomeMonthly:0,startedAtMonths:null,experienceMonths:0,history:[]},
  finances:{monthlyIncome:0,monthlyExpenses:0,lastNet:0,lastProcessedAtMonths:months(state),personalDebt:0},
  housing:{mode:"family-home",label:"Living with family",rentMonthly:0,contributionMonthly:initialContribution(state),movedOutAtMonths:null},
  relationships:{partnerId:currentPartnerId(state),status:teen?.romance?.current?.status||null,lastReviewAtMonths:months(state)},
  responsibilities:{childIds:kids,childcareMonthly:kids.length*3500,lastParentingEventAtMonths:-24},
  milestones:{housingOffered:false,firstJobDecision:false,educationDecision:false},
};}

export function ensureAdulthoodState(state){if(!state?.character||months(state)<216)return null;state.adulthood||=initialAdultState(state);const a=state.adulthood;a.queue||=[];a.seen||=[];a.recentKinds||=[];a.stage=adulthoodStage(state);a.education||=initialAdultState(state).education;a.career||=initialAdultState(state).career;a.finances||=initialAdultState(state).finances;a.housing||=initialAdultState(state).housing;a.relationships||=initialAdultState(state).relationships;a.responsibilities||=initialAdultState(state).responsibilities;a.milestones||={housingOffered:false,firstJobDecision:false,educationDecision:false};a.responsibilities.childIds=childIds(state);a.responsibilities.childcareMonthly=a.responsibilities.childIds.length*3500;state.money||={cash:0,savings:0};state.money.cash??=0;state.money.savings??=0;if(months(state)<300){state.completed=false;state.lifePhase="adulthood";}if(!a.seen.includes("adult-entry")&&!a.queue.some(x=>x.key==="adult-entry"))queue(state,{key:"adult-entry",type:"adult_entry",priority:100});return a;}

export function setAdultEducation(state,path){const a=ensureAdulthoodState(state),e=a.education,age=months(state);e.path=path;e.startedAtMonths=age;a.milestones.educationDecision=true;if(path==="university"){e.status="studying";e.institution="College / university";e.course="General degree path";e.tuitionMonthly=state.household.financeBand==="Comfortable"?9500:6500;e.completionAtMonths=age+48;}else if(path==="technical"){e.status="training";e.institution="Technical / vocational program";e.course="Practical skills training";e.tuitionMonthly=state.household.financeBand==="Comfortable"?4800:3200;e.completionAtMonths=age+18;}else if(path==="work"){e.status="not-enrolled";e.tuitionMonthly=0;e.completionAtMonths=null;queue(state,{key:`adult-job-search:${age}`,type:"job_search",priority:92});}else{e.status="gap";e.tuitionMonthly=0;e.completionAtMonths=null;queue(state,{key:`adult-gap-next:${age+6}`,type:"gap_checkin",priority:42,notBefore:age+6});}return e;}

function eligibleJobs(state){const path=state.adulthood?.education?.path||"undecided",completed=state.adulthood?.education?.completed;return JOBS.filter(j=>{if(j.education==="any"||j.education==="secondary")return true;if(j.education==="technical")return path==="technical"&&completed;if(j.education==="academic")return path==="university"&&completed;if(j.education==="technical-or-academic")return completed&&["technical","university"].includes(path);return false;});}
export function jobOptions(state,count=3){const jobs=eligibleJobs(state),age=months(state),start=hash(`${state.seed}:adult-jobs:${age}`)%Math.max(1,jobs.length);const out=[];for(let i=0;i<jobs.length&&out.length<count;i++){const j=jobs[(start+i)%jobs.length];if(!out.some(x=>x.id===j.id))out.push({...j,income:Math.round(j.income*(.92+roll(state,`job-pay:${j.id}:${age}`)*.18)/100)*100});}return out;}
export function startAdultJob(state,job){const a=ensureAdulthoodState(state);a.career.status="working";a.career.job={id:job.id,title:job.title};a.career.incomeMonthly=cash(job.income);a.career.startedAtMonths=months(state);a.career.experienceMonths=0;a.career.history.push({ageMonths:months(state),jobId:job.id,title:job.title,incomeMonthly:job.income});a.career.history=a.career.history.slice(-30);a.milestones.firstJobDecision=true;return a.career;}
export function startAdultSexWork(state){return startAdultJob(state,{id:"adult-sex-work",title:"Independent sex work",income:22000+Math.round(roll(state,"adult-sex-work-income")*9000)});}

export function setAdultHousing(state,mode){const a=ensureAdulthoodState(state),h=a.housing;h.mode=mode;h.movedOutAtMonths=mode==="family-home"?null:months(state);if(mode==="roommates"){h.label="Renting with roommates";h.rentMonthly=6000;h.contributionMonthly=0;}else if(mode==="solo"){h.label="Renting alone";h.rentMonthly=10500;h.contributionMonthly=0;}else if(mode==="partner"){h.label="Living with a partner";h.rentMonthly=6500;h.contributionMonthly=0;}else{h.label="Living with family";h.rentMonthly=0;h.contributionMonthly=initialContribution(state);}return h;}

function adultBaseExpenses(state,a){let base=a.housing.mode==="family-home"?2600:6200;base+=a.housing.rentMonthly||0;base+=a.housing.contributionMonthly||0;base+=a.education.tuitionMonthly||0;base+=a.responsibilities.childcareMonthly||0;const preg=state.adolescence?.reproductive?.pregnancy;if(["pregnant","partner-pregnant"].includes(preg?.status))base+=preg.pregnantPerson==="player"?1600:800;return cash(base);}
function takePersonalMoney(state,amount){let due=cash(amount);state.money||={cash:0,savings:0};const fromCash=Math.min(cash(state.money.cash),due);state.money.cash=cash(state.money.cash-fromCash);due-=fromCash;const fromSavings=Math.min(cash(state.money.savings),due);state.money.savings=cash(state.money.savings-fromSavings);due-=fromSavings;return due;}
function processFinances(state,a,elapsed){if(!elapsed)return;const income=cash((a.career.incomeMonthly||0)*elapsed),expenses=cash(adultBaseExpenses(state,a)*elapsed);state.money.cash=cash((state.money.cash||0)+income);if(a.housing.mode==="family-home"&&a.housing.contributionMonthly){state.household.savings=cash((state.household.savings||0)+(a.housing.contributionMonthly||0)*elapsed);}const short=takePersonalMoney(state,expenses);if(short>0)a.finances.personalDebt=cash((a.finances.personalDebt||0)+short);else if(a.finances.personalDebt>0&&income>expenses)a.finances.personalDebt=cash(Math.max(0,a.finances.personalDebt-(income-expenses)*.25));a.finances.monthlyIncome=a.career.incomeMonthly||0;a.finances.monthlyExpenses=adultBaseExpenses(state,a);a.finances.lastNet=a.finances.monthlyIncome-a.finances.monthlyExpenses;a.finances.lastProcessedAtMonths=months(state);a.education.debt=a.finances.personalDebt;}

function advanceEducation(state,a){const e=a.education;if(!e.completionAtMonths||e.completed||months(state)<e.completionAtMonths)return;e.completed=true;e.status="completed";e.tuitionMonthly=0;queue(state,{key:`adult-education-complete:${e.path}:${e.completionAtMonths}`,type:"education_complete",priority:86});}
function advanceCareer(a,elapsed){if(a.career.status==="working")a.career.experienceMonths=(a.career.experienceMonths||0)+elapsed;}
function maybeIncomePressure(state,a){if(a.queue.some(x=>x.type==="income_pressure"))return;const cashOnHand=(state.money?.cash||0)+(state.money?.savings||0),debt=a.finances.personalDebt||0,needsIncome=a.career.status!=="working"&&(debt>=12000||a.responsibilities.childIds.length>0||cashOnHand<1500);if(needsIncome&&months(state)>=216&&roll(state,`adult-income-pressure:${Math.floor(months(state)/6)}`)<.58)queue(state,{key:`adult-income-pressure:${Math.floor(months(state)/6)}`,type:"income_pressure",priority:89});}
function maybeHousing(state,a){if(a.milestones.housingOffered||months(state)<228||a.career.status!=="working")return;if(a.career.incomeMonthly>=15000){a.milestones.housingOffered=true;queue(state,{key:"adult-first-housing-choice",type:"housing_choice",priority:65});}}
function maybeRelationship(state,a){if(months(state)-(a.relationships.lastReviewAtMonths||216)<18)return;a.relationships.lastReviewAtMonths=months(state);if(a.relationships.partnerId)queue(state,{key:`adult-relationship:${Math.floor(months(state)/18)}`,type:"relationship_direction",personId:a.relationships.partnerId,priority:48});else if(roll(state,`adult-dating:${Math.floor(months(state)/12)}`)<.45)queue(state,{key:`adult-dating:${Math.floor(months(state)/12)}`,type:"adult_dating",priority:42});}
function maybeParenting(state,a){if(!a.responsibilities.childIds.length)return;if(months(state)-(a.responsibilities.lastParentingEventAtMonths||-24)<12)return;a.responsibilities.lastParentingEventAtMonths=months(state);queue(state,{key:`adult-parenting:${Math.floor(months(state)/12)}`,type:"parenting_balance",priority:68});}
function maybeCarryoverBirth(state,a){const p=state.adolescence?.reproductive?.pregnancy;if(!p||!["pregnant","partner-pregnant"].includes(p.status)||p.birthAtMonths||p.dueAtMonths==null||months(state)<p.dueAtMonths)return;queue(state,{key:`adult-carryover-birth:${p.conceivedAtMonths}`,type:"carryover_birth",personId:p.partnerId,priority:100});}
function ordinary(state,a){if(a.queue.length)return;if(months(state)-(a.lastOrdinaryAtMonths||-24)<3)return;const types=["adult_routine","adult_friendship","adult_money","adult_independence"].filter(t=>!a.recentKinds.includes(t));const pool=types.length?types:["adult_routine","adult_friendship","adult_money","adult_independence"];const type=pool[hash(`${state.seed}:adult-ordinary:${months(state)}`)%pool.length];queue(state,{key:`${type}:${months(state)}`,type,priority:20});a.lastOrdinaryAtMonths=months(state);}

export function advanceAdulthood(state,elapsed=0,beforeAgeMonths=null){const a=ensureAdulthoodState(state);if(!a||!elapsed||state.death)return state;processFinances(state,a,elapsed);advanceCareer(a,elapsed);advanceEducation(state,a);maybeCarryoverBirth(state,a);maybeIncomePressure(state,a);maybeHousing(state,a);maybeRelationship(state,a);maybeParenting(state,a);for(const item of a.queue){if(item.notBefore&&months(state)>=item.notBefore)item.priority=Math.max(item.priority||0,50);}ordinary(state,a);a.lastAdvancedAtMonths=months(state);return state;}

export function adulthoodSnapshot(state){const a=ensureAdulthoodState(state);if(!a)return null;const partner=a.relationships.partnerId?(state.people||[]).find(p=>p.id===a.relationships.partnerId)||null:null;return{stage:a.stage,stageLabel:adultStageLabel(state),education:{...a.education},career:{...a.career,job:a.career.job?{...a.career.job}:null},finances:{...a.finances,cash:cash(state.money?.cash),savings:cash(state.money?.savings)},housing:{...a.housing},relationships:{...a.relationships,partnerName:partner?.name||null},responsibilities:{...a.responsibilities}};}

export { JOBS };