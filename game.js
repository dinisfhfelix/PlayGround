const classes = {
  knight: { name:'Knight', title:'THE IRONBOUND', icon:'🛡️', hp:38, focus:3, attack:8, armor:2, skill:'Shield Bash', skillIcon:'⛨', skillText:'11 dmg · stun', description:'A steadfast guardian who turns steel into a promise.', stats:'♥ 38 HP　 ⚔ 8 ATK　 ◈ 2 ARM' },
  mage: { name:'Mage', title:'THE SPELLWEAVER', icon:'🧙', hp:27, focus:4, attack:7, armor:0, skill:'Arcane Bolt', skillIcon:'✧', skillText:'14 magic dmg', description:'A keeper of old magic with a dangerous spark.', stats:'♥ 27 HP　 ✧ 4 FOC　 ☄ 7 ATK' },
  ranger: { name:'Ranger', title:'THE WILDSOUL', icon:'🏹', hp:31, focus:3, attack:8, armor:1, skill:'Aimed Shot', skillIcon:'➶', skillText:'13 dmg · true aim', description:'A patient hunter who never wastes an arrow.', stats:'♥ 31 HP　 ⚔ 8 ATK　 ◈ 1 ARM' }
};
const encounters = [
  { name:'Goblin Scout', icon:'👹', hp:21, attack:6, xp:24, caption:'THE OLD ROAD · DUSK', line:'A goblin leaps from the brush.' },
  { name:'Feral Direwolf', icon:'🐺', hp:29, attack:7, xp:32, caption:'THE BLACKPINE WOOD', line:'Yellow eyes gleam between the pines.' },
  { name:'Hollow Knight', icon:'💀', hp:37, attack:8, xp:42, caption:'THE FORGOTTEN WATCHTOWER', line:'An oathbreaker rises from the dust.' },
  { name:'Ogre Brute', icon:'👹', hp:47, attack:9, xp:52, caption:'THE ASHEN PASS', line:'The mountain shakes beneath its feet.' },
  { name:'The Cinder Wyrm', icon:'🐉', hp:72, attack:11, xp:100, caption:'THE CRUCIBLE · END OF ALL ROADS', line:'The Cinder Wyrm opens one burning eye.', boss:true }
];
let state = { classKey:null, hero:null, wave:0, xp:0, potions:2, guard:false, stunned:false, intent:null, over:false, sound:false, busy:false, log:[] };
const $ = id => document.getElementById(id);
const grid = $('class-grid');
let audioContext;
function playSound(kind='hit'){
  if(!state.sound)return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    audioContext ||= new Audio();
    if(audioContext.state==='suspended')audioContext.resume();
    const now=audioContext.currentTime;
    const notes={attack:[180,120],skill:[330,495,660],guard:[240,190],potion:[440,590,740],hit:[130,90],victory:[440,550,660],defeat:[180,130,90]};
    (notes[kind]||notes.hit).forEach((frequency,index)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
      oscillator.type=kind==='skill'||kind==='potion'||kind==='victory'?'sine':'triangle';
      oscillator.frequency.setValueAtTime(frequency,now+index*.075);
      gain.gain.setValueAtTime(.0001,now+index*.075);
      gain.gain.exponentialRampToValueAtTime(.055,now+index*.075+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,now+index*.075+.13);
      oscillator.connect(gain);gain.connect(audioContext.destination);
      oscillator.start(now+index*.075);oscillator.stop(now+index*.075+.14);
    });
  }catch(error){/* Audio is an optional enhancement; gameplay never depends on it. */}
}
Object.entries(classes).forEach(([key,c]) => {
  const card=document.createElement('button'); card.className='class-card'; card.type='button'; card.dataset.class=key;
  card.innerHTML=`<div class="class-art">${c.icon}</div><div class="class-name">${c.name}</div><div class="class-subtitle">${c.title}</div><div class="class-desc">${c.description}</div><div class="class-stats">${c.stats}</div>`;
  card.addEventListener('click',()=>selectClass(key)); grid.appendChild(card);
});
function selectClass(key){state.classKey=key;document.querySelectorAll('.class-card').forEach(c=>c.classList.toggle('selected',c.dataset.class===key));$('begin-button').disabled=false;$('begin-button').innerHTML=`Begin as ${classes[key].name} <span>→</span>`;}
$('begin-button').addEventListener('click',startGame);
function startGame(){
  const c=classes[state.classKey]; if(!c)return;
  state.hero={...c,hp:c.hp,maxHp:c.hp,focus:c.focus,maxFocus:c.focus,level:1};state.wave=0;state.xp=0;state.potions=2;state.guard=false;state.over=false;state.busy=false;state.log=[];
  $('class-screen').hidden=true;$('game-screen').hidden=false;$('run-stats').hidden=false;
  $('hero-name').textContent=c.name;$('hero-class').textContent=c.title;$('hero-figure').textContent=c.icon;$('hero-scene-name').textContent=c.name.toUpperCase();
  makeActions();startEncounter(0);
}
function startEncounter(index){
  state.wave=index;state.guard=false;state.stunned=false;state.busy=false;
  const base=encounters[index];const scale=1+(state.hero.level-1)*.12;
  state.enemy={...base,maxHp:Math.round(base.hp*scale),hp:Math.round(base.hp*scale),attack:Math.round(base.attack*scale)};
  $('screen-title').innerHTML=base.boss?'The last flame is <i>waiting.</i>':'The road grows <i>dark.</i>';$('eyebrow').textContent=base.boss?'THE FINAL OATH':'YOUR LEGEND, IN MOTION';
  $('encounter-label').textContent=base.boss?'FINAL ENCOUNTER':'ENCOUNTER 0'+(index+1);
  $('difficulty-label').textContent=base.boss?'THE LAST FLAME':'Threat rises';
  $('enemy-count').textContent='0'+(index+1)+' / 05';$('scene-caption').textContent=base.caption;
  $('enemy-name').textContent=base.name;$('enemy-scene-name').textContent=base.name.toUpperCase();$('enemy-figure').textContent=base.icon;
  $('scene').classList.toggle('boss-scene',!!base.boss);$('enemy-combatant').style.filter=base.boss?'drop-shadow(0 0 15px #e2673c)':'';
  chooseIntent();updateUI();setActionsDisabled(false);addLog(`<span class="log-highlight">${base.line}</span>`);
}
function makeActions(){const c=state.hero;const items=[['attack','⚔','Attack','A steady strike',''],['skill',c.skillIcon,c.skill,c.skillText,`${c.maxFocus} focus`],['guard','⛨','Brace','Reduce next hit by half',''],['potion','✚','Potion','Restore 14 HP','']];
  $('action-grid').innerHTML=items.map(([id,icon,name,detail,cost])=>`<button class="action-button" data-action="${id}"><span class="action-icon">${icon}</span><span><b class="action-name">${name}</b><small class="action-detail">${detail}</small></span>${cost?`<small class="action-cost">${cost}</small>`:''}</button>`).join('');
  document.querySelectorAll('.action-button').forEach(b=>b.addEventListener('click',()=>act(b.dataset.action)));
}
function chooseIntent(){
  if(!state.enemy)return;
  const e=state.enemy;let roll=Math.random();
  if(e.boss&&roll<.4)state.intent={type:'heavy',title:'Gathering cinder',copy:'A devastating flame is coming.',symbol:'☄'};
  else if(roll<.29)state.intent={type:'guard',title:'Shifting stance',copy:'The enemy is bracing for a blow.',symbol:'⛨'};
  else if(roll<.58)state.intent={type:'heavy',title:e.boss?'Dragonfire breath':'Heavy strike',copy:'A powerful attack is winding up.',symbol:e.boss?'☄':'⚔'};
  else state.intent={type:'attack',title:'Preparing to strike',copy:'A quick attack is coming your way.',symbol:'⚔'};
  $('intent-title').textContent=state.intent.title;$('intent-copy').textContent=state.intent.copy;$('intent-symbol').textContent=state.intent.symbol;
}
function act(action){if(state.over||state.busy)return;const h=state.hero,e=state.enemy;
  if(action==='potion'&&state.potions<=0){toast('No potions remain.');return;}
  if(action==='potion'&&h.hp===h.maxHp){toast('You are already at full health.');return;}
  if(action==='skill'&&h.focus<state.hero.maxFocus){toast('Your focus is not ready yet.');return;}
  state.busy=true;setActionsDisabled(true);playSound(action==='skill'?'skill':action==='guard'?'guard':action==='potion'?'potion':'attack');
  if(action==='attack'){
    const damage=rand(5,8)+h.attack;damageEnemy(damage,`${h.name} strikes for ${damage} damage.`);
  } else if(action==='skill'){
    h.focus=0;const dmg=state.classKey==='knight'?11+h.attack:state.classKey==='mage'?14+h.attack:13+h.attack;
    damageEnemy(dmg,`${h.skill} hits for ${dmg} damage!`);
    if(state.classKey==='knight'&&state.enemy.hp>0){state.stunned=true;addLog('The foe is staggered and will lose its next turn.');}
    if(state.classKey==='ranger'&&state.enemy.hp>0){h.focus=1;addLog('A true shot restores a little focus.');}
  } else if(action==='guard'){
    state.guard=true;h.focus=Math.min(h.maxFocus,h.focus+1);addLog(`${h.name} braces. The next blow will be softened.`);showToast('Guard raised · focus +1');
  } else if(action==='potion'){
    const heal=Math.min(14,h.maxHp-h.hp);h.hp+=heal;state.potions--;addLog(`A healing draught restores ${heal} HP.`);showToast(`Restored ${heal} HP`);
  }
  updateUI();
  if(e.hp<=0){setTimeout(()=>winEncounter(),400);return;}
  setTimeout(enemyTurn,430);
}
function damageEnemy(dmg,message){let actual=dmg;if(state.enemy.guard){actual=Math.max(1,dmg-4);state.enemy.guard=false;message+=` Their guard absorbs ${dmg-actual} damage.`;}if(state.enemy.hp>0){state.enemy.hp=Math.max(0,state.enemy.hp-actual);playSound('hit');flash('enemy-combatant');floatText(`−${actual}`);addLog(message);}}
function enemyTurn(){if(state.over)return;const e=state.enemy,h=state.hero;
  if(state.stunned){state.stunned=false;addLog(`${e.name} reels, unable to act.`);state.busy=false;chooseIntent();updateUI();setActionsDisabled(false);return;}
  if(state.intent.type==='guard'){
    e.guard=true;addLog(`${e.name} shifts into a guarded stance.`);showToast('Enemy is guarding');
  }else{
    let dmg=state.intent.type==='heavy'?Math.ceil(e.attack*1.65):e.attack;
    if(e.boss&&state.intent.type==='heavy')dmg+=3;
    if(state.guard){dmg=Math.max(1,Math.ceil(dmg*.48)-h.armor);state.guard=false;addLog(`Your brace absorbs much of the blow. ${e.name} deals ${dmg} damage.`);}
    else{dmg=Math.max(1,dmg-h.armor);addLog(`${e.name} hits you for ${dmg} damage.`);}
    h.hp=Math.max(0,h.hp-dmg);playSound('hit');flash('hero-combatant');floatText(`−${dmg}`);if(h.hp<=0){updateUI();setTimeout(loseGame,500);return;}
  }
  h.focus=Math.min(h.maxFocus,h.focus+1);state.busy=false;chooseIntent();updateUI();setActionsDisabled(false);
}
function winEncounter(){const defeated=state.enemy;state.busy=false;playSound('victory');state.xp+=defeated.xp;state.hero.focus=Math.min(state.hero.maxFocus,state.hero.focus+1);updateUI();
  if(defeated.boss){state.over=true;showResult(true);return;}
  const heal=Math.min(6,state.hero.maxHp-state.hero.hp);state.hero.hp+=heal;
  $('result-eyebrow').textContent='A MOMENT OF RESPITE';$('result-title').textContent='The path is clear.';$('result-copy').textContent=`${defeated.name} falls. You take a breath before the next danger finds you.`;$('reward-line').textContent=`✦  +${defeated.xp} XP     ·     +${heal} HP     ·     +1 focus`;$('result-button').textContent='Continue onward →';$('modal-backdrop').hidden=false;state.pendingNext=state.wave+1;
}
function showResult(won){$('result-eyebrow').textContent=won?'THE WYRM IS SLAIN':'YOUR TALE ENDS HERE';$('result-title').textContent=won?'A legend is born.':'The dark claims another.';$('result-copy').textContent=won?'The Cinder Wyrm falls, and dawn returns to the wilderness. Your name will be carried by every road.':`You reached encounter ${String(state.wave+1).padStart(2,'0')} and earned ${state.xp} experience. The wilderness remembers.`;$('reward-line').textContent=won?`✦  FINAL VICTORY     ·     ${state.xp} XP EARNED`:`✦  LEVEL ${state.hero.level}     ·     ${state.xp} XP EARNED`;$('result-button').textContent=won?'Play again →':'Rise again →';$('modal-backdrop').hidden=false;}
$('result-button').addEventListener('click',()=>{ $('modal-backdrop').hidden=true;if(state.over){$('game-screen').hidden=true;$('run-stats').hidden=true;$('class-screen').hidden=false;$('screen-title').innerHTML='Your legend begins <i>here.</i>'; $('eyebrow').textContent='A TALE OF STEEL & SORCERY';return;} if(state.xp>=state.hero.level*50){state.xp-=state.hero.level*50;state.hero.level++;state.hero.maxHp+=5;state.hero.hp=Math.min(state.hero.maxHp,state.hero.hp+8);state.hero.maxFocus++;state.hero.focus=state.hero.maxFocus;state.hero.attack+=1;makeActions();toast(`Level up! You are now level ${state.hero.level}.`);}updateUI();startEncounter(state.pendingNext);});
function loseGame(){state.over=true;playSound('defeat');showResult(false);}
function updateUI(){if(!state.hero)return;const h=state.hero,e=state.enemy;
  $('hero-hp-text').textContent=`${h.hp} / ${h.maxHp}`;$('enemy-hp-text').textContent=`${Math.max(0,e.hp)} / ${e.maxHp}`;
  $('hero-health').style.width=`${h.hp/h.maxHp*100}%`;$('enemy-health').style.width=`${Math.max(0,e.hp)/e.maxHp*100}%`;
  $('level-label').textContent=`LVL ${h.level}`;$('xp-label').textContent=`${state.xp} XP`;$('focus-label').textContent=`${h.focus} FOCUS`;$('potion-label').textContent=state.potions;
  $('header-wave').textContent=e.boss?'THE CINDER WYRM':`ENCOUNTER ${String(state.wave+1).padStart(2,'0')}`;
  $('hero-health').style.background=h.hp/h.maxHp<.3?'#bb6a5a':'';
  const skill=document.querySelector('[data-action="skill"]');if(skill)skill.disabled=h.focus<h.maxFocus||state.busy;
  const potion=document.querySelector('[data-action="potion"]');if(potion)potion.disabled=state.potions===0||h.hp===h.maxHp||state.busy;
  $('action-hint').textContent=state.busy?'The enemy is answering your move…':h.focus>=h.maxFocus?`${h.skill} is ready. Make it count.`:`Focus ${h.focus}/${h.maxFocus} · brace or strike to recover.`;
}
function setActionsDisabled(disabled){document.querySelectorAll('.action-button').forEach(b=>{if(b.dataset.action==='skill')b.disabled=disabled||state.hero.focus<state.hero.maxFocus;else if(b.dataset.action==='potion')b.disabled=disabled||state.potions===0||state.hero.hp===state.hero.maxHp;else b.disabled=disabled;});}
function addLog(html){state.log.unshift(html);state.log=state.log.slice(0,3);$('battle-log').innerHTML=state.log.map(line=>`<div class="log-entry">${line}</div>`).join('');}
function rand(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function flash(target){const node=$(target);node.classList.remove('hit');void node.offsetWidth;node.classList.add('hit');$('hit-flash').classList.remove('flash');void $('hit-flash').offsetWidth;$('hit-flash').classList.add('flash');}
function floatText(text){const node=$('scene-toast');node.textContent=text;node.classList.remove('show');void node.offsetWidth;node.classList.add('show');}
let toastTimer;function toast(message){const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),1900);}function showToast(message){toast(message);}
$('retreat-button').addEventListener('click',()=>{if(confirm('Abandon this run and choose a new hero?')){state.over=true;$('game-screen').hidden=true;$('run-stats').hidden=true;$('class-screen').hidden=false;$('screen-title').innerHTML='Your legend begins <i>here.</i>';$('eyebrow').textContent='A TALE OF STEEL & SORCERY';}});
$('sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;$('sound-toggle').setAttribute('aria-pressed',String(state.sound));$('sound-toggle').innerHTML=state.sound?'♫ <span>Sound on</span>':'♫ <span>Sound off</span>';if(state.sound)playSound('potion');toast(state.sound?'Sound effects enabled':'Sound effects muted');});
