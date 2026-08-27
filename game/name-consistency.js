(function(){
  "use strict";

  var KEY="little-days-save-v2";
  var FEMALE_FIRST=["Mara","Sofia","Lia","Iris","Mina","Mika","Nina","Tala","Maya","Inez","Ana","Elena","Maria","Grace","Isabel","Teresa","Liza","Joy","Rina","Carmen","Zoe","Aya"];
  var MALE_FIRST=["Elio","Nico","Tomas","Paolo","Theo","Leo","Gab","Enzo","Luis","Joaquin","Daniel","Marco","Ramon","Miguel","Andres","Carlo","Ben","Joel","Liam","Noah"];
  var FEMALE_SET=new Set(FEMALE_FIRST.map(function(name){return name.toLowerCase()}));
  var MALE_SET=new Set(MALE_FIRST.map(function(name){return name.toLowerCase()}));
  var originalSetItem=Storage.prototype.setItem;

  function hash(seed,text){
    var value=(Number(seed)||1)>>>0;
    text=String(text||"");
    for(var i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619)>>>0;
    return value>>>0;
  }

  function parts(name){
    var bits=String(name||"").trim().split(/\s+/).filter(Boolean);
    return {first:bits[0]||"",rest:bits.slice(1).join(" ")};
  }

  function isMismatch(first,sex){
    first=String(first||"").toLowerCase();
    if(sex==="Male")return FEMALE_SET.has(first)&&!MALE_SET.has(first);
    if(sex==="Female")return MALE_SET.has(first)&&!FEMALE_SET.has(first);
    return false;
  }

  function replacement(seed,key,sex,used){
    var pool=sex==="Female"?FEMALE_FIRST:MALE_FIRST;
    var start=hash(seed,key)%pool.length;
    for(var i=0;i<pool.length;i++){
      var candidate=pool[(start+i)%pool.length];
      if(!used.has(candidate.toLowerCase()))return candidate;
    }
    return pool[start];
  }

  function replaceText(life,oldName,newName){
    if(!oldName||!newName||oldName===newName)return;
    function swap(value){return typeof value==="string"?value.split(oldName).join(newName):value}
    if(life.family){
      life.family.siblingSummary=swap(life.family.siblingSummary);
      life.family.extendedSummary=swap(life.family.extendedSummary);
      life.family.originStory=swap(life.family.originStory);
    }
    (life.history||[]).forEach(function(item){
      item.title=swap(item.title);item.choice=swap(item.choice);item.result=swap(item.result);item.note=swap(item.note);item.text=swap(item.text);
    });
    (life.memories||[]).forEach(function(item){item.title=swap(item.title);item.copy=swap(item.copy)});
    (life.worldEvents||[]).forEach(function(item){item.text=swap(item.text);item.note=swap(item.note);item.personName=swap(item.personName)});
    if(life.realism&&Array.isArray(life.realism.latest))life.realism.latest.forEach(function(item){item.text=swap(item.text);item.note=swap(item.note)});
  }

  function normalizePersonName(life,person,used){
    if(!person||!["sibling","cousin"].includes(person.role))return false;
    var sex=person.sex;
    if(!sex&&/brother/i.test(person.relationshipLabel||""))sex="Male";
    if(!sex&&/sister/i.test(person.relationshipLabel||""))sex="Female";
    if(!isMismatch(parts(person.name).first,sex))return false;

    var oldName=person.name;
    var split=parts(oldName);
    var first=replacement(life.seed,person.id||oldName,sex,used);
    person.name=first+(split.rest?" "+split.rest:"");
    used.add(first.toLowerCase());
    replaceText(life,oldName,person.name);
    return true;
  }

  function normalizeLife(life){
    if(!life||life.version!==2||!life.character)return life;
    var used=new Set((life.people||[]).map(function(person){return parts(person.name).first.toLowerCase()}).filter(Boolean));

    if(life.startMode==="random"&&isMismatch(life.character.firstName,life.character.sex)){
      var oldCharacterName=life.character.firstName;
      used.delete(String(oldCharacterName).toLowerCase());
      life.character.firstName=replacement(life.seed,"player",life.character.sex,used);
      replaceText(life,oldCharacterName,life.character.firstName);
    }

    (life.people||[]).forEach(function(person){normalizePersonName(life,person,used)});
    life.nameConsistencyVersion=1;
    return life;
  }

  Storage.prototype.setItem=function(key,value){
    if(this===localStorage&&key===KEY){
      try{
        var life=JSON.parse(value);
        value=JSON.stringify(normalizeLife(life));
      }catch(e){}
    }
    return originalSetItem.call(this,key,value);
  };

  try{
    var existing=JSON.parse(localStorage.getItem(KEY));
    if(existing&&existing.version===2&&existing.character&&existing.character.ageMonths<12){
      originalSetItem.call(localStorage,KEY,JSON.stringify(normalizeLife(existing)));
    }
  }catch(e){}
})();
