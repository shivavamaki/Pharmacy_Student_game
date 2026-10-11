export const recapOptions = {
      characters:[
        ["curious","📝","The Curious Apprentice","สายถามเยอะ อยากเข้าใจ"],
        ["observer","👓","The Quiet Observer","สายเงียบ แต่เก็บข้อมูลละเอียด"],
        ["counselor","💬","The Brave Counselor","สายกล้าคุยกับผู้ป่วย"],
        ["detective","🔎","The Order Detective","สายวิเคราะห์ order / chart"],
        ["survival","☕","The Survival Intern","สายเหนื่อยแต่สู้"],
        ["future","⭐","The Future Pharmacist","สายเริ่มมั่นใจขึ้น"]
      ],
      gameGenre:["Adventure","Survival","Puzzle","Simulator","Co-op","Horror นิด ๆ","Open world"],
      firstFeeling:[
        ["tutorial","📘","Tutorial Stage","ยังงง แต่มีคนสอน"],
        ["firstBoss","😵","First Boss","เริ่มเจองานจริงแล้วตกใจ"],
        ["openWorld","🗺️","Open World","งานเยอะ ไม่รู้เริ่มตรงไหน"],
        ["safeZone","🛟","Safe Zone","มีคนช่วย มีพื้นที่ให้ถาม"],
        ["hiddenQuest","✨","Hidden Quest","ได้เรียนรู้อะไรที่ไม่เคยคิดมาก่อน"]
      ],
      missions:["Dispensing / IPD workflow","Medication reconciliation","Patient counseling","Ward round / case discussion","Drug information","Communication with staff","Time management","Using hospital system"],
      preceptorRoles:[
        ["guide","🧭","Guide NPC","คอยบอกทาง"],
        ["healer","💚","Healer","ช่วยลดความเครียด"],
        ["tank","🛡️","Tank","คอยกันปัญหาให้"],
        ["mage","📚","Mage","ให้ความรู้เยอะมาก"],
        ["quest","📜","Quest Giver","ให้งานและ challenge"],
        ["boss","🔥","Final Boss บางวัน","กดดันแต่ได้เรียนรู้"]
      ],
      cityTypes:[
        ["big","🏙️","Complex Big City","ระบบซับซ้อน แต่มีอะไรให้เรียนเยอะ"],
        ["warm","🏡","Warm Safe Town","อบอุ่น มีคนช่วยเหลือ"],
        ["busy","🏃","Busy Expert City","วิ่งวุ่นมาก แต่ทุกคนเก่ง"],
        ["hidden","🧩","Hidden Knowledge City","มี hidden knowledge เยอะ"],
        ["hard","🚪","Hard to Enter","เข้ายากตอนแรก แต่พออยู่ไปเริ่มเข้าใจ"]
      ],
      welcome:["มีคนทัก/แนะนำตัว","มีคนอธิบาย workflow","มีพื้นที่ให้ถาม","ได้ลองทำงานจริง","staff ไม่ดุเกินไป","มี feedback ที่ดี","มี buddy หรือพี่ช่วยดู"],
      stress:["งานเยอะ/เร็ว","กลัวตอบผิด","ไม่รู้ว่าต้องทำอะไรต่อ","ไม่กล้าถาม","ระบบงานซับซ้อน","feedback ไม่ชัด","บรรยากาศกดดัน","กลัวรบกวน staff"],
      skills:["Patient Counseling","Order Review","Clinical Thinking","Team Communication","Time Management","Confidence","Drug Information","Workflow Understanding"],
      bosses:[
        ["mistake","👾","Fear of Mistake Monster","กลัวผิด กลัวตอบพลาด"],
        ["task","🐲","Too Many Tasks Dragon","งานเยอะและเร็ว"],
        ["silent","👻","Silent Room Ghost","บรรยากาศเงียบ ไม่กล้าถาม"],
        ["workflow","🗿","Complex Workflow Golem","workflow ซับซ้อน"],
        ["feedback","🫧","Feedback Confusion Slime","ไม่แน่ใจว่าเราทำดีไหม"],
        ["time","⏰","Time Pressure Boss","เวลาบีบและต้องรีบ"]
      ],
      emoji:[
        ["fun","😄","สนุกและได้เรียนรู้"],
        ["worth","🙂","เหนื่อยแต่คุ้ม"],
        ["survive","😵‍💫","หนักมาก แต่รอด"],
        ["proud","🥹","ภูมิใจในตัวเอง"],
        ["improve","🤔","ยังมีบางอย่างอยากให้ดีขึ้น"]
      ],
      patches:["Orientation ให้ชัดขึ้น","Checklist งานแต่ละวัน","ตารางกิจกรรม/เป้าหมายรายสัปดาห์","เพิ่ม feedback ระหว่างทาง","ลดงานซ้ำที่ไม่เกิดการเรียนรู้","เพิ่ม case discussion","เพิ่ม patient counseling practice","เพิ่ม buddy system","มีตัวอย่างงานที่คาดหวัง"]
    };
const defaults = {
      currentStage:0,
      profile:{anonymous:false,nickname:"",university:"",rotation:"",period:"",character:"",characterLabel:""},
      answers:{
        character:{why:""},
        tutorial:{gameTitle:"",gameGenre:"",firstFeeling:"",firstFeelingLabel:"",firstHelp:""},
        road:{hardestMission:[],growthMission:"",growthReason:""},
        preceptor:{role:"",roleLabel:"",negativeRoles:[],negativeFactors:[],negativeReflection:"",ratings:{teachingClarity:0,comfortToAsk:0,helpfulFeedback:0,workload:0,notLeftAlone:0},wantedSkill:"",bestWorstReason:""},
        department:{cityType:"",cityLabel:"",welcomeFactors:[],stressFactors:[],oneThingToFix:"",memorableMoment:""},
        skill:{unlockedSkills:[],proudestSkill:"",skillToImprove:""},
        boss:{hardestBoss:"",bossLabel:"",howSurvived:"",whatWouldHelp:""},
        treasure:{treasure:"",oneWord:"",finalEmoji:"",finalEmojiLabel:"",overallScore:0},
        patch:{patchRequests:[],messageToJunior:"",secretMessage:""}
      },
      results:{questScore:0,rank:"",endingTitle:"",endingText:""}
    };
export function calculateRecapResult(state){
      const a=state.answers;
      const ratings=Object.values(a.preceptor.ratings||{}).map(Number).filter(v=>v>0);
      const preAvg=ratings.length ? ratings.reduce((x,y)=>x+y,0)/ratings.length : 0;
      const overall=Math.max(0,Math.min(10,Number(a.treasure.overallScore)||0));
      const skillCount=Math.min(8,(a.skill.unlockedSkills||[]).length);
      const welcomeCount=Math.min(7,(a.department.welcomeFactors||[]).length);
      const reflections=[a.character.why,a.tutorial.firstHelp,a.road.growthReason,a.preceptor.bestWorstReason,a.department.memorableMoment,a.boss.howSurvived,a.treasure.treasure];
      const reflectionPoints=reflections.filter(x=>String(x||'').trim().length>2).length;
      const score=Math.round(overall*3 + (preAvg/5)*25 + skillCount*3 + welcomeCount*2 + reflectionPoints);
      const finalScore=Math.max(1,Math.min(100,score));
      let rank='Brave Completer';
      if(finalScore>=85) rank='Legendary Clerkship Hero';
      else if(finalScore>=70) rank='Heroic Pharmacist in Training';
      else if(finalScore>=55) rank='Rising Pharmacy Adventurer';

      const endings={
        curious:['The Endless Library Ending','คุณเปิดประตูห้องสมุดลับและพบว่า ทุกคำถามที่เคยถามได้กลายเป็นแผนที่นำทางให้รุ่นต่อไป คุณยังคงออกเดินทางด้วยความอยากรู้ และทุกคนยินดีตอบคำถามของคุณ'],
        observer:['The Quiet Guardian Ending','รายละเอียดเล็ก ๆ ที่คุณสังเกตเห็นได้ช่วยให้ Pharmacy City ปลอดภัยขึ้น คุณไม่ได้พูดดังที่สุด แต่สิ่งที่คุณมองเห็นมีคุณค่าเสมอ'],
        counselor:['The Voice of Hope Ending','คำพูดที่ชัดเจนและอ่อนโยนของคุณกลายเป็นพลังรักษา ผู้ป่วยออกจากเมืองพร้อมความเข้าใจ และคุณก้าวต่อไปในฐานะผู้สื่อสารแห่งความหวัง'],
        detective:['The Golden Prescription Ending','คุณไขปริศนา order ที่ซับซ้อนและพบ Golden Prescription ซึ่งไม่ได้มอบคำตอบทุกอย่าง แต่มอบทักษะให้คุณค้นหาคำตอบอย่างปลอดภัย'],
        survival:['The Unbreakable Campfire Ending','หลังผ่านวันที่เหนื่อยที่สุด คุณจุดกองไฟกลาง Pharmacy City ทุกคนมารวมตัว แบ่งปันเรื่องราว และยืนยันว่า การขอความช่วยเหลือคือหนึ่งใน skill ที่แข็งแกร่งที่สุด'],
        future:['The New White Coat Ending','ประตูโรงพยาบาลเปิดรับแสงเช้าวันใหม่ คุณเห็นตัวเองในเสื้อกาวน์ของอนาคต ไม่ใช่คนที่รู้ทุกอย่าง แต่เป็นเภสัชกรที่พร้อมเรียนรู้และดูแลผู้คน'],
      };
      const selected=endings[state.profile.character] || ['The Shared Journey Ending','คุณเดินทางจนจบด้วยเรื่องราวเฉพาะของตัวเอง ทุกคำตอบได้กลายเป็น treasure ที่ช่วยให้ clerkship รุ่นต่อไปอบอุ่นและดีขึ้น'];
      state.results={questScore:finalScore,rank:rank,endingTitle:selected[0],endingText:selected[1]};

      return state.results;
    }

export function emptyRecap(){return structuredClone(defaults);}
export function normalizeRecap(input){
 if(!input || typeof input!=='object' || Array.isArray(input))throw Error('invalid recap');
 const output=emptyRecap();
 const clean=(base,value)=>{
  if(Array.isArray(base)){if(!Array.isArray(value)||value.length>50||value.some(x=>typeof x!=='string'||x.length>300))throw Error('invalid array');return [...new Set(value)];}
  if(typeof base==='string'){if(typeof value!=='string'||value.length>4000)throw Error('invalid text');return value.trim();}
  if(typeof base==='number'){if(typeof value!=='number'||!Number.isFinite(value))throw Error('invalid number');return value;}
  if(typeof base==='boolean'){if(typeof value!=='boolean')throw Error('invalid bool');return value;}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid section');
  const out={};for(const [key,defaultValue]of Object.entries(base))out[key]=value[key]===undefined?structuredClone(defaultValue):clean(defaultValue,value[key]);return out;
 };
 output.answers=clean(defaults.answers,input.answers||{});
 output.profile.character=input.profile?.character||'';
 if(typeof output.profile.character!=='string'||(output.profile.character&&!recapOptions.characters.some(c=>c[0]===output.profile.character)))throw Error('invalid character');
 output.profile.characterLabel=recapOptions.characters.find(c=>c[0]===output.profile.character)?.[2]||'';
 output.profile.period=typeof input.profile?.period==='string'?input.profile.period.slice(0,200):'';
 for(const value of Object.values(output.answers.preceptor.ratings)){if(!Number.isInteger(value)||value<0||value>5)throw Error('invalid rating');}
 const score=output.answers.treasure.overallScore;if(score<0||score>10)throw Error('invalid score');
 const choice=(section,key,options,labelKey)=>{const value=output.answers[section][key];const found=options.find(x=>(Array.isArray(x)?x[0]:x)===value);if(value&&!found)throw Error('invalid option');if(labelKey)output.answers[section][labelKey]=found?.[2]||'';};
 choice('tutorial','gameGenre',recapOptions.gameGenre);choice('tutorial','firstFeeling',recapOptions.firstFeeling,'firstFeelingLabel');
 choice('road','growthMission',recapOptions.missions);choice('preceptor','role',recapOptions.preceptorRoles,'roleLabel');
 choice('department','cityType',recapOptions.cityTypes,'cityLabel');choice('skill','proudestSkill',recapOptions.skills);
 choice('boss','hardestBoss',recapOptions.bosses,'bossLabel');choice('treasure','finalEmoji',recapOptions.emoji,'finalEmojiLabel');
 for(const [section,key,options]of [['road','hardestMission',recapOptions.missions],['department','welcomeFactors',recapOptions.welcome],['department','stressFactors',recapOptions.stress],['skill','unlockedSkills',recapOptions.skills],['patch','patchRequests',recapOptions.patches]]){
  if(output.answers[section][key].some(v=>!options.includes(v)))throw Error('invalid selection');
 }
 output.currentStage=Number.isInteger(input.currentStage)?Math.min(10,Math.max(0,input.currentStage)):0;
 output.results=calculateRecapResult(output);return output;
}
