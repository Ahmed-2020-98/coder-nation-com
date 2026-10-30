"use client";

import { addLeaveAction, deleteRecordAction, removeShiftAction, saveRecordAction, saveShiftAction } from "@/app/actions/attendance";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass } from "@/components/ui/Field";
import { DEFAULT_SHIFT, LEAVE_KINDS, LEAVE_LABEL, WEEKDAY_LABEL, type Schedule } from "@/lib/attendance-rules";

type Option = { id: string; name: string };

/** Shift for one person. Days run Sunday..Saturday; with no saved shift it starts from the default (Sun-Thu, 9-5, 15 min). */
export function ShiftForm({ userId, schedule }: { userId: string; schedule: Schedule | null }) {
  const shift = schedule ?? DEFAULT_SHIFT;
  return (
    <ActionForm action={saveShiftAction} className="grid gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="بداية الوردية" name="startTime">
          <input id="startTime" name="startTime" type="time" dir="ltr" defaultValue={shift.startTime} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="نهاية الوردية" name="endTime">
          <input id="endTime" name="endTime" type="time" dir="ltr" defaultValue={shift.endTime} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="مهلة التأخير (دقيقة)" name="graceMinutes" hint="التأخير بيتحسب بس بعد المهلة دي" className="col-span-2">
          <input id="graceMinutes" name="graceMinutes" type="number" min={0} max={120} dir="ltr" defaultValue={shift.graceMinutes} className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">أيام الشغل</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABEL.map((label, day) => (
            <label key={day} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft">
              <input type="checkbox" name="workDays" value={day} defaultChecked={shift.workDays.includes(day)} className="size-4 accent-primary-500" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError />
      <div>
        <SubmitButton size="sm">{schedule ? "حفظ الوردية" : "ابدأ تتبّع الحضور"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StopTrackingForm({ userId }: { userId: string }) {
  return (
    <ActionForm action={removeShiftAction}>
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton size="sm" variant="danger">
        إيقاف تتبّع الحضور
      </SubmitButton>
    </ActionForm>
  );
}

/** Fix or add a day. Saving over an existing day replaces it; the old times stay in the trail with this reason. */
export function RecordForm({ userId, today }: { userId: string; today: string }) {
  return (
    <ActionForm action={saveRecordAction} resetOnSuccess className="grid gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="اليوم" name="date" className="col-span-2">
          <input id="date" name="date" type="date" dir="ltr" max={today} defaultValue={today} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="الحضور" name="checkIn">
          <input id="checkIn" name="checkIn" type="time" dir="ltr" className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="الانصراف" name="checkOut" hint="سيبه فاضي لو لسه ما انصرفش">
          <input id="checkOut" name="checkOut" type="time" dir="ltr" className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <FormField label="السبب" name="reason" hint="مطلوب، وبيتسجّل في السجل">
        <input id="reason" name="reason" maxLength={300} className={inputClass} />
      </FormField>
      <FormError />
      <div>
        <SubmitButton size="sm">حفظ اليوم</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteRecordForm({ userId, today }: { userId: string; today: string }) {
  return (
    <ActionForm action={deleteRecordAction} resetOnSuccess className="grid gap-3">
      <input type="hidden" name="userId" value={userId} />
      <FormField label="اليوم" name="date">
        <input id="delDate" name="date" type="date" dir="ltr" max={today} className={`${inputClass} text-start`} />
      </FormField>
      <FormField label="سبب المسح" name="reason">
        <input id="delReason" name="reason" maxLength={300} className={inputClass} />
      </FormField>
      <FormError />
      <div>
        <SubmitButton size="sm" variant="danger">
          مسح تسجيل
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** A leave for one person (`userId` fixed) or a choice of person / everyone tracked (`users` given). */
export function LeaveForm({ userId, users }: { userId?: string; users?: Option[] }) {
  return (
    <ActionForm action={addLeaveAction} resetOnSuccess className="grid gap-4">
      {userId ? (
        <input type="hidden" name="userId" value={userId} />
      ) : (
        <div className="grid gap-3">
          <FormField label="الموظف" name="userId">
            <select id="userId" name="userId" defaultValue="" className={`${inputClass} cursor-pointer`}>
              <option value="">اختار...</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="everyone" value="1" className="size-4 accent-primary-500" />
            لكل الموظفين المتتبَّعين (مثلًا عيد أو إجازة رسمية)
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="النوع" name="kind" className="col-span-2">
          <select id="kind" name="kind" defaultValue="annual" className={`${inputClass} cursor-pointer`}>
            {LEAVE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {LEAVE_LABEL[kind]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="من" name="startDate">
          <input id="startDate" name="startDate" type="date" dir="ltr" className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="إلى (ويشمل اليوم ده)" name="endDate">
          <input id="endDate" name="endDate" type="date" dir="ltr" className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <FormField label="ملاحظة" name="note">
        <input id="note" name="note" maxLength={300} className={inputClass} />
      </FormField>
      <FormError />
      <div>
        <SubmitButton size="sm">تسجيل الإجازة</SubmitButton>
      </div>
    </ActionForm>
  );
}
