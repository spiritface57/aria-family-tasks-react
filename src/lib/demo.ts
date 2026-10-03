import type { Task, TaskResult, Member, TaskEdit } from '../types';
import {addDays, dailyTasks, localDate} from './schedule';
const ID = 'demo-family';
export const DEMO_PARENT = 'demo-parent';
export const DEMO_CHILD = 'demo-aria';
export const DEMO_MEMBERS: Member[] = [
  {family_id: ID, user_id: DEMO_PARENT, role: 'parent', display_name: 'Reza'},
  {family_id: ID, user_id: 'demo-mom', role: 'parent', display_name: 'Mom'},
  {family_id: ID, user_id: DEMO_CHILD, role: 'child', display_name: 'Aria'},
];
const examples: (TaskEdit & {id: string})[] = [
  {id:'demo-homework', title:'Finish homework', time_local:'16:30', days_mask:31, active:true},
  {id:'demo-piano', title:'Piano practice', time_local:'18:00', days_mask:21, active:true},
  {id:'demo-read', title:'Read for 20 minutes', time_local:'19:00', days_mask:127, active:true},
  {id:'demo-bag', title:'Prepare school bag', time_local:'20:00', days_mask:79, active:true},
  {id:'demo-room', title:'Tidy up my room', time_local:'10:00', days_mask:32, active:true},
  {id:'demo-week', title:'Plan next week', time_local:'17:00', days_mask:64, active:true},
];
const baseline = new Date(Date.now()-25*86400000).toISOString();
const starterTasks: Task[] = examples.map(e => ({...e, family_id: ID, created_at:baseline}));
function mockResults(): TaskResult[] {
  const result: TaskResult[] = [];
  for (let ago=1;ago<=13;ago++) {
    const date = addDays(new Date(),-ago);
    for (const [index,task] of dailyTasks(starterTasks,date).entries()) {
      const pattern = (index+ago*3)%11;
      if (pattern===4) continue;
      const state: TaskResult['state'] = pattern===2 ? 'help' : pattern===7 ? 'not_done' : 'done';
      result.push({task_id:task.id,child_id:DEMO_CHILD,local_date:localDate(date),state, note:state==='help'?'I could use a little help with this.':state==='not_done'?'I ran out of time.':'',updated_at:date.toISOString()});
    }
  }
  return result;
}
const KEY = 'aria-family-tasks-demo-v1';
export function loadDemo(): {tasks:Task[],results:TaskResult[]} {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const value: unknown = JSON.parse(saved);
      if (value && typeof value==='object' && 'tasks' in value && 'results' in value) {
        const data = value as {tasks: Task[], results: TaskResult[]};
        if (Array.isArray(data.tasks) && Array.isArray(data.results)) return data;
      }
    }
  } catch {}
  return {tasks:starterTasks, results:mockResults()};
}
export function saveDemo(tasks: Task[],results: TaskResult[]) {
  try {localStorage.setItem(KEY,JSON.stringify({tasks,results}));} catch {}
}
