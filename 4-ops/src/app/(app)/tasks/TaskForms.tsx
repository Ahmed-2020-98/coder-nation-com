"use client";

import { useState } from "react";
import { addCommentAction, assignTaskAction, changeTaskStatusAction, createTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass, textareaClass } from "@/components/ui/Field";
import { PRIORITIES, PRIORITY_LABEL, TASK_STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/task-rules";

type Option = { id: string; name: string };
type Fields = { title: string; description: string; priority: Priority; dueDate: string; projectId: string; dealId: string; clientId: string };

function TaskFields({ values, projects }: { values: Fields; projects: Option[] }) {
  return (
    <>
      <input type="hidden" name="dealId" value={values.dealId} />
      <input type="hidden" name="clientId" value={values.clientId} />
      <FormField label="العنوان" name="title">
        <input id="title" name="title" defaultValue={values.title} maxLength={200} className={inputClass} />
      </FormField>
      <FormField label="الوصف" name="description">
        <textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={values.description} className={textareaClass} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="الأولوية" name="priority">
          <select id="priority" name="priority" defaultValue={values.priority} className={`${inputClass} cursor-pointer`}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="موعد التسليم" name="dueDate">
          <input id="dueDate" name="dueDate" type="date" dir="ltr" defaultValue={values.dueDate} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="المشروع" name="projectId">
          <select id="projectId" name="projectId" defaultValue={values.projectId} className={`${inputClass} cursor-pointer`}>
            <option value="">مهمة مستقلة</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
    </>
  );
}

export function TaskForm({ users, projects, defaults }: { users: Option[]; projects: Option[]; defaults: { projectId: string; dealId: string; clientId: string } }) {
  return (
    <ActionForm action={createTaskAction} className="grid max-w-3xl gap-5">
      <TaskFields values={{ title: "", description: "", priority: "normal", dueDate: "", ...defaults }} projects={projects} />
      <FormField label="المسؤول" name="assigneeId">
        <select id="assigneeId" name="assigneeId" defaultValue="" className={`${inputClass} cursor-pointer`}>
          <option value="">من غير مسؤول</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormError />
      <div>
        <SubmitButton>إنشاء المهمة</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TaskEditForm({ id, values, projects }: { id: string; values: Fields; projects: Option[] }) {
  return (
    <ActionForm action={updateTaskAction} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <TaskFields values={values} projects={projects} />
      <FormError />
      <div>
        <SubmitButton size="sm">حفظ</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TaskAssignForm({ id, assigneeId, users }: { id: string; assigneeId: string | null; users: Option[] }) {
  return (
    <ActionForm action={assignTaskAction} className="flex items-end gap-3">
      <input type="hidden" name="id" value={id} />
      <FormField label="المسؤول عن المهمة" name="assigneeId" className="flex-1">
        <select id="assigneeId" name="assigneeId" defaultValue={assigneeId ?? ""} className={`${inputClass} cursor-pointer`}>
          <option value="">من غير مسؤول</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </FormField>
      <SubmitButton size="sm" variant="secondary">
        إسناد
      </SubmitButton>
    </ActionForm>
  );
}

/** `allowed` is what this role may move the task to (decided on the server); the server checks it again on submit. */
export function TaskStatusForm({ id, status, allowed }: { id: string; status: TaskStatus; allowed: TaskStatus[] }) {
  const [target, setTarget] = useState<TaskStatus>(allowed[0] ?? status);
  if (allowed.length === 0) return <p className="text-sm text-ink-muted">مفيش حركة متاحة ليك على المهمة دي.</p>;
  return (
    <ActionForm action={changeTaskStatusAction} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <FormField label="الحالة الجديدة" name="status">
        <select id="status" name="status" value={target} onChange={(event) => setTarget(event.target.value as TaskStatus)} className={`${inputClass} cursor-pointer`}>
          {allowed.map((value) => (
            <option key={value} value={value}>
              {TASK_STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </FormField>
      {target === "blocked" ? (
        <FormField label="سبب التعطيل" name="reason" hint="مطلوب: إيه اللي مانع الشغل؟">
          <input id="reason" name="reason" maxLength={300} className={inputClass} />
        </FormField>
      ) : null}
      <FormError />
      <div>
        <SubmitButton size="sm">نقل</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CommentForm({ id }: { id: string }) {
  return (
    <ActionForm action={addCommentAction} resetOnSuccess className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormField label="تعليق" name="body">
        <textarea id="body" name="body" rows={2} maxLength={4000} className={textareaClass} />
      </FormField>
      <div>
        <SubmitButton size="sm" variant="secondary">
          إضافة تعليق
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
