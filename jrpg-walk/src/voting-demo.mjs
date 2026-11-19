// Local *single-browser* illustration of how voting works. All six mock seats
// are operated by one visitor. No networking, accounts, grades, or official rewards.
export const DEMO_SEATS = Object.freeze(['p1','p2','p3','p4','p5','p6']);
const fail=code=>{throw new Error(code);};
const keyOf=(kind,choiceIndex)=>kind==='case-choice'?kind+':'+choiceIndex:kind;
export function createDemoBallot(seats=DEMO_SEATS,leaderId='p1',id=1){
 if(!Array.isArray(seats)||seats.length<1||seats.length>6||
  new Set(seats).size!==seats.length||!seats.includes(leaderId))fail('invalid_demo_seats');
 return {id,leaderId,seats:[...seats],votes:[]};
}
export function castDemoVote(ballot,actorId,kind,choiceIndex=null){
 if(!ballot.seats.includes(actorId))fail('invalid_demo_voter');
 if(ballot.votes.some(v=>v.actorId===actorId))fail('already_voted');
 if(typeof kind!=='string'||!['listen','verify','assess','plan','guard','case-choice'].includes(kind))fail('invalid_choice');
 if(kind==='case-choice'&&(!Number.isInteger(choiceIndex)||choiceIndex<0||choiceIndex>2))fail('invalid_choice');
 return {...ballot,votes:[...ballot.votes,{actorId,kind,choiceIndex:kind==='case-choice'?choiceIndex:null}]};
}
export function tallyDemoBallot(ballot){
 if(ballot.votes.length!==ballot.seats.length)fail('votes_pending');
 const counts={};
 for(const vote of ballot.votes){
  const k=keyOf(vote.kind,vote.choiceIndex);counts[k]=(counts[k]||0)+1;
 }
 const most=Math.max(...Object.values(counts));
 const tied=Object.keys(counts).filter(key=>counts[key]===most);
 const leader=ballot.votes.find(v=>v.actorId===ballot.leaderId);
 const leaderKey=leader&&keyOf(leader.kind,leader.choiceIndex);
 const winner=tied.length===1?tied[0]:(leaderKey&&tied.includes(leaderKey)?leaderKey:'guard');
 return {winner,counts,voteCount:ballot.votes.length,tieBreak:tied.length>1?(winner==='guard'?'safe-guard':'leader-vote'):null};
}
