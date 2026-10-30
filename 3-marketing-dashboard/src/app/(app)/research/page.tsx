import { PageHeader } from "@/components/shell/PageHeader";
import { ResearchWorkbench } from "@/components/research/ResearchWorkbench";
import { listCards } from "@/server/db";
import { getIdeasView, getKeywords, listCommentFiles, listIdeaBatches } from "@/server/services/research";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  const batches = listIdeaBatches();
  const initialBatchFile = batches[0]?.file ?? null;
  let initialView = null;
  try {
    initialView = initialBatchFile ? getIdeasView(initialBatchFile) : null;
  } catch {
    initialView = null;
  }
  const { keywords, trends } = getKeywords();
  const cards = listCards().map(({ id, slug, ideaFile, ideaNo }) => ({ id, slug, ideaFile, ideaNo }));

  return (
    <>
      <PageHeader
        index="02"
        title="Research"
        description="حوّل كومنتات TikTok لأسئلة متجمّعة بعدد تكرارها، واختار منها فكرة الفيديو الجاي."
      />
      <ResearchWorkbench
        commentFiles={listCommentFiles()}
        batches={batches}
        initialBatchFile={initialBatchFile}
        initialView={initialView}
        keywords={keywords}
        trends={trends}
        cards={cards}
      />
    </>
  );
}
