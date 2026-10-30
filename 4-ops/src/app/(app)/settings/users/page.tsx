import type { Metadata } from "next";
import { CreateUserForm, ResetPasswordForm } from "./UserForms";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { setActiveAction, setRoleAction } from "@/app/actions/admin";
import { ROLES, ROLE_LABEL } from "@/lib/crm-rules";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/session";
import { listUsers } from "@/server/users";

export const metadata: Metadata = { title: "الفريق" };

export default async function UsersPage() {
  const me = await requirePermission("users.manage");
  const users = await listUsers();
  return (
    <>
      <PageHeader title="الفريق" description="كل حد بيدخل بحسابه. الحساب الجديد بيبدأ بباسورد مؤقت لازم يتغيّر في أول دخول." />
      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">أعضاء الفريق</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">الاسم</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الدور</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">آخر دخول</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">
                        {user.name} {!user.active ? <Badge tone="error">موقوف</Badge> : null}
                        {user.mustChangePassword ? <Badge tone="accent">باسورد مؤقت</Badge> : null}
                      </p>
                      <p dir="ltr" className="text-start text-xs text-ink-muted">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {user.id === me.id ? (
                        ROLE_LABEL[user.role]
                      ) : (
                        <form action={setRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={user.id} />
                          <select name="role" defaultValue={user.role} aria-label={`دور ${user.name}`} className="h-9 cursor-pointer rounded-lg border border-line-strong bg-surface px-2">
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABEL[role]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="h-9 cursor-pointer rounded-lg border border-line-strong px-3 font-semibold hover:border-accent hover:text-accent">
                            حفظ
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "لم يدخل بعد"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {user.id !== me.id ? (
                          <form action={setActiveAction}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="active" value={user.active ? "0" : "1"} />
                            <button type="submit" className="h-9 cursor-pointer rounded-lg border border-line-strong px-3 font-semibold hover:border-accent hover:text-accent">
                              {user.active ? "إيقاف" : "تفعيل"}
                            </button>
                          </form>
                        ) : null}
                        <ResetPasswordForm id={user.id} name={user.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">إضافة عضو</h2>
          <CreateUserForm />
        </Card>
      </div>
    </>
  );
}
