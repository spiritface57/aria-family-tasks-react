import {useMemo,useState} from 'react';
import {CalendarDays,CheckCircle2,HelpCircle,Plus,Users,XCircle} from 'lucide-react';
import type {Task,TaskResult,TaskState} from './types';
import {DAYS,dateFromLocal,dayStats,dailyTasks,localDate,mondayOf,resultFor,timeLabel,weekDays} from './lib/schedule';
import {DEMO_CHILD,DEMO_MEMBERS,loadDemo,saveDemo} from './lib/demo';

type Page='today'|'week'|'progress'|'family';
const stateLabel:Record<TaskState,string>={done:'Done',help:'Need help',not_done:'Not done'};

export default function App(){
  const initial=useMemo(()=>loadDemo(),[]);
  const [tasks,setTasks]=useState<Task[]>(initial.tasks);
  const [results,setResults]=useState<TaskResult[]>(initial.results);
  const [page,setPage]=useState<Page>('today');
  const [week,setWeek]=useState(()=>mondayOf(new Date()));
  const [newTitle,setNewTitle]=useState('');
  const [newTime,setNewTime]=useState('17:00');

  const update=(task:Task,state:TaskState)=>{
    const date=localDate(new Date());
    const next=results.filter(r=>!(r.task_id===task.id&&r.child_id===DEMO_CHILD&&r.local_date===date));
    next.push({task_id:task.id,child_id:DEMO_CHILD,local_date:date,state,note:'',updated_at:new Date().toISOString()});
    setResults(next); saveDemo(tasks,next);
  };
  const addTask=()=>{
    if(!newTitle.trim())return;
    const next=[...tasks,{id:crypto.randomUUID(),family_id:'demo-family',title:newTitle.trim(),days_mask:127,time_local:newTime,active:true,created_at:new Date().toISOString()}];
    setTasks(next);saveDemo(next,results);setNewTitle('');
  };
  const today=dailyTasks(tasks,new Date());
  const days=weekDays(week);
  const weekly=days.map(d=>({date:d,stats:dayStats(tasks,results,d,DEMO_CHILD)}));
  const totals=weekly.reduce((a,x)=>({done:a.done+x.stats.done,help:a.help+x.stats.help,not_done:a.not_done+x.stats.not_done,total:a.total+x.stats.total}),{done:0,help:0,not_done:0,total:0});
  const completion=totals.total?Math.round(totals.done/totals.total*100):0;

  return <div className="app">
    <aside>
      <div className="brand">daylight<span>.</span></div>
      <p className="muted">Family tasks</p>
      <nav>
        <button className={page==='today'?'active':''} onClick={()=>setPage('today')}><CheckCircle2/>Today</button>
        <button className={page==='week'?'active':''} onClick={()=>setPage('week')}><CalendarDays/>Weekly planner</button>
        <button className={page==='progress'?'active':''} onClick={()=>setPage('progress')}><span>↗</span>Progress</button>
        <button className={page==='family'?'active':''} onClick={()=>setPage('family')}><Users/>Family</button>
      </nav>
      <div className="profile">A <div><b>Aria</b><small>Child view · demo</small></div></div>
    </aside>
    <main>
      {page==='today'&&<section>
        <p className="eyebrow">TODAY · {new Date().toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'})}</p>
        <h1>Small steps,<br/><em>big progress.</em></h1>
        <p className="lead">Finish each task, ask for help when you need it, and keep your family in the loop.</p>
        <div className="cards">{today.length?today.map(task=>{
          const r=resultFor(results,task,new Date(),DEMO_CHILD);
          return <article className="task" key={task.id}><div><small>{timeLabel(task.time_local)}</small><h3>{task.title}</h3>{r&&<span className={'pill '+r.state}>{stateLabel[r.state]}</span>}</div>
            <div className="actions"><button onClick={()=>update(task,'done')}><CheckCircle2/>Done</button><button onClick={()=>update(task,'help')}><HelpCircle/>Need help</button><button onClick={()=>update(task,'not_done')}><XCircle/>Not done</button></div></article>
        }):<div className="empty">No tasks scheduled today.</div>}</div>
      </section>}
      {page==='week'&&<section>
        <p className="eyebrow">WEEKLY PLANNER</p><h1>Build a <em>steady rhythm.</em></h1>
        <div className="add"><input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="New task"/><input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}/><button onClick={addTask}><Plus/>Add daily task</button></div>
        <div className="week">{days.map((d,i)=><div className="day" key={localDate(d)}><header><b>{DAYS[i]}</b><span>{d.getDate()}</span></header>{dailyTasks(tasks,d).map(t=><div className="mini" key={t.id}><b>{t.title}</b><small>{timeLabel(t.time_local)}</small></div>)}</div>)}</div>
      </section>}
      {page==='progress'&&<section>
        <p className="eyebrow">THIS WEEK</p><h1>Progress you can <em>see.</em></h1>
        <div className="stats"><div><strong>{completion}%</strong><span>Completed</span></div><div><strong>{totals.done}</strong><span>Done</span></div><div><strong>{totals.help}</strong><span>Needs help</span></div><div><strong>{totals.not_done}</strong><span>Not done</span></div></div>
        <div className="chart">{weekly.map((x,i)=>{const s=x.stats;const max=Math.max(1,s.total);return <div className="barcol" key={i}><div className="bar"><i style={{height:(s.done/max*100)+'%'}}/><i className="help" style={{height:(s.help/max*100)+'%'}}/><i className="miss" style={{height:(s.not_done/max*100)+'%'}}/></div><span>{DAYS[i]}</span></div>})}</div>
        <div className="week-controls"><button onClick={()=>setWeek(dateFromLocal(localDate(new Date(week.getFullYear(),week.getMonth(),week.getDate()-7))))}>Previous week</button><button onClick={()=>setWeek(mondayOf(new Date()))}>Current week</button></div>
      </section>}
      {page==='family'&&<section>
        <p className="eyebrow">MY FAMILY</p><h1>One plan, <em>together.</em></h1>
        <div className="members">{DEMO_MEMBERS.map(m=><article key={m.user_id}><div className="avatar">{m.display_name[0]}</div><div><h3>{m.display_name}</h3><p>{m.role==='parent'?'Parent · can manage schedules':'Child · can report tasks'}</p></div></article>)}</div>
        <div className="notice"><b>Demo mode</b><p>This repository includes the Supabase integration layer for shared family accounts. Configure the environment variables and database schema to switch from browser-local demo data to live synchronization.</p></div>
      </section>}
    </main>
  </div>
}
