(function(){
  "use strict";
  var KEY="little-days-save-v2";

  function read(){
    try{return JSON.parse(localStorage.getItem(KEY));}
    catch(e){return null;}
  }
  function fraction(seed,text,salt){
    var h=((Number(seed)||1)^(salt||0))>>>0;
    text=String(text||"");
    for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;
    h=(Math.imul(h,1664525)+1013904223)>>>0;
    return h/4294967296;
  }
  function isExtended(person){
    if(!person||person.family?.caregiver||person.family?.household)return false;
    return person.family?.generation==="grandparent"||person.role==="grandmother"||person.role==="grandfather"||person.role==="aunt"||person.role==="uncle"||person.role==="cousin";
  }
  function introMonth(seed,person){
    var x=fraction(seed,person.id,0x4411);
    if(x<.38)return 0;
    if(x<.64)return 18;
    if(x<.84)return 54;
    if(x<.94)return 102;
    return 99999;
  }
  function summary(life){
    var known=(life.people||[]).filter(function(person){return isExtended(person)&&!person.deceased&&person.introducedAtMonths===0;});
    var names=known.slice(0,3).map(function(person){return person.name;});
    if(!names.length)return "You do not know much about your extended family yet.";
    if(names.length===1)return names[0]+" is already part of your wider family life.";
    return "A few relatives are already part of your wider family life: "+names.join(", ")+(known.length>3?", and others":"")+".";
  }

  var life=read();
  if(!life||life.version!==2||!life.character||life.character.ageMonths>=12)return;
  if((life.family?.graph?.version||0)>=2)return;

  (life.people||[]).forEach(function(person){
    if(!isExtended(person))return;
    person.introducedAtMonths=introMonth(life.seed,person);
    person.lastInteractionAtMonths=person.introducedAtMonths;
    var age=Number(person.age)||0;
    var deathChance=Math.min(.3,.04+Math.max(0,age-55)*.008);
    if((person.family?.generation==="grandparent"||person.role==="grandmother"||person.role==="grandfather")&&fraction(life.seed,person.id,0x9922)<deathChance){
      person.deceased=true;
      person.diedAtAge=Math.max(18,age-Math.max(1,Math.round(fraction(life.seed,person.id,0x7755)*12)));
      person.introducedAtMonths=99999;
      person.lastInteractionAtMonths=99999;
      if(person.family)person.family.predeceased=true;
    }
  });

  life.family ||= {};
  life.family.graph ||= {};
  life.family.graph.version=2;
  life.family.extendedSummary=summary(life);
  localStorage.setItem(KEY,JSON.stringify(life));
})();
