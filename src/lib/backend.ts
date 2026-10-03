import {createClient} from '@supabase/supabase-js';
import type {Session} from '@supabase/supabase-js';
import type {Member, Task, TaskEdit, TaskResult, TaskState} from '../types';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
export const configured = Boolean(url && key && !url.includes('YOUR-PROJECT'));
export const client = configured ? createClient(url!,key!, {
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
}) : null;
function db() {if (!client) throw new Error('Supabase has not been configured.'); return client;}
function unwrap<T>(result: {data: T | null,error: {message: string}|null}): T {
  if (result.error) throw Error(result.error.message);
  if (result.data===null) throw Error('Empty response from database');
  return result.data;
}
export async function currentSession(): Promise<Session|null> {
  const {data,error} = await db().auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function signUp(email:string,password:string): Promise<boolean> {
  const {data,error} = await db().auth.signUp({email,password});
  if(error) throw error;
  return Boolean(data.session);
}
export async function logIn(email:string,password:string) {
  const {error}=await db().auth.signInWithPassword({email,password}); if(error)throw error;
}
export async function logInChild() {
  const {error}=await db().auth.signInAnonymously(); if(error)throw error;
}
export async function logOut() {const {error}=await db().auth.signOut();if(error)throw error;}
export async function getMembership(userId: string): Promise<Member|null> {
  const {data,error}=await db().from('family_members').select('family_id,user_id,role,display_name').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  return data as Member|null;
}
export async function createFamily(familyName: string,name: string) {
  return unwrap(dbResult(await db().rpc('create_family',{p_name:familyName,p_display_name:name})));
}
export async function joinFamily(code: string,name: string) {
  return unwrap(dbResult(await db().rpc('join_family',{p_code:code,p_display_name:name})));
}
export async function createInvite(familyId: string,role: 'parent'|'child'): Promise<string> {
  const result=unwrap(dbResult(await db().rpc('create_invite',{p_family:familyId,p_role:role}))) as {code:string};
  return result.code;
}
function dbResult<T>(res: {data:T|null,error:{message:string}|null}) {return res;}
export async function fetchFamilyData(familyId: string, earliest: string): Promise<{tasks:Task[],results:TaskResult[],members:Member[]}> {
  const [t,r,m]=await Promise.all([
    db().from('tasks').select('id,family_id,title,days_mask,time_local,active,created_at').eq('family_id',familyId).order('time_local'),
    db().from('task_results').select('task_id,child_id,local_date,state,note,updated_at').gte('local_date',earliest).order('updated_at'),
    db().from('family_members').select('family_id,user_id,role,display_name').eq('family_id',familyId)
  ]);
  return {tasks:unwrap(t) as Task[],results:unwrap(r) as TaskResult[],members:unwrap(m) as Member[]};
}
export async function insertTask(familyId:string, edit:TaskEdit) {
  const {error}=await db().from('tasks').insert({...edit,family_id:familyId});if(error)throw error;
}
export async function updateTask(id:string,edit:TaskEdit) {
  const {error}=await db().rpc('update_task',{p_id:id,p_title:edit.title,p_time:edit.time_local,p_days:edit.days_mask,p_active:edit.active});if(error)throw error;
}
export async function removeTask(id:string) {
  const {error}=await db().from('tasks').delete().eq('id',id);if(error)throw error;
}
export async function recordResult(taskId:string,childId:string,date:string,state:TaskState,note:string) {
  const {error}=await db().from('task_results').upsert({task_id:taskId,child_id:childId,local_date:date,state,note:note.slice(0,500),updated_at:new Date().toISOString()}, {onConflict:'task_id,child_id,local_date'});
  if(error)throw error;
}
