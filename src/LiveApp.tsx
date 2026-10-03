// Live family experience
import {useCallback,useEffect,useState} from 'react';
import {CalendarDays,CheckCircle2,HelpCircle,LogOut,Plus,Trash2,Users,XCircle} from 'lucide-react';
import type {Member,Task,TaskResult,TaskState} from './types';
import {
  client,currentSession,createFamily,createInvite,fetchFamilyData,getMembership,insertTask,
  joinFamily,logIn,logInChild,logOut,recordResult,removeTask,signUp
} from './lib/backend';
import {DAYS,addDays,dateFromLocal,dayDescription,dayStats,dailyTasks,localDate,mondayOf,resultFor,timeLabel,weekDays} from './lib/schedule';

type Page='today'|'week'|'progress'|'family';
type AuthMode='login'|'signup'|'child';
const stateLabel:Record<TaskState,string>={done:'Done',help:'Need help',not_done:'Not done'};

export default function LiveApp(){
  const [userId,setUserId]=useState<string|null>(null);
  const [membership,setMembership]=useState<Member|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [results,setResults]=useState<TaskResult[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [mode,setMode]=useState<AuthMode>('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [familyName,setFamilyName]=useState('Abbasi Family');
  const [inviteCode,setInviteCode]=useState('');
  const [page,setPage]=useState<Page>('today');
  const [week,setWeek]=useState(()=>mondayOf(new Date()));
  const [newTitle,setNewTitle]=useState('');
  const [newTime,setNewTime]=useState('17:00');
  const [daysMask,setDaysMask]=useState(31);
  const [parentInvite,setParentInvite]=useState('');
  const [childInvite,setChildInvite]=useState('');
  const [selectedChild,setSelectedChild]=useState('');

  const loadForUser=useCallback(async(id:string)=>{
    const member=await getMembership(id);
    setMembership(member);
    if(!member){setTasks([]);setResults([]);setMembers([]);return;}
    const earliest=localDate(new Date(Date.now()-70*86400000));
    const data=await fetchFamilyData(member.family_id,earliest);
    setTasks(data.tasks);
    setResults(data.results);
    setMembers(data.members);
    const firstChild=data.members.find(m=>m.role==='child')?.user_id??'';
    setSelectedChild(current=>current&&data.members.some(m=>m.user_id===current)?current:firstChild);
  },[]);

  const boot=useCallback(async()=>{
    try{
      const session=await currentSession();
      const id=session?.user.id??null;
      setUserId(id);
      if(id) await loadForUser(id);
      else setMembership(null);
    }catch(e){setError(e instanceof Error?e.message:'Could not load account.');}
    finally{setLoading(false);}
  },[loadForUser]);

  useEffect(()=>{
    void boot();
    const {data}=client!.auth.onAuthStateChange((_event,session)=>{
      const id=session?.user.id??null;
      setUserId(id);
      if(id) void loadForUser(id);
      else {setMembership(null);setTasks([]);setResults([]);setMembers([]);}
    });
    return ()=>data.subscription.unsubscribe();
  },[boot,loadForUser]);

  const run=async(action:()=>Promise<void>)=>{
    setBusy(true);setError('');setMessage('');
    try{await action();}
    catch(e){setError(e instanceof Error?e.message:'Something went wrong.');}
    finally{setBusy(false);}
  };

  const authSubmit=()=>void run(async()=>{
    if(mode==='login'){
      await logIn(email,password);
      const session=await currentSession();
      if(session){setUserId(session.user.id);await loadForUser(session.user.id);}
      return;
    }
    if(mode==='signup'){
      const hasSession=await signUp(email,password);
      if(hasSession){
        const session=await currentSession();
        if(session){setUserId(session.user.id);await loadForUser(session.user.id);}
      }else{
        setMessage('Account created. Check your email to confirm it, then return here and sign in.');
        setMode('login');
      }
      return;
    }
    if(!displayName.trim()||!inviteCode.trim()) throw new Error('Enter Aria’s name and child invite code.');
    await logInChild();
    const session=await currentSession();
    if(!session) throw new Error('Could not start child session.');
    await joinFamily(inviteCode,displayName);
    setUserId(session.user.id);
    await loadForUser(session.user.id);
  });

  const createNewFamily=()=>void run(async()=>{
    if(!displayName.trim()||!familyName.trim()) throw new Error('Enter your name and family name.');
    await createFamily(familyName,displayName);
    if(userId) await loadForUser(userId);
  });

  const joinAsParent=()=>void run(async()=>{
    if(!displayName.trim()||!inviteCode.trim()) throw new Error('Enter your name and parent invite code.');
    await joinFamily(inviteCode,displayName);
    if(userId) await loadForUser(userId);
  });

  const refresh=async()=>{
    if(userId) await loadForUser(userId);
  };

  const answer=(task:Task,state:TaskState)=>void run(async()=>{
    if(!userId||membership?.role!=='child') return;
    let note='';
    if(state!=='done') note=window.prompt(state==='help'?'What do you need help with?':'What got in the way?','')??'';
    await recordResult(task.id,userId,localDate(new Date()),state,note);
    await refresh();
  });

  const addTask=()=>void run(async()=>{
    if(!membership||membership.role!=='parent') return;
    const title=newTitle.trim();
    if(!title) throw new Error('Enter a task name.');
    if(daysMask===0) throw new Error('Choose at least one day.');
    await insertTask(membership.family_id,{title,time_local:newTime,days_mask:daysMask,active:true});
    setNewTitle('');
    await refresh();

    const todayIndex=(new Date().getDay()+6)%7;
    const hasOccurrenceLeftThisWeek=DAYS.some((_,index)=>index>=todayIndex && (daysMask&(1<<index))!==0);
    if(!hasOccurrenceLeftThisWeek) setWeek(mondayOf(addDays(new Date(),7)));

    setMessage(`Added “${title}” · ${dayDescription(daysMask)} at ${timeLabel(newTime)}`);
  });

  const deleteTask=(task:Task)=>void run(async()=>{
    if(!window.confirm(`Delete “${task.title}”?`)) return;
    await removeTask(task.id);
    await refresh();
  });

  const makeInvite=(role:'parent'|'child')=>void run(async()=>{
    if(!membership) return;
    const code=await createInvite(membership.family_id,role);
    if(role==='parent')setParentInvite(code);else setChildInvite(code);
  });

  const signOut=()=>void run(async()=>{await logOut();setUserId(null);setMembership(null);setPage('today');});

  const children=members.filter(m=>m.role==='child');
  const progressChild=selectedChild||children[0]?.user_id||'';
  const today=dailyTasks(tasks,new Date());
  const days=weekDays(week);
  const weekly=days.map(d=>({date:d,stats:progressChild?dayStats(tasks,results,d,progressChild):{done:0,help:0,not_done:0,unanswered:0,total:0}}));
  const totals=weekly.reduce((a,x)=>({done:a.done+x.stats.done,help:a.help+x.stats.help,not_done:a.not_done+x.stats.not_done,total:a.total+x.stats.total}),{done:0,help:0,not_done:0,total:0});
  const completion=totals.total?Math.round(totals.done/totals.total*100):0;
  const profileName=membership?.display_name??'Family';
  const isParent=membership?.role==='parent';

  if(loading) return <div className="center-screen"><div className="brand dark">daylight<span>.</span></div><p>Loading family…</p></div>;

  if(!userId) return <div className="auth-shell">
    <div className="auth-card">
      <div className="brand dark">daylight<span>.</span></div>
      <p className="eyebrow">FAMILY TASKS</p>
      <h2>{mode==='child'?'Join your family':mode==='signup'?'Create parent account':'Parent sign in'}</h2>
      <div className="auth-tabs">
        <button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Parent sign in</button>
        <button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>New parent</button>
        <button className={mode==='child'?'active':''} onClick={()=>setMode('child')}>Child join</button>
      </div>
      {mode==='child'?<>
        <label>Name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Aria"/></label>
        <label>Child invite code<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} autoCapitalize="characters"/></label>
      </>:<>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} autoComplete={mode==='login'?'current-password':'new-password'}/></label>
      </>}
      {error&&<div className="error-box">{error}</div>}{message&&<div className="notice">{message}</div>}
      <button className="primary wide" disabled={busy} onClick={authSubmit}>{busy?'Working…':mode==='child'?'Join family':mode==='signup'?'Create account':'Sign in'}</button>
    </div>
  </div>;

  if(!membership) return <div className="auth-shell"><div className="auth-card wide-card">
    <div className="brand dark">daylight<span>.</span></div>
    <p className="eyebrow">SET UP FAMILY</p><h2>Connect this parent account</h2>
    <label>Your name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Reza"/></label>
    <div className="onboarding-grid">
      <div><h3>Create a new family</h3><label>Family name<input value={familyName} onChange={e=>setFamilyName(e.target.value)}/></label><button className="primary" disabled={busy} onClick={createNewFamily}>Create family</button></div>
      <div><h3>Join existing family</h3><label>Parent invite code<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)}/></label><button disabled={busy} onClick={joinAsParent}>Join family</button></div>
    </div>
    {error&&<div className="error-box">{error}</div>}
    <button className="link-button" onClick={signOut}>Sign out</button>
  </div></div>;

  return <div className="app">
    <aside>
      <div className="brand">daylight<span>.</span></div><p className="muted">Family tasks</p>
      <nav>
        <button className={page==='today'?'active':''} onClick={()=>setPage('today')}><CheckCircle2/>Today</button>
        <button className={page==='week'?'active':''} onClick={()=>setPage('week')}><CalendarDays/>Weekly planner</button>
        <button className={page==='progress'?'active':''} onClick={()=>setPage('progress')}><span>↗</span>Progress</button>
        <button className={page==='family'?'active':''} onClick={()=>setPage('family')}><Users/>Family</button>
      </nav>
      <div className="profile"><div className="profile-letter">{profileName[0]}</div><div><b>{profileName}</b><small>{membership.role==='parent'?'Parent':'Child'} · live</small></div><button className="icon-button" title="Sign out" onClick={signOut}><LogOut/></button></div>
    </aside>
    <main>
      {error&&<div className="error-box top-error">{error}</div>}
      {message&&<div className="success-box top-error">{message}</div>}
      {page==='today'&&<section>
        <p className="eyebrow">TODAY · {new Date().toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}</p>
        <h1>{isParent?'Today’s':'Small steps,'}<br/><em>{isParent?'family plan.':'big progress.'}</em></h1>
        <p className="lead">{isParent?'See how the day is going. Aria reports each task from his own device.':'Finish each task, ask for help when you need it, and keep your family in the loop.'}</p>
        <div className="cards">{today.length?today.map(task=>{
          const childId=isParent?progressChild:userId;
          const r=childId?resultFor(results,task,new Date(),childId):undefined;
          return <article className="task" key={task.id}><div><small>{timeLabel(task.time_local)}</small><h3>{task.title}</h3>{r?<><span className={'pill '+r.state}>{stateLabel[r.state]}</span>{r.note&&<p className="task-note">“{r.note}”</p>}</>:isParent&&<span className="pill">Waiting</span>}</div>
            {!isParent&&<div className="actions"><button onClick={()=>answer(task,'done')}><CheckCircle2/>Done</button><button onClick={()=>answer(task,'help')}><HelpCircle/>Need help</button><button onClick={()=>answer(task,'not_done')}><XCircle/>Not done</button></div>}
          </article>;
        }):<div className="empty">No tasks scheduled today.</div>}</div>
      </section>}

      {page==='week'&&<section>
        <p className="eyebrow">WEEKLY PLANNER</p><h1>Build a <em>steady rhythm.</em></h1>
        {isParent&&<div className="task-builder">
          <div className="add"><input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="New task"/><input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}/><button onClick={addTask} disabled={busy}><Plus/>Add task</button></div>
          <div className="day-picker">{DAYS.map((day,index)=><button key={day} className={(daysMask&(1<<index))?'selected':''} onClick={()=>setDaysMask(mask=>mask^(1<<index))}>{day}</button>)}</div>
        </div>}
        <div className="planner-week-controls week-controls">
          <button onClick={()=>setWeek(mondayOf(addDays(week,-7)))}>Previous week</button>
          <button onClick={()=>setWeek(mondayOf(new Date()))}>Current week</button>
          <button onClick={()=>setWeek(mondayOf(addDays(week,7)))}>Next week</button>
        </div>
        <div className="week">{days.map((d,i)=><div className="day" key={localDate(d)}><header><b>{DAYS[i]}</b><span>{d.getDate()}</span></header>{dailyTasks(tasks,d).map(t=><div className="mini" key={t.id}><div><b>{t.title}</b><small>{timeLabel(t.time_local)}</small></div>{isParent&&<button className="mini-delete" title="Delete task" onClick={()=>deleteTask(t)}><Trash2/></button>}</div>)}</div>)}</div>
      </section>}

      {page==='progress'&&<section>
        <p className="eyebrow">WEEKLY PROGRESS</p><h1>Progress you can <em>see.</em></h1>
        {isParent&&children.length>1&&<label className="child-select">Child<select value={progressChild} onChange={e=>setSelectedChild(e.target.value)}>{children.map(c=><option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select></label>}
        {!progressChild?<div className="empty">No child has joined yet. Create a child invite from the Family page.</div>:<>
          <div className="stats"><div><strong>{completion}%</strong><span>Completed</span></div><div><strong>{totals.done}</strong><span>Done</span></div><div><strong>{totals.help}</strong><span>Needs help</span></div><div><strong>{totals.not_done}</strong><span>Not done</span></div></div>
          <div className="chart">{weekly.map((x,i)=>{const s=x.stats;const max=Math.max(1,s.total);return <div className="barcol" key={i}><div className="bar"><i style={{height:(s.done/max*100)+'%'}}/><i className="help" style={{height:(s.help/max*100)+'%'}}/><i className="miss" style={{height:(s.not_done/max*100)+'%'}}/></div><span>{DAYS[i]}</span></div>})}</div>
        </>}
        <div className="week-controls"><button onClick={()=>setWeek(dateFromLocal(localDate(new Date(week.getFullYear(),week.getMonth(),week.getDate()-7))))}>Previous week</button><button onClick={()=>setWeek(mondayOf(new Date()))}>Current week</button><button onClick={()=>setWeek(dateFromLocal(localDate(new Date(week.getFullYear(),week.getMonth(),week.getDate()+7))))}>Next week</button></div>
      </section>}

      {page==='family'&&<section>
        <p className="eyebrow">MY FAMILY</p><h1>One plan, <em>together.</em></h1>
        <div className="members">{members.map(m=><article key={m.user_id}><div className="avatar">{m.display_name[0]}</div><div><h3>{m.display_name}</h3><p>{m.role==='parent'?'Parent · manages schedules':'Child · reports tasks'}</p></div></article>)}</div>
        {isParent&&<div className="invite-grid">
          <div className="invite-card"><h3>Invite your wife</h3><p>Create a single-use parent code.</p><button onClick={()=>makeInvite('parent')} disabled={busy}>Create parent invite</button>{parentInvite&&<code>{parentInvite}</code>}</div>
          <div className="invite-card"><h3>Invite Aria</h3><p>Create a single-use child code. Anonymous sign-in must be enabled in Supabase.</p><button onClick={()=>makeInvite('child')} disabled={busy}>Create child invite</button>{childInvite&&<code>{childInvite}</code>}</div>
        </div>}
      </section>}
    </main>
  </div>;
}
