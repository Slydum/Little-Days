import * as core from "./adulthood-core.js?v=1";

export * from "./adulthood-core.js?v=1";

const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const months=s=>Number(s.character?.ageMonths)||0;
function hash(v){let h=2166136261>>>0;for(const c of String(v??"")){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;return(h^(h>>>16))>>>0;}
const roll=(s,k)=>hash(`${Number(s.seed)||1}:${k}`)/4294967296;
const partner=(s,a)=>{const id=a?.relationships?.partnerId;return id?(s.people||[]).find(p=>p.id===id&&!p.deceased)||null:null;};

const PREFERENCES=[
  {id:"novelty",label:"Novelty / experimentation"},
  {id:"roleplay",label:"Roleplay / fantasy"},
  {id:"power",label:"Power dynamics"},
  {id:"restraint",label:"Restraint / control"},
  {id:"sensory",label:"Sensory play"},
  {id:"tenderness",label:"Affection / tenderness"},
];

function attractionProfile(state,kind="sexual"){
  const sex=state.character?.sex;
  const r=roll(state,`${kind}-orientation-base`);
  const same=sex==="Female"?"women":"men";
  const other=sex==="Female"?"men":"women";
  let profile={men:8,women:8,nonbinary:8,aceSpectrum:false};
  if(r<.09) profile={men:12,women:12,nonbinary:10,aceSpectrum:true};
  else if(r<.18){profile[same]=88;profile[other]=6;profile.nonbinary=22;}
  else if(r<.35){profile.men=72;profile.women=72;profile.nonbinary=68;}
  else{profile[other]=88;profile[same]=6;profile.nonbinary=22;}
  const teenId=state.adolescence?.romance?.current?.personId;
  const teenPartner=teenId?(state.people||[]).find(p=>p.id===teenId):null;
  if(teenPartner?.sex==="Male")profile.men=clamp(profile.men+10);
  if(teenPartner?.sex==="Female")profile.women=clamp(profile.women+10);
  return profile;
}
function candidateLabel(state,profile){
  if(profile.aceSpectrum&&Math.max(profile.men,profile.women,profile.nonbinary)<35)return"Asexual spectrum";
  const high=[profile.men>=55,profile.women>=55,profile.nonbinary>=55].filter(Boolean).length;
  if(high>=2)return"Bisexual / pansexual spectrum";
  const dominant=profile.men>=profile.women?"Male":"Female";
  if(state.character?.sex==="Female")return dominant==="Female"?"Lesbian":"Straight";
  return dominant==="Male"?"Gay":"Straight";
}
function romanticCandidateLabel(state,profile){
  if(profile.aceSpectrum&&Math.max(profile.men,profile.women,profile.nonbinary)<35)return"Aromantic spectrum";
  const high=[profile.men>=55,profile.women>=55,profile.nonbinary>=55].filter(Boolean).length;
  if(high>=2)return"Biromantic / panromantic";
  const dominant=profile.men>=profile.women?"Male":"Female";
  const same=dominant===state.character?.sex;
  return same?"Homoromantic":"Heteroromantic";
}
function orientationCopy(profile){
  if(profile.aceSpectrum&&Math.max(profile.men,profile.women,profile.nonbinary)<35)return"You tend to experience little or infrequent sexual attraction, even though romantic closeness may still matter to you.";
  const men=profile.men>=55,women=profile.women>=55,nb=profile.nonbinary>=55;
  if([men,women,nb].filter(Boolean).length>=2)return"Your attraction does not seem limited to one gender.";
  if(men)return"You have noticed that men are usually the people who catch your attention this way.";
  if(women)return"You have noticed that women are usually the people who catch your attention this way.";
  return"Your attraction still feels difficult to summarize cleanly.";
}
function initialPreferenceSeeds(state){return Object.fromEntries(PREFERENCES.map((p,i)=>[p.id,Math.round(20+roll(state,`adult-pref:${p.id}:${i}`)*70)]));}
function initialSexuality(state){
  const sexual=attractionProfile(state,"sexual"),romantic=roll(state,"romantic-orientation-variation")<.82?{...sexual}:attractionProfile(state,"romantic");
  const d=state.character?.development||{},p=state.character?.personality||{},psych=state.psychology?.dimensions||{};
  return{
    version:1,
    orientation:{sexualProfile:sexual,romanticProfile:romantic,candidateLabel:candidateLabel(state,sexual),romanticCandidateLabel:romanticCandidateLabel(state,romantic),identityLabel:null,romanticLabel:null,certainty:18,disclosed:false,lastReflectionAtMonths:null},
    libido:{baseline:clamp(35+Math.round(roll(state,"adult-libido")*45)),current:50,lastChangedAtMonths:months(state)},
    confidence:clamp(Math.round((d.confidence??50)*.55+(psych.selfWorth??50)*.25+(100-(p.sensitivity??50))*.2)),
    communication:clamp(Math.round((psych.emotionalOpenness??50)*.45+(d.emotionalRegulation??50)*.35+(d.confidence??50)*.2)),
    privacyComfort:clamp(68-Math.round((p.social??50)*.18)+Math.round((p.sensitivity??50)*.12)),
    exploration:clamp(Math.round((p.curiosity??50)*.5+(p.risk??50)*.25+(d.autonomy??50)*.25)),
    preferenceSeeds:initialPreferenceSeeds(state),preferences:[],limits:[],history:[],
    compatibility:{partnerId:null,score:null,lastReviewedAtMonths:null,libidoGap:0,preferenceOverlap:0},
    lastPreferenceAtMonths:-24,lastBoundaryAtMonths:-24,lastLibidoEventAtMonths:-24,
  };
}
function ensureSexuality(state,a){a.sexuality||=initialSexuality(state);const s=a.sexuality;s.orientation||=initialSexuality(state).orientation;s.libido||=initialSexuality(state).libido;s.preferenceSeeds||=initialPreferenceSeeds(state);s.preferences||=[];s.limits||=[];s.history||=[];s.compatibility||={partnerId:null,score:null,lastReviewedAtMonths:null,libidoGap:0,preferenceOverlap:0};s.confidence??=50;s.communication??=50;s.privacyComfort??=50;s.exploration??=50;s.lastPreferenceAtMonths??=-24;s.lastBoundaryAtMonths??=-24;s.lastLibidoEventAtMonths??=-24;return s;}
function queued(a,key){return a.seen?.includes(key)||a.queue?.some(x=>x.key===key);}
function updateLibido(state,s,elapsed){if(!elapsed)return;const stress=state.health?.stress??25,energy=state.health?.energy??60,impact=state.psychology?.mentalHealth?.functionalImpact?.overall||0,pregnancy=state.adolescence?.reproductive?.pregnancy;let target=s.libido.baseline-Math.max(0,stress-45)*.35+Math.max(-12,(energy-55)*.18)-impact*.12;if(["pregnant","partner-pregnant"].includes(pregnancy?.status)&&pregnancy?.pregnantPerson==="player")target-=8;if(state.adulthood?.responsibilities?.childIds?.length)target-=Math.min(10,state.adulthood.responsibilities.childIds.length*4);s.libido.current=clamp(s.libido.current*.7+target*.3);s.libido.lastChangedAtMonths=months(state);}
function partnerProfile(state,p){if(!p)return null;p.adultSexuality||={libido:clamp(35+Math.round(roll(state,`partner-libido:${p.id}`)*45)),communication:clamp(35+Math.round(roll(state,`partner-communication:${p.id}`)*50)),exploration:clamp(30+Math.round(roll(state,`partner-exploration:${p.id}`)*55)),preferenceSeeds:Object.fromEntries(PREFERENCES.map(x=>[x.id,Math.round(20+roll(state,`partner-pref:${p.id}:${x.id}`)*70)]))};return p.adultSexuality;}
export function ensureAdultPartnerSexuality(state,p){return partnerProfile(state,p);}
export function chooseAdultPartnerSex(state,salt="dating"){const a=ensureAdulthoodState(state),s=ensureSexuality(state,a),r=roll(state,`partner-sex:${salt}:${months(state)}`),profile=s.orientation.romanticProfile||s.orientation.sexualProfile,male=Math.max(1,profile.men),female=Math.max(1,profile.women),total=male+female;return r<female/total?"Female":"Male";}
function preferenceOverlap(s,pp){if(!pp)return 50;const prefs=s.preferences.filter(x=>x.strength>0&&!s.limits.includes(x.id));if(!prefs.length)return 50;return clamp(Math.round(prefs.reduce((sum,x)=>sum+(pp.preferenceSeeds?.[x.id]||50),0)/prefs.length));}
function updateCompatibility(state,a,s){const p=partner(state,a);if(!p){s.compatibility={partnerId:null,score:null,lastReviewedAtMonths:s.compatibility.lastReviewedAtMonths,libidoGap:0,preferenceOverlap:0};return;}const pp=partnerProfile(state,p),gap=Math.abs((s.libido.current||50)-(pp.libido||50)),overlap=preferenceOverlap(s,pp),score=clamp(Math.round(70-gap*.55+(s.communication+pp.communication)*.12+(overlap-50)*.28-(p.conflict||0)*.18));s.compatibility={partnerId:p.id,score,lastReviewedAtMonths:s.compatibility.lastReviewedAtMonths,libidoGap:Math.round(gap),preferenceOverlap:overlap};}
function maybeOrientation(state,a,s){if(months(state)<222||s.orientation.identityLabel||s.orientation.lastReflectionAtMonths!=null)return;const key="adult-orientation-reflection";if(!queued(a,key))core.queueAdulthoodEvent(state,{key,type:"sexuality_orientation",priority:45});}
function maybeBoundaries(state,a,s){const p=partner(state,a);if(!p||months(state)-(s.lastBoundaryAtMonths??-24)<9)return;const key=`adult-intimacy-boundaries:${p.id}:${Math.floor(months(state)/12)}`;if(!queued(a,key))core.queueAdulthoodEvent(state,{key,type:"sexuality_boundaries",personId:p.id,priority:44});}
function nextPreference(state,s){const used=new Set([...s.preferences.map(x=>x.id),...s.limits]);const pool=PREFERENCES.filter(p=>!used.has(p.id)&&((s.preferenceSeeds[p.id]||0)>=55||s.exploration>=65));if(!pool.length)return null;return pool[hash(`${state.seed}:adult-pref-next:${months(state)}:${used.size}`)%pool.length];}
function maybePreference(state,a,s){const p=partner(state,a);if(!p||months(state)-(s.lastPreferenceAtMonths??-24)<12||s.preferences.length>=4)return;const pref=nextPreference(state,s);if(!pref)return;if(roll(state,`adult-pref-event:${pref.id}:${Math.floor(months(state)/6)}`)<.58){const key=`adult-preference:${pref.id}`;if(!queued(a,key))core.queueAdulthoodEvent(state,{key,type:"sexuality_preference",personId:p.id,preferenceId:pref.id,priority:40});}}
function maybeCompatibility(state,a,s){const p=partner(state,a);if(!p)return;updateCompatibility(state,a,s);const last=s.compatibility.lastReviewedAtMonths??-24;if(months(state)-last<15)return;const key=`adult-sexual-compatibility:${p.id}:${Math.floor(months(state)/15)}`;if((s.compatibility.score??60)<62&&!queued(a,key))core.queueAdulthoodEvent(state,{key,type:"sexuality_compatibility",personId:p.id,priority:52});else if(s.compatibility.libidoGap>=25&&months(state)-(s.lastLibidoEventAtMonths??-24)>=15&&!queued(a,`${key}:libido`))core.queueAdulthoodEvent(state,{key:`${key}:libido`,type:"sexuality_libido_mismatch",personId:p.id,priority:48});}

export function ensureAdulthoodState(state){if(months(state)<216)return null;const a=core.ensureAdulthoodState(state);if(!a)return null;const s=ensureSexuality(state,a);updateCompatibility(state,a,s);return a;}
export function advanceAdulthood(state,elapsed=0,beforeAgeMonths=null){const next=core.advanceAdulthood(state,elapsed,beforeAgeMonths);const a=core.ensureAdulthoodState(next);if(!a)return next;const s=ensureSexuality(next,a);updateLibido(next,s,elapsed);updateCompatibility(next,a,s);maybeOrientation(next,a,s);maybeBoundaries(next,a,s);maybePreference(next,a,s);maybeCompatibility(next,a,s);return next;}
export function sexualitySnapshot(state){const a=ensureAdulthoodState(state);if(!a)return null;const s=ensureSexuality(state,a),p=partner(state,a);updateCompatibility(state,a,s);return{orientation:{...s.orientation,copy:orientationCopy(s.orientation.sexualProfile)},libido:{...s.libido},confidence:s.confidence,communication:s.communication,privacyComfort:s.privacyComfort,exploration:s.exploration,preferences:s.preferences.map(x=>({...x})),limits:[...s.limits],compatibility:{...s.compatibility,partnerName:p?.name||null},partnerId:p?.id||null};}
export function reflectAdultOrientation(state,choice){const a=ensureAdulthoodState(state),s=ensureSexuality(state,a),o=s.orientation;o.lastReflectionAtMonths=months(state);if(choice==="label"){o.identityLabel=o.candidateLabel;o.romanticLabel=o.romanticCandidateLabel;o.certainty=clamp(o.certainty+30);}else if(choice==="share"){o.identityLabel=o.candidateLabel;o.romanticLabel=o.romanticCandidateLabel;o.certainty=clamp(o.certainty+25);o.disclosed=true;s.communication=clamp(s.communication+4);}else{o.certainty=clamp(o.certainty+8);}s.history.push({type:"orientation-reflection",ageMonths:months(state),choice,label:o.identityLabel||"questioning"});return s;}
export function recordAdultBoundaryTalk(state,choice){const a=ensureAdulthoodState(state),s=ensureSexuality(state,a);s.lastBoundaryAtMonths=months(state);if(choice==="clear"){s.communication=clamp(s.communication+5);s.confidence=clamp(s.confidence+2);}else if(choice==="slow")s.communication=clamp(s.communication+2);else s.communication=clamp(s.communication-3);s.history.push({type:"boundary-conversation",ageMonths:months(state),choice,partnerId:a.relationships.partnerId});return s;}
export function discoverAdultPreference(state,id,choice){const a=ensureAdulthoodState(state),s=ensureSexuality(state,a),def=PREFERENCES.find(x=>x.id===id);if(!def)return s;s.lastPreferenceAtMonths=months(state);if(choice==="no"){if(!s.limits.includes(id))s.limits.push(id);}else if(!s.preferences.some(x=>x.id===id)){s.preferences.push({id,label:def.label,strength:choice==="talk"?2:1,private:choice==="private",discoveredAtMonths:months(state)});if(choice==="talk")s.communication=clamp(s.communication+3);}s.history.push({type:"preference-discovery",ageMonths:months(state),preferenceId:id,choice});return s;}
export function reviewAdultCompatibility(state,choice){const a=ensureAdulthoodState(state),s=ensureSexuality(state,a),p=partner(state,a);s.compatibility.lastReviewedAtMonths=months(state);if(choice==="talk"){s.communication=clamp(s.communication+4);if(p)p.trust=clamp((p.trust||50)+3);}else if(choice==="limits"){s.confidence=clamp(s.confidence+3);if(p)p.trust=clamp((p.trust||50)+1);}else if(choice==="reconsider"&&p)p.conflict=clamp((p.conflict||0)+3);s.history.push({type:"compatibility-review",ageMonths:months(state),choice,partnerId:p?.id||null});updateCompatibility(state,a,s);return s;}
export function noteAdultLibidoMismatch(state,choice){const a=ensureAdulthoodState(state),s=ensureSexuality(state,a),p=partner(state,a);s.lastLibidoEventAtMonths=months(state);s.compatibility.lastReviewedAtMonths=months(state);if(choice==="talk"){s.communication=clamp(s.communication+3);if(p)p.trust=clamp((p.trust||50)+2);}else if(choice==="pressure"){if(p)p.conflict=clamp((p.conflict||0)+5);s.communication=clamp(s.communication-4);}else s.confidence=clamp(s.confidence+2);return s;}

export { PREFERENCES };