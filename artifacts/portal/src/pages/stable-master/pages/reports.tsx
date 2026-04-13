import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
import { DollarSign, TrendingUp, Zap, Users, Heart, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

function formatMonthLabel(month: string) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return `${day}${suffix} ${date.toLocaleString("en-US", { month: "long", year: "numeric" })}`;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function generateMonthOptions() {
  const months: string[] = [];
  const now = new Date();
  for (let i = 12; i >= -12; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatCurrency(value: number) {
  return `AED ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatK(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

interface StyledTableProps {
  title: string;
  columns: { key: string; label: string; align?: string }[];
  groups: any[];
  loading: boolean;
  emptyMessage: string;
  testId: string;
}

function StyledTable({ title, columns, groups, loading, emptyMessage, testId }: StyledTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-testid={testId}>
              <thead>
                <tr>
                  <th className="text-center py-3 px-4 font-bold text-white" style={{ backgroundColor: "#4CAF50", width: "50px" }}>#</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`py-3 px-4 font-bold text-white ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                      style={{ backgroundColor: "#4CAF50" }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group: any, gIdx: number) => (
                  <tr
                    key={gIdx}
                    className="border-b border-green-100"
                    style={{ backgroundColor: gIdx % 2 === 0 ? "#f0f9f0" : "#e8f5e8" }}
                    data-testid={`${testId}-row-${gIdx}`}
                  >
                    <td
                      className="py-4 px-4 text-center font-bold text-white text-lg"
                      style={{ backgroundColor: "#66BB6A" }}
                    >
                      {gIdx + 1}
                    </td>
                    {columns.map((col) => {
                      const cellValue = group[col.key];
                      const isArray = Array.isArray(cellValue);
                      return (
                        <td
                          key={col.key}
                          className={`py-4 px-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.key === columns[0].key ? "font-semibold" : ""}`}
                        >
                          {isArray ? (
                            <div className="space-y-1">
                              {cellValue.map((v: string, i: number) => (
                                <div key={i}>{v}</div>
                              ))}
                            </div>
                          ) : (
                            cellValue
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [chartGroupBy, setChartGroupBy] = useState("month");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const chartMonthRef = useRef<HTMLDivElement>(null);
  const chartCustomerRef = useRef<HTMLDivElement>(null);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const { data: kpis, isLoading: loadingKpis } = useQuery<any>({
    queryKey: ["/api/sm2/reports/kpis", `?month=${selectedMonth}`],
  });

  const { data: chartDataMonth = [], isLoading: loadingChartMonth } = useQuery<any[]>({
    queryKey: ["/api/sm2/reports/livery", "?groupBy=month"],
  });

  const { data: chartDataCustomer = [], isLoading: loadingChartCustomer } = useQuery<any[]>({
    queryKey: ["/api/sm2/reports/livery", `?groupBy=customer&month=${selectedMonth}`],
  });

  const { data: newLiveryData = [], isLoading: loadingNew } = useQuery<any[]>({
    queryKey: ["/api/sm2/reports/new-livery-horses", `?month=${selectedMonth}`],
  });

  const { data: departedData = [], isLoading: loadingDeparted } = useQuery<any[]>({
    queryKey: ["/api/sm2/reports/departed-livery-horses", `?month=${selectedMonth}`],
  });

  const { data: allCustomersData = [], isLoading: loadingAllCustomers } = useQuery<any[]>({
    queryKey: ["/api/sm2/reports/all-customers"],
  });

  const formattedChartMonth = useMemo(() => {
    return chartDataMonth.map((d: any) => ({
      ...d,
      label: formatMonthLabel(d.label),
    }));
  }, [chartDataMonth]);

  const formatRows = (data: any[]) => data.map((row: any) => ({
    customerName: row.customerName,
    boxName: row.boxName || "-",
    horseName: row.horseName || "-",
    arrivalDate: formatDate(row.arrivalDate),
    departureDate: row.departureDate ? formatDate(row.departureDate) : "-",
    monthlyAmount: row.monthlyAmount || "-",
  }));

  const arrivalGroups = useMemo(() => formatRows(newLiveryData), [newLiveryData]);

  const departureGroups = useMemo(() => formatRows(departedData), [departedData]);

  const allCustomerGroups = useMemo(() => formatRows(allCustomersData), [allCustomersData]);

  const tableColumns = [
    { key: "customerName", label: "Livery Customer" },
    { key: "boxName", label: "Box Name" },
    { key: "horseName", label: "Horse Name" },
    { key: "arrivalDate", label: "Arrival Date" },
    { key: "departureDate", label: "Departure Date" },
    { key: "monthlyAmount", label: "Livery Package (Monthly)", align: "right" },
  ];

  const kpiCards = [
    { title: "Total Revenue", value: kpis ? formatCurrency(kpis.totalRevenue) : "-", icon: DollarSign, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" },
    { title: "Livery Revenue", value: kpis ? formatCurrency(kpis.liveryRevenue) : "-", icon: TrendingUp, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
    { title: "Adhoc Revenue", value: kpis ? formatCurrency(kpis.adhocRevenue) : "-", icon: Zap, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30" },
    { title: "Livery Horses", value: kpis ? String(kpis.liveryHorses) : "-", icon: Heart, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
    { title: "Livery Customers", value: kpis ? String(kpis.liveryCustomers) : "-", icon: Users, color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950/30" },
  ];

  const downloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const monthLabel = formatMonthLabel(selectedMonth);

      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(128);
        pdf.text(`Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pw / 2, ph - 5, { align: "center" });
        pdf.setTextColor(0);
      };

      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Livery Report", pw / 2, 20, { align: "center" });
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(76, 175, 80);
      pdf.text(monthLabel, pw / 2, 30, { align: "center" });
      pdf.setTextColor(0);

      const kpiY = 45;
      const kpiW = (pw - 60) / 5;
      const kpiLabels = ["Total Revenue", "Livery Revenue", "Adhoc Revenue", "Livery Horses", "Livery Customers"];
      const kpiValues = kpis ? [
        formatCurrency(kpis.totalRevenue),
        formatCurrency(kpis.liveryRevenue),
        formatCurrency(kpis.adhocRevenue),
        String(kpis.liveryHorses),
        String(kpis.liveryCustomers),
      ] : ["-", "-", "-", "-", "-"];

      for (let i = 0; i < 5; i++) {
        const x = 15 + i * (kpiW + 7.5);
        pdf.setFillColor(240, 249, 240);
        pdf.roundedRect(x, kpiY, kpiW, 30, 3, 3, "F");
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(kpiLabels[i], x + kpiW / 2, kpiY + 10, { align: "center" });
        pdf.setFontSize(13);
        pdf.setTextColor(0);
        pdf.setFont("helvetica", "bold");
        pdf.text(kpiValues[i], x + kpiW / 2, kpiY + 22, { align: "center" });
        pdf.setFont("helvetica", "normal");
      }
      addFooter();

      const captureChart = async (ref: React.RefObject<HTMLDivElement | null>) => {
        if (!ref.current) return null;
        const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        return canvas.toDataURL("image/png");
      };

      const monthChartImg = await captureChart(chartMonthRef);
      if (monthChartImg) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Revenue Breakdown — Per Month", pw / 2, 18, { align: "center" });
        const imgW = pw - 30;
        const imgH = Math.min((imgW * 0.55), ph - 40);
        pdf.addImage(monthChartImg, "PNG", 15, 25, imgW, imgH);
        addFooter();
      }

      const customerChartImg = await captureChart(chartCustomerRef);
      if (customerChartImg) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Revenue Breakdown — Per Customer (${monthLabel})`, pw / 2, 18, { align: "center" });
        const imgW = pw - 30;
        const imgH = Math.min((imgW * 0.55), ph - 40);
        pdf.addImage(customerChartImg, "PNG", 15, 25, imgW, imgH);
        addFooter();
      }

      const headStyle = { fillColor: [76, 175, 80] as [number, number, number], textColor: 255 as number, fontStyle: "bold" as const, fontSize: 9 };
      const altRow = { fillColor: [232, 245, 232] as [number, number, number] };
      const tblMargin = { left: 15, right: 15 };
      const tblHead = [["#", "Livery Customer", "Box Name", "Horse Name", "Arrival Date", "Departure Date", "Livery Package (Monthly)"]];

      const buildTableRows = (groups: any[]) => {
        return groups.map((g, idx) => [
          String(idx + 1),
          g.customerName,
          g.boxName,
          g.horseName,
          g.arrivalDate,
          g.departureDate,
          g.monthlyAmount,
        ]);
      };

      if (arrivalGroups.length > 0) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Livery Customers Arrival — ${monthLabel}`, pw / 2, 18, { align: "center" });
        autoTable(pdf, { startY: 24, head: tblHead, body: buildTableRows(arrivalGroups), headStyles: headStyle, alternateRowStyles: altRow, margin: tblMargin, columnStyles: { 0: { cellWidth: 12, halign: "center" }, 6: { halign: "right" } } });
        addFooter();
      }

      if (departureGroups.length > 0) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Livery Customers Departure — ${monthLabel}`, pw / 2, 18, { align: "center" });
        autoTable(pdf, { startY: 24, head: tblHead, body: buildTableRows(departureGroups), headStyles: headStyle, alternateRowStyles: altRow, margin: tblMargin, columnStyles: { 0: { cellWidth: 12, halign: "center" }, 6: { halign: "right" } } });
        addFooter();
      }

      if (allCustomerGroups.length > 0) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("List of All Customers", pw / 2, 18, { align: "center" });
        autoTable(pdf, { startY: 24, head: tblHead, body: buildTableRows(allCustomerGroups), headStyles: headStyle, alternateRowStyles: altRow, margin: tblMargin, columnStyles: { 0: { cellWidth: 12, halign: "center" }, 6: { halign: "right" } } });
        addFooter();
      }

      pdf.save(`livery-report-${selectedMonth}.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  }, [selectedMonth, kpis, arrivalGroups, departureGroups, allCustomerGroups]);

  const activeChartData = chartGroupBy === "month" ? formattedChartMonth : chartDataCustomer;
  const activeChartLoading = chartGroupBy === "month" ? loadingChartMonth : loadingChartCustomer;

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Reports"
        description="Key metrics, revenue analysis, and customer details"
        actions={
          <Button
            variant="outline"
            onClick={downloadPdf}
            disabled={downloadingPdf || loadingKpis}
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadingPdf ? "Generating..." : "Download to PDF"}
          </Button>
        }
      />

      {/* Month Filter */}
      <div className="flex items-end gap-4">
        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">Month</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-56" data-testid="select-report-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="kpi-cards">
        {kpiCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.title}</span>
                <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold" data-testid={`kpi-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                {loadingKpis ? "..." : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Breakdown Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Revenue Breakdown
              {chartGroupBy === "customer" && (
                <span className="ml-2 text-green-600 font-normal text-base">for {formatMonthLabel(selectedMonth)}</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">View by</Label>
              <Select value={chartGroupBy} onValueChange={setChartGroupBy}>
                <SelectTrigger className="w-36" data-testid="select-chart-groupby">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Per Month</SelectItem>
                  <SelectItem value="customer">Per Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeChartLoading ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">Loading chart data...</div>
          ) : activeChartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">No revenue data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={activeChartData} margin={{ top: 20, right: 30, left: 20, bottom: chartGroupBy === "customer" ? 80 : 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  angle={chartGroupBy === "customer" ? -45 : 0}
                  textAnchor={chartGroupBy === "customer" ? "end" : "middle"}
                  interval={0}
                  height={chartGroupBy === "customer" ? 100 : 30}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatK(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{
                    borderRadius: "6px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                  }}
                />
                <Legend />
                <Bar dataKey="liveryRevenue" name="Livery Revenue" stackId="revenue" fill="hsl(197, 84%, 42%)">
                  <LabelList dataKey="liveryRevenue" position="inside" fill="#fff" fontSize={10} formatter={(v: number) => v > 0 ? formatK(v) : ""} />
                </Bar>
                <Bar dataKey="adhocRevenue" name="Adhoc Revenue" stackId="revenue" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="adhocRevenue" position="inside" fill="#fff" fontSize={10} formatter={(v: number) => v > 0 ? formatK(v) : ""} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Hidden charts for PDF capture */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={chartMonthRef} style={{ width: 1100, height: 500, backgroundColor: "#fff", padding: 20 }}>
          {formattedChartMonth.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedChartMonth} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatK(v)} />
                <Legend />
                <Bar dataKey="liveryRevenue" name="Livery Revenue" stackId="revenue" fill="hsl(197, 84%, 42%)">
                  <LabelList dataKey="liveryRevenue" position="inside" fill="#fff" fontSize={10} formatter={(v: number) => v > 0 ? formatK(v) : ""} />
                </Bar>
                <Bar dataKey="adhocRevenue" name="Adhoc Revenue" stackId="revenue" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="adhocRevenue" position="inside" fill="#fff" fontSize={10} formatter={(v: number) => v > 0 ? formatK(v) : ""} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div ref={chartCustomerRef} style={{ width: 1100, height: 500, backgroundColor: "#fff", padding: 20 }}>
          {chartDataCustomer.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataCustomer} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} height={100} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatK(v)} />
                <Legend />
                <Bar dataKey="liveryRevenue" name="Livery Revenue" stackId="revenue" fill="hsl(197, 84%, 42%)">
                  <LabelList dataKey="liveryRevenue" position="inside" fill="#fff" fontSize={9} formatter={(v: number) => v > 0 ? formatK(v) : ""} />
                </Bar>
                <Bar dataKey="adhocRevenue" name="Adhoc Revenue" stackId="revenue" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="adhocRevenue" position="inside" fill="#fff" fontSize={9} formatter={(v: number) => v > 0 ? formatK(v) : ""} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Lists */}
      <div className="space-y-6">
        <StyledTable
          title={`Livery Customers Arrival — ${formatMonthLabel(selectedMonth)}`}
          columns={tableColumns}
          groups={arrivalGroups}
          loading={loadingNew}
          emptyMessage="No new arrivals this month"
          testId="table-arrivals"
        />

        <StyledTable
          title={`Livery Customers Departure — ${formatMonthLabel(selectedMonth)}`}
          columns={tableColumns}
          groups={departureGroups}
          loading={loadingDeparted}
          emptyMessage="No departures this month"
          testId="table-departures"
        />

        <StyledTable
          title="List of All Customers"
          columns={tableColumns}
          groups={allCustomerGroups}
          loading={loadingAllCustomers}
          emptyMessage="No active customers with agreements"
          testId="table-all-customers"
        />
      </div>
    </div>
  );
}
