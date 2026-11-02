import type { Metadata } from "next";
import { revokeTokenAction } from "@/app/actions/api-tokens";
import { NewTokenForm } from "./TokenForms";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatDate, formatDateTime } from "@/lib/format";
import { listTokens, recentCalls } from "@/server/api-tokens";
import { appUrl } from "@/server/env";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "مفاتيح الـ MCP" };

function tokenState(token: { revokedAt: Date | null; expiresAt: Date }, now: number): { label: string; tone: "success" | "error" | "neutral" } {
  if (token.revokedAt) return { label: "ملغي", tone: "error" };
  if (token.expiresAt.getTime() <= now) return { label: "منتهي", tone: "neutral" };
  return { label: "شغال", tone: "success" };
}

export default async function McpTokensPage() {
  await requirePermission("mcp.manage");
  const [tokens, calls] = await Promise.all([listTokens(), recentCalls(60)]);
  // eslint-disable-next-line react-hooks/purity -- a server component renders once per request; "now" is that request's time
  const now = Date.now();
  const endpoint = `${appUrl()}/api/mcp`;

  return (
    <>
      <PageHeader
        title="مفاتيح الـ MCP"
        description="المفتاح بيخلّي Claude (أو أي MCP client) يقرا ويكتب في النظام بصلاحياتك إنت بالظبط. اللي معاه المفتاح كأنه داخل بحسابك: ماتبعتهوش لحد، ولو اتسرّب الغيه فورًا."
      />

      <Card className="mb-7 grid gap-4 p-6">
        <h2 className="text-lg font-bold">مفتاح جديد</h2>
        <NewTokenForm endpoint={endpoint} />
        <p className="text-sm text-ink-muted">
          عنوان الـ MCP: <code dir="ltr" className="rounded bg-canvas-alt px-1.5 py-0.5 font-mono">{endpoint}</code>. الباسوردات عمرها ما بتعدّي على الـ MCP: الحسابات الجديدة بتاخد باسوردها المؤقت من «الفريق».
        </p>
      </Card>

      <Card className="mb-7 overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 text-lg font-bold">المفاتيح</h2>
        {tokens.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">لسه مفيش مفاتيح.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tokens.map((token) => {
              const state = tokenState(token, now);
              return (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {token.name}
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      <code dir="ltr" className="font-mono">{token.prefix}…</code> · {token.userName} · اتعمل {formatDate(token.createdAt)} · ينتهي {formatDate(token.expiresAt)} ·{" "}
                      {token.lastUsedAt ? `آخر استخدام ${formatDateTime(token.lastUsedAt)}` : "لسه ما اتستخدمش"}
                    </p>
                  </div>
                  {state.label === "شغال" ? (
                    <form action={revokeTokenAction}>
                      <input type="hidden" name="id" value={token.id} />
                      <button type="submit" className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-error-500/50 px-3 text-sm font-semibold text-error-700 hover:bg-error-500/10">
                        إلغاء المفتاح
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 text-lg font-bold">آخر العمليات من خلال الـ MCP</h2>
        {calls.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-muted">مفيش عمليات لسه. أي تعديل أو محاولة مرفوضة بتظهر هنا.</p>
        ) : (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">سجل عمليات الـ MCP</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">الوقت</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">العملية</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">المفتاح</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">النتيجة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {calls.map((call, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">{formatDateTime(call.createdAt)}</td>
                    <td className="px-4 py-2.5 font-mono" dir="ltr">
                      <span className="block text-start">{call.tool}</span>
                    </td>
                    <td className="px-4 py-2.5">{call.tokenName}</td>
                    <td className="px-4 py-2.5">{call.ok ? <Badge tone="success">تمت</Badge> : <span className="text-error-700">{call.error ?? "مرفوضة"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
