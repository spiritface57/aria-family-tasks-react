export type Role = 'parent' | 'child';
export type TaskState = 'done' | 'help' | 'not_done';
export type Task = {
  id: string;
  family_id: string;
  title: string;
  days_mask: number;
  time_local: string;
  active: boolean;
  created_at: string;
};
export type TaskResult = {
  task_id: string;
  child_id: string;
  local_date: string;
  state: TaskState;
  note: string;
  updated_at: string;
};
export type Member = {
  family_id: string;
  user_id: string;
  role: Role;
  display_name: string;
};
export type TaskEdit = Pick<Task, 'title'|'days_mask'|'time_local'|'active'>;
export type View = 'overview' | 'schedule' | 'insights' | 'family';
