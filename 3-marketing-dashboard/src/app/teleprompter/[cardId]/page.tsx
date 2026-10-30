import { PrompterClient } from "@/components/filming/PrompterLoader";
import { Button } from "@/components/ui/Button";
import { DEFAULT_WORDS_PER_SECOND } from "@/lib/script-math";
import { getScriptView } from "@/server/services/script";
import { ServiceError } from "@/server/services/common";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teleprompter | Coder Nation" };

export default async function TeleprompterPage(props: PageProps<"/teleprompter/[cardId]">) {
  const { cardId } = await props.params;
  let view = null;
  try {
    view = getScriptView(cardId);
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
  }

  const script = view?.script;
  if (!view || !script) {
    return (
      <main data-tone="navy" className="grid min-h-svh place-items-center bg-canvas p-6 text-center text-ink">
        <div>
          <h1 className="text-2xl font-bold">مفيش سكريبت يتعرض</h1>
          <p className="mt-2 text-ink-muted">اكتب السكريبت الأول من صفحة السكريبت.</p>
          <Button href="/script" className="mt-5">روح للسكريبت</Button>
        </div>
      </main>
    );
  }

  const rate = view.style.rate ?? DEFAULT_WORDS_PER_SECOND;
  return (
    <PrompterClient
      title={view.card.title}
      backHref={`/filming?card=${view.card.id}`}
      initialWpm={Math.round(rate * 60)}
      sections={[
        { key: "hook", label: "HOOK", text: script.parts.hook },
        { key: "body", label: "المحتوى", text: script.parts.body },
        { key: "cta", label: "CTA", text: script.parts.cta },
      ]}
    />
  );
}
