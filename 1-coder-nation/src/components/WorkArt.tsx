import { cn } from "@/lib/cn";

// The cover of a project: its uploaded picture, or (until there is one) a drawing of the kind of product it is, on a
// gradient. Shared by the home page's cards and the /work pages, so a project looks the same everywhere.

export type ArtKind = "browser" | "phone" | "dashboard";

// One gradient per card so the grid has rhythm; all come from the colour scales.
const gradients = [
  "from-secondary-600 to-secondary-800",
  "from-primary-500 to-primary-700",
  "from-secondary-500 to-secondary-700",
  "from-primary-600 to-secondary-800",
  "from-secondary-700 to-secondary-900",
  "from-primary-400 to-primary-600",
];

function BrowserArt() {
  return (
    <div className="absolute inset-x-[9%] top-[13%] bottom-0 overflow-hidden rounded-t-xl bg-white shadow-lift">
      <div className="flex items-center gap-1 border-b border-secondary-100 px-3 py-2">
        {[0, 1, 2].map((n) => (
          <span key={n} className="size-1.5 rounded-full bg-secondary-200" />
        ))}
        <span className="ms-2 h-2 w-1/3 rounded bg-secondary-100" />
      </div>
      <div className="grid gap-2.5 p-3.5">
        <div className="flex items-center justify-between">
          <span className="h-2 w-1/4 rounded bg-secondary-900" />
          <span className="h-2 w-1/5 rounded bg-secondary-200" />
        </div>
        <div className="h-[4.25rem] rounded-lg bg-secondary-900 p-3">
          <span className="block h-2 w-2/3 rounded bg-white" />
          <span className="mt-2 block h-1.5 w-1/2 rounded bg-secondary-300" />
          <span className="mt-3 block h-3 w-14 rounded bg-primary-500" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-11 rounded-md bg-secondary-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PhoneScreen({ dark = false }: { dark?: boolean }) {
  return (
    <div className={cn("h-full rounded-[0.9rem] p-2", dark ? "bg-secondary-900" : "bg-secondary-50")}>
      <span className={cn("mx-auto mb-2 block h-1 w-6 rounded-full", dark ? "bg-secondary-700" : "bg-secondary-200")} />
      <span className="block h-9 rounded-md bg-primary-500" />
      <div className="mt-2 grid gap-1.5">
        {[0, 1, 2].map((n) => (
          <span key={n} className={cn("h-3 rounded", dark ? "bg-secondary-700" : "bg-secondary-200")} />
        ))}
      </div>
    </div>
  );
}

function PhoneArt() {
  return (
    <>
      <div className="absolute start-[17%] top-[14%] aspect-[9/18] w-[30%] rounded-[1.1rem] bg-white p-1 shadow-lift">
        <PhoneScreen />
      </div>
      <div className="absolute end-[17%] top-[26%] aspect-[9/18] w-[30%] rounded-[1.1rem] bg-secondary-950 p-1 shadow-lift">
        <PhoneScreen dark />
      </div>
    </>
  );
}

const bars = [40, 65, 50, 82, 60, 92, 72];

function DashboardArt() {
  return (
    <div className="absolute inset-x-[9%] top-[14%] bottom-0 flex overflow-hidden rounded-t-xl bg-white shadow-lift">
      <div className="grid w-[18%] content-start gap-2 bg-secondary-900 p-2.5">
        <span className="h-2 rounded bg-primary-500" />
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className="h-1.5 rounded bg-secondary-600" />
        ))}
      </div>
      <div className="flex-1 p-3">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-9 rounded-md bg-secondary-100 p-1.5">
              <span className="block h-1.5 w-1/2 rounded bg-secondary-300" />
              <span className="mt-1.5 block h-2 w-3/4 rounded bg-secondary-900" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex h-[4.25rem] items-end gap-1.5 rounded-md bg-secondary-50 p-2">
          {bars.map((h, n) => (
            <span
              key={n}
              style={{ height: `${h}%` }}
              className={cn("flex-1 rounded-sm", n === 5 ? "bg-primary-500" : "bg-secondary-300")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const arts: Record<ArtKind, () => React.JSX.Element> = {
  browser: BrowserArt,
  phone: PhoneArt,
  dashboard: DashboardArt,
};

/**
 * Fills its (relatively positioned) parent. `index` picks the gradient, so neighbouring cards differ; `zoom` scales the
 * picture on hover of the nearest `group/card`.
 */
export function WorkCover({ art, image, title, index, zoom = true, eager = false }: { art: ArtKind; image: string; title: string; index: number; zoom?: boolean; eager?: boolean }) {
  const Art = arts[art] ?? BrowserArt;
  const motion = zoom ? "transition-transform duration-700 ease-(--ease-out-expo) group-hover/card:scale-[1.04]" : "";
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-gradient-to-br", gradients[index % gradients.length])}>
      {image ? (
        // A plain <img>: the file is served by our own /media route from the database, which next/image's optimizer would only duplicate.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/media/${image}`} alt={title} loading={eager ? "eager" : "lazy"} decoding="async" className={cn("absolute inset-0 size-full object-cover", motion)} />
      ) : (
        <div aria-hidden="true" className={cn("absolute inset-0", motion)}>
          <Art />
        </div>
      )}
    </div>
  );
}
