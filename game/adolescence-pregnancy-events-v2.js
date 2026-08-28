import * as core from "./adolescence-pregnancy-events.js?v=1";

export * from "./adolescence-pregnancy-events.js?v=1";

function pregnancyPartnerName(state,event){const id=event?.adolescencePersonId||state.adolescence?.reproductive?.pregnancy?.partnerId;const person=(state.people||[]).find(p=>p.id===id);return String(person?.name||"your partner").split(/\s+/)[0]||"your partner";}
function repairEffect(effect){if(effect?.type==="development"&&effect.key==="responsibility")return{...effect,type:"adolescence",key:"responsibility"};return effect;}
export function adolescenceEventForState(state){const event=core.adolescenceEventForState(state);if(!event)return event;if(["relationship_boundaries","pregnancy_discovery","pregnancy_family","pregnancy_plan","teen_birth"].includes(event.adolescenceType)){const name=pregnancyPartnerName(state,event);event.choices=(event.choices||[]).map(choice=>({...choice,result:String(choice.result||"").replaceAll("${name}",name),effects:(choice.effects||[]).map(repairEffect)}));}return event;}
export function commitAdolescenceEvent(state,event,choice){return core.commitAdolescenceEvent(state,event,choice);}
