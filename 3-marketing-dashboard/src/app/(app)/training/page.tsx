import { StyleTabs } from "@/components/training/StyleEditor";
import { PageHeader } from "@/components/shell/PageHeader";
import { getStyleView } from "@/server/services/training";

export const dynamic = "force-dynamic";

export default function TrainingPage() {
  const views = [getStyleView("script-style"), getStyleView("montage-style")];
  return (
    <>
      <PageHeader
        index="06"
        title="التدريب"
        description="ملفات أسلوبك في الكتابة والمونتاج: اللي الـ Agents بتقراه وبتلتزم بيه. كل تعديل بيتسجّل في التاريخ وتقدر ترجع له."
      />
      <StyleTabs views={views} />
    </>
  );
}
