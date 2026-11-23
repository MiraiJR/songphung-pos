import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateRangeInput, type DateRange } from "@astryxdesign/core/DateRangeInput";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { formatInvokeError } from "@/utils/invokeError";

type RangeMode = "range" | "month";
type ISODate = DateRange["start"];

type RevenueDay = {
  ngay: string;
  doanh_thu: number;
};

type RevenueStats = {
  nam: number;
  hom_nay: string;
  tong_doanh_thu_nam: number;
  tong_tien_gio_nam: number;
  ngay: RevenueDay[];
};

type ChartPoint = {
  label: string;
  fullLabel: string;
  doanhThu: number;
};

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;
const WEEKDAY_LONG = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"] as const;
const MAX_RANGE_DAYS = 93;

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `Tháng ${index + 1}`,
}));

function parseYmd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function toIso(date: Date): ISODate {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}` as ISODate;
}

function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function monthBounds(year: number, month: number): { start: ISODate; end: ISODate } {
  const lastDay = new Date(year, month, 0).getDate();
  const monthText = String(month).padStart(2, "0");
  return {
    start: `${year}-${monthText}-01` as ISODate,
    end: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}` as ISODate,
  };
}

function formatDayMonth(value: string): string {
  const date = parseYmd(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatFullDate(value: string): string {
  const date = parseYmd(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAY_LONG[date.getDay()]}, ${day}/${month}/${date.getFullYear()}`;
}

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = parseYmd(start);
  const last = parseYmd(end).getTime();
  while (cursor.getTime() <= last) {
    days.push(toIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

function formatAxisMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("vi-VN")}k`;
  }
  return Math.round(value).toLocaleString("vi-VN");
}

function orderedRange(range: DateRange): { start: ISODate; end: ISODate } {
  return range.start <= range.end
    ? { start: range.start, end: range.end }
    : { start: range.end, end: range.start };
}

function buildPoints(days: RevenueDay[], start: string, end: string): ChartPoint[] {
  const byDay = new Map(days.map((row) => [row.ngay, row.doanh_thu]));
  const dates = eachDay(start, end);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return dates.map((ngay) => {
    const date = parseYmd(ngay);
    const label =
      dates.length <= 14
        ? `${WEEKDAY_SHORT[date.getDay()]} ${formatDayMonth(ngay)}`
        : sameMonth
          ? String(date.getDate())
          : formatDayMonth(ngay);
    return {
      label,
      fullLabel: formatFullDate(ngay),
      doanhThu: byDay.get(ngay) ?? 0,
    };
  });
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <Card padding={3}>
      <VStack gap={1}>
        <Text size="sm" color="secondary">
          {point.fullLabel}
        </Text>
        <Text weight="semibold">{formatMoney(point.doanhThu)}</Text>
      </VStack>
    </Card>
  );
}

export function StatsPage() {
  const today = useMemo(() => todayDate(), []);
  const currentYear = today.getFullYear();
  const [mode, setMode] = useState<RangeMode>("month");
  const [dateRange, setDateRange] = useState<DateRange | null>(() => {
    const start = startOfWeek(todayDate());
    return { start: toIso(start), end: toIso(addDays(start, 6)) };
  });
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: currentYear - 2019 }, (_, index) => {
        const value = String(currentYear - index);
        return { value, label: value };
      }),
    [currentYear],
  );

  const selected = useMemo(() => {
    if (mode === "month") return monthBounds(year, month);
    return dateRange ? orderedRange(dateRange) : null;
  }, [mode, year, month, dateRange]);

  const dayCount = selected ? eachDay(selected.start, selected.end).length : 0;
  const rangeTooLong = dayCount > MAX_RANGE_DAYS;

  const load = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<RevenueStats>("get_revenue_stats", {
        startDate: start,
        endDate: end,
      });
      setStats(data);
    } catch (err) {
      setError(formatInvokeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected || rangeTooLong) return;
    void load(selected.start, selected.end);
  }, [selected, rangeTooLong, load]);

  const points = useMemo(
    () => (selected && !rangeTooLong && stats ? buildPoints(stats.ngay, selected.start, selected.end) : []),
    [selected, rangeTooLong, stats],
  );

  const isCurrentMonth =
    mode === "month" && year === currentYear && month === today.getMonth() + 1;
  const rangeCaption = !selected
    ? "Chọn khoảng ngày hoặc một tháng để xem doanh thu theo ngày."
    : mode === "month"
      ? `Tháng ${month}/${year}${isCurrentMonth ? ", gồm tháng hiện tại dù chưa kết thúc" : ""}.`
      : `Từ ${formatDayMonth(selected.start)}/${parseYmd(selected.start).getFullYear()} đến ${formatFullDate(selected.end).replace(/^[^,]+, /, "")}.`;

  const rangePresets = useMemo(() => {
    const weekStart = startOfWeek(today);
    const thisMonth = monthBounds(today.getFullYear(), today.getMonth() + 1);
    return [
      {
        label: "Tuần này",
        getRange: () => ({ start: toIso(weekStart), end: toIso(addDays(weekStart, 6)) }),
      },
      {
        label: "Tháng này",
        getRange: () => thisMonth,
      },
    ];
  }, [today]);

  return (
    <VStack gap={6} padding={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={2}>Thống kê</Heading>
          <Text color="secondary">Doanh thu đã thanh toán trong năm hiện tại.</Text>
        </VStack>
        <Button
          label="Làm mới"
          variant="secondary"
          icon={<Icon icon={RefreshCw} />}
          isLoading={loading}
          isDisabled={!selected || rangeTooLong}
          onClick={() => {
            if (selected && !rangeTooLong) void load(selected.start, selected.end);
          }}
        />
      </HStack>

      {error ? (
        <Banner status="error" title="Không tải được thống kê" description={error} collapsible={false} />
      ) : null}
      {rangeTooLong ? (
        <Banner
          status="warning"
          title="Khoảng ngày quá dài"
          description="Tối đa 93 ngày. Chọn Tháng hoặc thu hẹp khoảng ngày."
          collapsible={false}
        />
      ) : null}

      <Grid columns={{ minWidth: 280, max: 2, repeat: "fit" }} gap={4}>
        <Card>
          <VStack gap={2}>
            <Heading level={4}>Tổng doanh thu năm</Heading>
            <Heading level={2}>{formatMoney(stats?.tong_doanh_thu_nam ?? 0)}</Heading>
            <Text size="sm" color="secondary">
              Năm {stats?.nam ?? currentYear}. Đã gồm tháng hiện tại.
            </Text>
          </VStack>
        </Card>
        <Card>
          <VStack gap={2}>
            <Heading level={4}>Tổng doanh thu tiền giờ năm</Heading>
            <Heading level={2}>{formatMoney(stats?.tong_tien_gio_nam ?? 0)}</Heading>
            <Text size="sm" color="secondary">
              Tiền giờ của các hóa đơn đã thanh toán trong năm {stats?.nam ?? currentYear}.
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Card>
        <VStack gap={3}>
          <HStack hAlign="between" vAlign="end" wrap="wrap">
            <VStack gap={0.5}>
              <Heading level={3}>Doanh thu</Heading>
              <Text size="sm" color="secondary">
                {rangeCaption}
              </Text>
            </VStack>
            <HStack gap={2} vAlign="end" wrap="wrap">
              {mode === "range" ? (
                <DateRangeInput
                  label="Khoảng ngày"
                  value={dateRange}
                  onChange={setDateRange}
                  presets={rangePresets}
                  weekStartsOn={1}
                  numberOfMonths={2}
                  min={"2020-01-01" as ISODate}
                  placeholder="Chọn khoảng ngày"
                  width={280}
                />
              ) : (
                <HStack gap={2} vAlign="end">
                  <Selector
                    label="Tháng"
                    options={MONTH_OPTIONS}
                    value={String(month)}
                    onChange={(value) => {
                      const next = Number(value);
                      if (next >= 1 && next <= 12) setMonth(next);
                    }}
                    width={160}
                  />
                  <Selector
                    label="Năm"
                    options={yearOptions}
                    value={String(year)}
                    onChange={(value) => {
                      const next = Number(value);
                      if (Number.isFinite(next)) setYear(next);
                    }}
                    width={120}
                  />
                </HStack>
              )}
              <SegmentedControl
                label="Cách chọn thời gian"
                value={mode}
                onChange={(value) => {
                  if (value === "range" || value === "month") setMode(value);
                }}
              >
                <SegmentedControlItem value="range" label="Khoảng ngày" />
                <SegmentedControlItem value="month" label="Tháng" />
              </SegmentedControl>
            </HStack>
          </HStack>

          <VStack width="100%">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  interval={points.length > 16 ? 1 : 0}
                  tick={{
                    fontSize: "var(--font-size-sm, 12px)",
                    fill: "var(--color-text-secondary)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatAxisMoney}
                  width={64}
                  tick={{
                    fontSize: "var(--font-size-sm, 12px)",
                    fill: "var(--color-text-secondary)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "var(--color-background-wash)" }} />
                <Bar
                  dataKey="doanhThu"
                  name="Doanh thu"
                  fill="var(--color-data-categorical-blue)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}
