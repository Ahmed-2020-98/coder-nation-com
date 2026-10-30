"use client";

import { createProjectAction, startProjectAction, updateProjectAction } from "@/app/actions/projects";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass, textareaClass } from "@/components/ui/Field";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/task-rules";

type Option = { id: string; name: string };
type Values = { name: string; clientId: string; managerId: string; startDate: string; dueDate: string; notes: string };

function ProjectFields({ values, clients, users }: { values: Values; clients: Option[]; users: Option[] }) {
  return (
    <>
      <FormField label="اسم المشروع" name="name">
        <input id="name" name="name" defaultValue={values.name} maxLength={200} className={inputClass} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="العميل" name="clientId">
          <select id="clientId" name="clientId" defaultValue={values.clientId} className={`${inputClass} cursor-pointer`}>
            <option value="">من غير عميل (مشروع داخلي)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="مدير المشروع" name="managerId">
          <select id="managerId" name="managerId" defaultValue={values.managerId} className={`${inputClass} cursor-pointer`}>
            <option value="">غير محدد</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="تاريخ البدء" name="startDate">
          <input id="startDate" name="startDate" type="date" dir="ltr" defaultValue={values.startDate} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="تاريخ التسليم" name="dueDate">
          <input id="dueDate" name="dueDate" type="date" dir="ltr" defaultValue={values.dueDate} className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <FormField label="ملاحظات" name="notes">
        <textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={values.notes} className={textareaClass} />
      </FormField>
    </>
  );
}

export function NewProjectForm({ clients, users }: { clients: Option[]; users: Option[] }) {
  return (
    <ActionForm action={createProjectAction} className="grid max-w-3xl gap-5">
      <ProjectFields values={{ name: "", clientId: "", managerId: "", startDate: "", dueDate: "", notes: "" }} clients={clients} users={users} />
      <FormError />
      <div>
        <SubmitButton>إنشاء المشروع</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProjectEditForm({ id, status, values, clients, users }: { id: string; status: ProjectStatus; values: Values; clients: Option[]; users: Option[] }) {
  return (
    <ActionForm action={updateProjectAction} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <FormField label="حالة المشروع" name="status">
        <select id="status" name="status" defaultValue={status} className={`${inputClass} cursor-pointer`}>
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </FormField>
      <ProjectFields values={values} clients={clients} users={users} />
      <FormError />
      <div>
        <SubmitButton size="sm">حفظ</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Shown on a won deal that has no project yet. The start date defaults to today (Cairo) on the server if left empty. */
export function StartProjectForm({ dealId, today }: { dealId: string; today: string }) {
  return (
    <ActionForm action={startProjectAction} className="grid gap-4">
      <input type="hidden" name="dealId" value={dealId} />
      <FormField label="تاريخ بدء الشغل" name="startDate" hint="مواعيد مهام المراحل بتتحسب من التاريخ ده">
        <input id="startDate" name="startDate" type="date" dir="ltr" defaultValue={today} className={`${inputClass} text-start`} />
      </FormField>
      <FormError />
      <div>
        <SubmitButton size="sm">ابدأ المشروع</SubmitButton>
      </div>
    </ActionForm>
  );
}
