import { CopyButton } from "./CopyButton";

type Props = {
  code: string;
  title?: string;
  description?: string;
};

export function EmbedCodeCard({
  code,
  title = "Wix embed code",
  description,
}: Props) {
  return (
    <div className="min-w-0 rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-sky-700">{title}</p>
          {description && (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          )}
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="mt-4 max-w-full overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-50">
        {code}
      </pre>
    </div>
  );
}
