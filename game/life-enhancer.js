const STORAGE_KEY = "little-days-save-v2";
const RELOAD_PREFIX = "little-days-enhancer-reload-v27";
const HONORIFICS = new Set(["Lola", "Lolo", "Auntie", "Uncle", "Tita", "Tito"]);

const ITEM_CATALOG = [
  { key:"blanket", name:"soft blanket", kind:"Comfort", min:0, max:48 },
  { key:"plush", name:"plush rabbit", kind:"Toy", min:6, max:84 },
  { key:"blocks", name:"building blocks", kind:"Toy", hobby:"making", min:18, max:96 },
  { key:"crayons", name:"crayon set", kind:"Creative", hobby:"drawing", min:24, max:132 },
  { key:"picture-book", name:"picture book", kind:"Book", hobby:"reading", min:18, max:84 },
  { key:"storybook", name:"storybook", kind:"Book", hobby:"reading", min:60, max:156 },
  { key:"sketchbook", name:"sketchbook", kind:"Creative", hobby:"drawing", min:60, max:156 },
  { key:"craft-kit", name:"small craft kit", kind:"Creative", hobby:"making", min:60, max:156 },
  { key:"keyboard", name:"little keyboard", kind:"Music", hobby:"music", min:42, max:156 },
  { key:"garden-set", name:"small gardening set", kind:"Hobby", hobby:"gardening", min:60, max:156 },
  { key:"cookbook", name:"children's cookbook", kind:"Hobby", hobby:"cooking", min:84, max:156 },
  { key:"handheld", name:"handheld game", kind:"Game", hobby:"gaming", min:84, max:156, comfortableOnly:true },
];

const OUTSIDE_FIRST = ["Alex","Jamie","Rina","Marco","Celine","Theo","Sam","Dani","Nico","Mara","Paolo","Iris"];
const OUTSIDE_LAST = ["Santos","Garcia","Lim","Tan","Cruz","Mendoza","Flores","Ramos","Villanueva","Navarro"];

function readState(){
  try { const state=JSON.parse(localStorage.getItem(STORAGE_KEY)); return state?.version===2?state:null; }
  catch { return null; }
}
function saveState(state){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function clamp(value,min=0,max=100){ return Math.max(min,Math.min(max,value)); }
function esc(value){ return String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }

function displayName(person,fallback="Someone"){
  const parts=String(person?.name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return fallback;
  return HONORIFICS.has(parts[0])&&parts[1]?`${parts[0]} ${parts[1]}`:parts[0];
}

function ensureState(state){
  const seed=((Number(state.seed)||1)^0x4f1bbcdc)>>>0;
  state.lifeEnhancer ||= { version:2, lastProcessedAgeMonths:state.character?.ageMonths||0, dramaRngState:seed||1 };
  state.lifeEnhancer.version=2;
  state.lifeEnhancer.lastProcessedAgeMonths ??= state.character?.ageMonths||0;
  state.lifeEnhancer.dramaRngState ||= seed||1;
  state.possessions ||= { items:[], giftsReceived:0, giftsGiven:0, practiceHistory:[] };
  state.possessions.items ||= [];
  state.possessions.practiceHistory ||= [];
  state.relationshipDrama ||= { history:[] };
  state.relationshipDrama.history ||= [];
  state.worldEvents ||= [];
  state.realism ||= {};
  state.realism.latest ||= [];
  state.realism.family ||= {};
  return state;
}

function seededNumber(state,salt=0){
  let value=((Number(state.seed)||1)^(Number(state.character?.ageMonths)||0)^salt)>>>0;
  value=(value*1664525+1013904223)>>>0;
  return value/4294967296;
}
function dramaRandom(state){
  state.lifeEnhancer.dramaRngState=(state.lifeEnhancer.dramaRngState*1664525+1013904223)>>>0;
  return state.lifeEnhancer.dramaRngState/4294967296;
}

function addWorldUpdate(state,category,text,importance=2,person=null,relatedPerson=null){
  const item={category,text,note:text,importance,ageMonths:state.character.ageMonths,date:{...state.date},personId:person?.id||null,relatedPersonId:relatedPerson?.id||null,source:"life-enhancer"};
  state.realism.latest.unshift({...item});
  state.realism.latest=state.realism.latest.slice(0,7);
  state.worldEvents.push(item);
  state.worldEvents=state.worldEvents.slice(-90);
  return item;
}

function repairNamedText(text,person){
  if(!text||!person)return text;
  const short=displayName(person,"");
  const parts=short.split(/\s+/);
  if(parts.length<2||!HONORIFICS.has(parts[0]))return text;
  const honorific=parts[0],given=parts[1];
  const repeated=new RegExp(`^${esc(honorific)}(?:\\s+${esc(given)})+\\b`,"i");
  if(repeated.test(text)) return text.replace(repeated,`${honorific} ${given}`);
  if(text===short||text.startsWith(`${short} `)||text.startsWith(`${short}'`)||text.startsWith(`${short}’`)) return text;
  const generic=new RegExp(`^${esc(honorific)}\\b`,"i");
  return generic.test(text)?text.replace(generic,short):text;
}

function repairNames(state){
  let changed=false;
  const replacements=new Map();
  const repairList=(list)=>{
    for(const event of list||[]){
      if(!event?.personId)continue;
      const person=(state.people||[]).find(entry=>entry.id===event.personId);
      if(!person)continue;
      const before=event.text||event.note;
      const after=repairNamedText(before,person);
      if(after&&before!==after){
        if(event.text)event.text=after;
        if(event.note)event.note=after;
        replacements.set(before,after);
        changed=true;
      }
    }
  };
  repairList(state.worldEvents);
  repairList(state.realism?.latest);
  repairList(state.realism?.family?.recent);
  for(const person of state.people||[]){
    const before=person.npc?.currentThread;
    if(!before)continue;
    const after=replacements.get(before)||repairNamedText(before,person);
    if(after!==before){person.npc.currentThread=after;changed=true;}
  }
  if(state.realism?.birthday?.items?.length){
    state.realism.birthday.items=state.realism.birthday.items.map(text=>replacements.get(text)||text);
  }
  if(state.contextual?.activeThread?.text&&replacements.has(state.contextual.activeThread.text)){
    state.contextual.activeThread.text=replacements.get(state.contextual.activeThread.text);
    changed=true;
  }
  return changed;
}

function makeItem(state,template,source="Already yours",giver=null,acquiredAtMonths=state.character.ageMonths){
  return {id:`item-${template.key}-${acquiredAtMonths}-${Math.floor(seededNumber(state,template.key.length*901)*99999)}`,key:template.key,name:template.name,kind:template.kind,hobby:template.hobby||null,acquiredAtMonths,giverId:giver?.id||null,source,favorite:false,usedCount:0,lastUsedAtMonths:null,condition:"Good",givenAway:false,givenToId:null};
}
function starterTemplates(state){
  const age=state.character.ageMonths||0;
  if(age<12)return [ITEM_CATALOG.find(x=>x.key==="blanket")];
  if(age<30)return [ITEM_CATALOG.find(x=>x.key==="blanket"),ITEM_CATALOG.find(x=>x.key==="plush")];
  if(age<60)return [ITEM_CATALOG.find(x=>x.key==="plush"),ITEM_CATALOG.find(x=>x.key==="crayons"),ITEM_CATALOG.find(x=>x.key==="picture-book")];
  return [ITEM_CATALOG.find(x=>x.key==="storybook"),ITEM_CATALOG.find(x=>x.key==="crayons")];
}
function ensureStarterPossessions(state){
  if(state.possessions.items.length)return false;
  for(const template of starterTemplates(state).filter(Boolean)){
    state.possessions.items.push(makeItem(state,template,"Already part of your things",null,Math.max(0,Math.min(state.character.ageMonths,template.min||0))));
  }
  return state.possessions.items.length>0;
}
function eligibleGiftTemplates(state){
  const age=state.character.ageMonths||0;
  const owned=new Set(state.possessions.items.filter(x=>!x.givenAway).map(x=>x.key));
  const comfortable=state.household?.financeBand==="Comfortable";
  let list=ITEM_CATALOG.filter(x=>age>=x.min&&age<=x.max&&!owned.has(x.key)&&(!x.comfortableOnly||comfortable));
  if(!list.length)list=ITEM_CATALOG.filter(x=>age>=x.min&&age<=x.max&&(!x.comfortableOnly||comfortable));
  return list;
}
function visibleKnownPeople(state){
  const age=state.character.ageMonths||0;
  return (state.people||[]).filter(person=>!person.deceased&&(person.introducedAtMonths||0)<=age);
}
function giftGivers(state){
  const people=visibleKnownPeople(state);
  return people.filter(person=>person.family?.caregiver||person.family?.household||["grandmother","grandfather","aunt","uncle"].includes(person.role)||(person.role==="friend"&&state.character.ageMonths>=60));
}
function receiveGift(state,giver,template,reason){
  const item=makeItem(state,template,reason,giver);
  state.possessions.items.push(item);
  state.possessions.giftsReceived=(state.possessions.giftsReceived||0)+1;
  if(giver){
    giver.closeness=clamp((giver.closeness??50)+2);
    giver.history ||= [];
    giver.history.push({ageMonths:state.character.ageMonths,date:{...state.date},eventId:"gift",note:`${displayName(giver)} gave you ${item.name}.`});
    giver.history=giver.history.slice(-20);
  }
  addWorldUpdate(state,"Family",`${displayName(giver,"Someone close to you")} gave you ${item.name}${reason==="Birthday gift"?" for your birthday":""}. It is now one of your things.`,3,giver);
}
function processGifts(state,before){
  const now=state.character.ageMonths||0;
  const beforeAge=Math.floor(before/12),currentAge=Math.floor(now/12);
  const givers=giftGivers(state),templates=eligibleGiftTemplates(state);
  if(!givers.length||!templates.length)return false;
  if(currentAge>beforeAge&&currentAge>=1){
    receiveGift(state,givers[Math.floor(seededNumber(state,0x7711+currentAge)*givers.length)],templates[Math.floor(seededNumber(state,0x8822+currentAge)*templates.length)],"Birthday gift");
    return true;
  }
  return false;
}

function partnerAdults(state){ return (state.people||[]).filter(p=>["guardian","secondGuardian"].includes(p.role)&&!p.deceased).slice(0,2); }
function uniqueOutsideName(state){
  const existing=new Set((state.people||[]).map(p=>String(p.name||"").toLowerCase()));
  for(let i=0;i<20;i++){
    const name=`${OUTSIDE_FIRST[Math.floor(dramaRandom(state)*OUTSIDE_FIRST.length)]} ${OUTSIDE_LAST[Math.floor(dramaRandom(state)*OUTSIDE_LAST.length)]}`;
    if(!existing.has(name.toLowerCase()))return name;
  }
  return `Alex ${Math.floor(dramaRandom(state)*900+100)}`;
}
function makeOutsidePerson(state,actor){
  const name=uniqueOutsideName(state);
  return {id:`family-connection-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${state.character.ageMonths}`,role:"family_connection",relationshipLabel:`Connected to ${displayName(actor)}`,name,sex:dramaRandom(state)<.5?"Female":"Male",age:Math.max(20,(actor?.age||30)+Math.round((dramaRandom(state)-.5)*10)),introducedAtMonths:state.character.ageMonths+99999,closeness:5,trust:10,affection:10,conflict:20,familiarity:5,lastInteractionAtMonths:state.character.ageMonths,history:[],family:{branch:"outside",generation:"adult",kinship:"none",caregiver:false,household:false},npc:{outsideStress:35,availability:50,socialWorld:55,currentThread:"",lastChangedAtMonths:state.character.ageMonths}};
}
function startAffair(state,adults){
  const actor=adults[Math.floor(dramaRandom(state)*adults.length)],partner=adults.find(p=>p.id!==actor.id),outsider=makeOutsidePerson(state,actor);
  state.people.push(outsider);
  state.realism.family.partnership.affair={status:"secret",actorId:actor.id,partnerId:partner?.id||null,otherPersonId:outsider.id,startedAtMonths:state.character.ageMonths,months:0,discoveredAtMonths:null};
  state.relationshipDrama.history.push({type:"affair_started",ageMonths:state.character.ageMonths,actorId:actor.id,partnerId:partner?.id||null,otherPersonId:outsider.id});
}
function revealAffair(state,affair){
  const actor=(state.people||[]).find(p=>p.id===affair.actorId),partner=(state.people||[]).find(p=>p.id===affair.partnerId),outsider=(state.people||[]).find(p=>p.id===affair.otherPersonId);
  affair.status="discovered"; affair.discoveredAtMonths=state.character.ageMonths;
  if(outsider)outsider.introducedAtMonths=state.character.ageMonths;
  const partnership=state.realism.family.partnership;
  partnership.quality=clamp((partnership.quality??55)-28);
  state.realism.family.atmosphere=clamp((state.realism.family.atmosphere??60)-15);
  state.health.stress=clamp((state.health.stress??25)+8);
  const text=`${displayName(actor,"One of your caregivers")} has been involved with ${outsider?.name||"someone else"} outside their relationship with ${displayName(partner,"their partner")}. The adults are hurt and angry, and home suddenly feels much less steady.`;
  addWorldUpdate(state,"Family",text,5,actor,outsider);
  if(actor?.npc)actor.npc.currentThread=text;
  if(partner?.npc)partner.npc.currentThread=`The relationship with ${displayName(actor)} has been shaken by what happened.`;
  state.relationshipDrama.history.push({type:"affair_discovered",ageMonths:state.character.ageMonths,actorId:actor?.id||null,partnerId:partner?.id||null,otherPersonId:outsider?.id||null});
}
function resolveAffair(state,affair){
  const partnership=state.realism.family.partnership;
  const actor=(state.people||[]).find(p=>p.id===affair.actorId),partner=(state.people||[]).find(p=>p.id===affair.partnerId),outsider=(state.people||[]).find(p=>p.id===affair.otherPersonId);
  if(state.character.ageMonths-(affair.discoveredAtMonths||state.character.ageMonths)<3)return false;
  const separationChance=clamp((45-(partnership.quality??45))/60+.08,.08,.48);
  if(dramaRandom(state)<separationChance){
    partnership.status="separated"; partnership.separatedAtMonths=state.character.ageMonths; affair.status="ended_relationship";
    addWorldUpdate(state,"Family",`${displayName(actor)} and ${displayName(partner)} decide to separate after the affair. Everyday care and where people live now have to be worked out.`,5,actor,partner);
    return true;
  }
  if(dramaRandom(state)<.4){
    affair.status="ended";
    addWorldUpdate(state,"Family",`${displayName(actor)} says the relationship with ${outsider?.name||"the other person"} is over. ${displayName(partner)} has not forgotten what happened, but they are deciding whether trust can be rebuilt.`,4,actor,outsider);
    return true;
  }
  return false;
}
function processRelationshipDrama(state,elapsed){
  const partnership=state.realism?.family?.partnership,adults=partnerAdults(state);
  if(!partnership||adults.length<2||partnership.status!=="together")return false;
  const affair=partnership.affair;
  if(!affair){
    const quality=partnership.quality??60;
    const pressure=adults.reduce((sum,p)=>sum+Math.max(0,(p.npc?.outsideStress??35)-55),0);
    const monthly=.00025+Math.max(0,48-quality)*.000035+pressure*.000008;
    if(dramaRandom(state)<monthly*Math.max(1,elapsed)){startAffair(state,adults);return true;}
    return false;
  }
  affair.months=(affair.months||0)+elapsed;
  if(affair.status==="secret"&&affair.months>=3&&dramaRandom(state)<clamp(.08+affair.months*.025,.1,.55)){revealAffair(state,affair);return true;}
  if(affair.status==="discovered")return resolveAffair(state,affair);
  return false;
}

function processWorld(state){
  ensureState(state);
  let changed=repairNames(state);
  changed=ensureStarterPossessions(state)||changed;
  const current=state.character?.ageMonths||0;
  const before=Math.min(current,state.lifeEnhancer.lastProcessedAgeMonths??current);
  const elapsed=Math.max(0,current-before);
  if(elapsed>0){
    changed=processGifts(state,before)||changed;
    changed=processRelationshipDrama(state,elapsed)||changed;
    state.lifeEnhancer.lastProcessedAgeMonths=current;
  }
  return changed;
}

function ageLabel(months){ const years=Math.floor(months/12),rest=months%12; return years?`Age ${years}${rest?` + ${rest}m`:""}`:`${months} month${months===1?"":"s"}`; }
function icon(){ return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v13H5z"/><path d="M8 7V5h8v2M8 11h8M8 15h5"/></svg>`; }
function styles(){ return `<style>.things-intro{margin:0 0 16px;color:var(--muted);font-size:12px;line-height:1.5}.thing-card{border-top:1px solid var(--line);padding:14px 0}.thing-card:last-child{border-bottom:1px solid var(--line)}.thing-head{display:flex;justify-content:space-between;gap:12px}.thing-name{margin:0;font-family:var(--serif);font-size:19px;font-weight:500}.thing-kind{margin:3px 0 0;color:var(--muted);font-size:10px;text-transform:uppercase}.thing-copy{margin:8px 0 0;font-size:12px;line-height:1.45}.thing-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.thing-action{-webkit-appearance:none;appearance:none;border:1px solid var(--line-strong);border-radius:7px;background:transparent;color:var(--ink);padding:7px 10px;font:inherit;font-size:10px}.thing-action.primary{border-color:var(--sage);background:var(--sage-soft)}.thing-action:disabled{opacity:.45}.favorite-mark{color:var(--sage)}.give-person{-webkit-appearance:none;appearance:none;width:100%;display:flex;justify-content:space-between;border:0;border-top:1px solid var(--line);background:transparent;padding:12px 0;color:var(--ink);font:inherit;text-align:left}.things-back{-webkit-appearance:none;appearance:none;border:0;background:transparent;color:var(--sage);padding:0 0 12px;font:inherit;font-size:11px}</style>`; }
function itemOrigin(state,item){ const giver=item.giverId?(state.people||[]).find(p=>p.id===item.giverId):null; return giver?`${displayName(giver)} gave this to you at ${ageLabel(item.acquiredAtMonths)}.`:`${item.source||"It became one of your things"} at ${ageLabel(item.acquiredAtMonths)}.`; }
function inventoryContent(state){
  const items=(state.possessions?.items||[]).filter(x=>!x.givenAway).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.acquiredAtMonths-a.acquiredAtMonths),age=state.character.ageMonths||0;
  return `${styles()}<p class="brand">Little Days</p><h1 class="page-title">Things</h1><p class="things-intro">Objects can become part of a life too. Gifts remember who gave them to you, hobby tools can be used, and things you no longer want can be given to someone else.</p>${items.length?items.map(item=>`<article class="thing-card"><div class="thing-head"><div><h2 class="thing-name">${item.name}</h2><p class="thing-kind">${item.kind}${item.hobby?` · ${item.hobby}`:""}</p></div>${item.favorite?`<span class="favorite-mark">♡</span>`:""}</div><p class="thing-copy">${itemOrigin(state,item)}${item.usedCount?` You have used it ${item.usedCount} time${item.usedCount===1?"":"s"}.`:""}</p><div class="thing-actions">${item.hobby&&age>=30?`<button class="thing-action primary" data-practice-item="${item.id}" ${item.lastUsedAtMonths===age?"disabled":""}>${item.lastUsedAtMonths===age?"Practiced this turn":`Practice ${item.hobby}`}</button>`:""}<button class="thing-action" data-favorite-item="${item.id}">${item.favorite?"Unfavorite":"Favorite"}</button>${age>=36?`<button class="thing-action" data-give-route="${item.id}">Give to someone</button>`:""}</div></article>`).join(""):`<p class="things-intro">You do not have any recorded belongings yet.</p>`}`;
}
function giveContent(state,itemId){
  const item=(state.possessions?.items||[]).find(x=>x.id===itemId&&!x.givenAway);
  if(!item)return `${styles()}<button class="things-back" data-enhancer-route="inventory">‹ Things</button><h1 class="page-title">Give something</h1><p class="things-intro">That object is no longer in your things.</p>`;
  const people=visibleKnownPeople(state).filter(p=>p.role!=="teacher"&&p.role!=="family_connection");
  return `${styles()}<button class="things-back" data-enhancer-route="inventory">‹ Things</button><p class="brand">Little Days</p><h1 class="page-title">Give ${item.name}</h1><p class="things-intro">Giving it away removes it from your inventory, but the gesture stays in your shared history.</p>${people.map(p=>`<button class="give-person" data-give-item="${item.id}" data-recipient-id="${p.id}"><span>${p.name}</span><small>${p.relationshipLabel||p.role}</small></button>`).join("")}`;
}

function renderInventory(force=false){
  const route=location.hash.replace("#","");
  if(!route.startsWith("inventory"))return;
  const screen=document.querySelector(".screen"),state=readState();
  if(!screen||!state)return;
  if(!force&&screen.dataset.lifeEnhancerRoute===route)return;
  screen.dataset.lifeEnhancerRoute=route;
  const match=route.match(/^inventory\/give\/(.+)$/);
  screen.innerHTML=match?giveContent(state,decodeURIComponent(match[1])):inventoryContent(state);
  bindInventory(screen);
}
function bindInventory(screen){
  screen.querySelectorAll("[data-enhancer-route]").forEach(b=>b.addEventListener("click",()=>{location.hash=b.dataset.enhancerRoute;}));
  screen.querySelectorAll("[data-give-route]").forEach(b=>b.addEventListener("click",()=>{location.hash=`inventory/give/${encodeURIComponent(b.dataset.giveRoute)}`;}));
  screen.querySelectorAll("[data-favorite-item]").forEach(b=>b.addEventListener("click",()=>{const state=ensureState(readState()),item=state.possessions.items.find(x=>x.id===b.dataset.favoriteItem);if(!item)return;item.favorite=!item.favorite;saveState(state);renderInventory(true);}));
  screen.querySelectorAll("[data-practice-item]").forEach(b=>b.addEventListener("click",()=>{const state=ensureState(readState()),item=state.possessions.items.find(x=>x.id===b.dataset.practiceItem&&!x.givenAway);if(!item?.hobby||item.lastUsedAtMonths===state.character.ageMonths)return;item.usedCount=(item.usedCount||0)+1;item.lastUsedAtMonths=state.character.ageMonths;if(typeof state.interests?.[item.hobby]==="number")state.interests[item.hobby]=clamp(state.interests[item.hobby]+3);state.health.stress=clamp((state.health.stress??25)-1);state.possessions.practiceHistory.push({ageMonths:state.character.ageMonths,itemId:item.id,hobby:item.hobby,date:{...state.date}});saveState(state);location.reload();}));
  screen.querySelectorAll("[data-give-item]").forEach(b=>b.addEventListener("click",()=>{const state=ensureState(readState()),item=state.possessions.items.find(x=>x.id===b.dataset.giveItem&&!x.givenAway),person=(state.people||[]).find(x=>x.id===b.dataset.recipientId&&!x.deceased);if(!item||!person)return;item.givenAway=true;item.givenToId=person.id;item.givenAwayAtMonths=state.character.ageMonths;state.possessions.giftsGiven=(state.possessions.giftsGiven||0)+1;person.closeness=clamp((person.closeness??50)+4);person.trust=clamp((person.trust??50)+2);person.history ||= [];person.history.push({ageMonths:state.character.ageMonths,date:{...state.date},eventId:"gift_given",note:`You gave ${person.name} your ${item.name}.`});addWorldUpdate(state,person.role==="friend"?"Friends":"Family",`You gave ${person.name} your ${item.name}. The object leaves your things, but the gesture becomes part of your relationship.`,3,person);saveState(state);location.hash="inventory";location.reload();}));
}
function injectMoreLink(){
  if(location.hash.replace("#","")!=="more")return;
  const panel=document.querySelector(".more-panel");
  if(!panel||panel.querySelector("[data-enhancer-route='inventory']"))return;
  const button=document.createElement("button");button.className="more-link";button.dataset.enhancerRoute="inventory";button.innerHTML=`<span>${icon()}</span><span><strong>Things</strong>Inventory, gifts, favorite objects, and hobby practice.</span><span class="chevron">›</span>`;button.addEventListener("click",()=>{location.hash="inventory";});panel.appendChild(button);
}
function scheduleUi(){ setTimeout(()=>{renderInventory();injectMoreLink();},0); }

export function refreshLifeEnhancer(){
  const state=readState();
  if(!state)return;
  ensureState(state);
  const changed=processWorld(state);
  saveState(state);
  if(changed){
    const key=`${RELOAD_PREFIX}:${state.seed}:${state.character.ageMonths}`;
    if(!sessionStorage.getItem(key)){
      sessionStorage.setItem(key,"1");
      location.reload();
      return;
    }
  }
  scheduleUi();
}
