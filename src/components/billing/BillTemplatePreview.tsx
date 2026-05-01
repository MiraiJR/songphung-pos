type PreviewItem = {
  id: string;
  name: string;
  qty: number;
  amount: number;
};

type Props = {
  title: string;
  items: PreviewItem[];
  productTotal: number;
  hourTotal: number;
  grandTotal: number;
};

export function BillTemplatePreview({ title, items, productTotal, hourTotal, grandTotal }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Xem Trước</h4>
      <div className="mx-auto w-full max-w-[80mm] rounded border border-slate-200 bg-white p-3 text-[12px] font-mono shadow-sm">
        <div className="text-center text-sm font-bold">{title}</div>
        <div className="mt-1 border-y border-dashed border-slate-300 py-1">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr,68px,96px] gap-2 text-[11px]">
              <span className="truncate">{item.name}</span>
              <span className="text-right tabular-nums">{Math.round(item.qty).toLocaleString()}</span>
              <span className="text-right tabular-nums">{Math.round(item.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 space-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span>TIỀN MÓN</span>
            <span>{Math.round(productTotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>TIỀN GIỜ</span>
            <span>{Math.round(hourTotal).toLocaleString()}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-dashed border-slate-300 pt-1 text-sm font-bold">
            <span>TỔNG CỘNG</span>
            <span>{Math.round(grandTotal).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
