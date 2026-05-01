type PreviewItem = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

type Props = {
  title: string;
  roomName?: string;
  startedAt?: string;
  endedAt?: string;
  billNumber?: number;
  items: PreviewItem[];
  productTotal: number;
  hourTotal: number;
  grandTotal: number;
  qrDataUrl?: string;
};

export function BillTemplatePreview({
  title,
  roomName,
  startedAt,
  endedAt,
  billNumber,
  items,
  productTotal,
  hourTotal,
  grandTotal,
  qrDataUrl,
}: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-700">Xem Trước</h4>
      <div className="mx-auto w-full max-w-[80mm] rounded border border-slate-200 bg-white p-3 text-[12px] font-mono shadow-sm">
        <div className="text-center text-[11px] font-bold">KARAOKE SONG PHỤNG 2</div>
        <div className="text-center text-[10px]">373 LÊ QUÝ ĐÔN, AN NHƠN, BÌNH ĐỊNH</div>
        <div className="text-center text-[11px] font-bold">ĐT: 0974 089 367</div>
        <div className="my-1 border-t border-dashed border-slate-300" />
        <div className="text-center text-sm font-bold">{title}</div>
        {roomName && <div className="text-center text-[10px]">Phòng {roomName} ({roomName})</div>}
        {startedAt && <div className="text-center text-[10px]">Bắt đầu: {startedAt}</div>}
        {endedAt && <div className="text-center text-[10px]">Kết thúc: {endedAt}</div>}
        <div className="flex justify-between text-[10px]">
          <span>Nhân viên: Admin</span>
          <span>Số HĐ: {String(billNumber ?? 0).padStart(5, "0")}</span>
        </div>
        <div className="mt-1 border-y border-dashed border-slate-300 py-1">
          <div className="grid grid-cols-[1fr,52px,72px,82px] gap-2 text-[10px] font-semibold">
            <span>Mặt hàng</span>
            <span className="text-right">SL</span>
            <span className="text-right">Đ.GIÁ</span>
            <span className="text-right">T.TIỀN</span>
          </div>
          <div className="my-1 border-t border-dashed border-slate-300" />
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr,52px,72px,82px] gap-2 text-[11px]">
              <span className="break-words whitespace-normal leading-4">{item.name}</span>
              <span className="text-right tabular-nums">{Math.round(item.qty).toLocaleString()}</span>
              <span className="text-right tabular-nums">{Math.round(item.unitPrice).toLocaleString()}</span>
              <span className="text-right tabular-nums">{Math.round(item.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-1 space-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span>TỔNG CỘNG:</span>
            <span>{Math.round(productTotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>TIỀN GIỜ</span>
            <span>{Math.round(hourTotal).toLocaleString()}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-dashed border-slate-300 pt-1 text-sm font-bold">
            <span>TIỀN MẶT (đ):</span>
            <span>{Math.round(grandTotal).toLocaleString()}</span>
          </div>
        </div>
        {qrDataUrl && (
          <div className="mt-2 border-t border-dashed border-slate-300 pt-2">
            <img
              src={qrDataUrl}
              alt="QR thanh toán"
              className="mx-auto h-24 w-24 rounded border border-slate-200 bg-white p-1"
            />
          </div>
        )}
        <div className="mt-2 text-center text-[10px]">HÂN HẠNH ĐƯỢC PHỤC VỤ QUÝ KHÁCH!</div>
      </div>
    </div>
  );
}
