import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from './ChartCard'

interface AccountRow {
  cuentaNombre: string
  banco: string
  pagos: number
  monto: number
  aplicado: number
}

interface CollectorRow {
  cobrador: string
  pagos: number
  monto: number
  aplicado: number
}

interface DailyRow {
  fecha: string
  pagos: number
  monto: number
  aplicado: number
  diferenciaAjustes: number
}

interface NamedAmountRow {
  nombre: string
  monto: number
}

interface PaymentReportChartsProps {
  accounts: AccountRow[]
  collectors: CollectorRow[]
  daily: DailyRow[]
  developments: NamedAmountRow[]
  methods: NamedAmountRow[]
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

const tooltipCurrency = (value: number | string | undefined) =>
  typeof value === 'number' ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value) : value

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #ebebeb',
  boxShadow: 'var(--shadow-elevated)',
  fontSize: 12,
}

const parseReportDate = (value: string): Date | null => {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const AmountBars = ({ data, fill }: { data: NamedAmountRow[]; fill: string }) => (
  <div className="h-72 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 12, bottom: 4 }}>
        <CartesianGrid stroke="#ebebeb" horizontal={false} />
        <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 11, fill: '#343c40' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => tooltipCurrency(value as number)} />
        <Bar dataKey="monto" name="Cobrado" fill={fill} radius={[0, 4, 4, 0]} maxBarSize={28}>
          <LabelList dataKey="monto" position="right" formatter={(value) => compactCurrency(Number(value))} style={{ fontSize: 11, fill: '#343c40' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
)

export const PaymentReportCharts = ({ accounts, collectors, daily, developments, methods }: PaymentReportChartsProps) => {
  const dailyData = daily
    .filter((row) => row.fecha !== 'Sin fecha')
    .slice()
    .reverse()
    .map((row) => {
      const parsedDate = parseReportDate(row.fecha)
      return {
        ...row,
        label: parsedDate
          ? parsedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          : row.fecha,
      }
    })

  const accountData = accounts.map((row) => ({
    ...row,
    label: row.cuentaNombre.length > 20 ? `${row.cuentaNombre.slice(0, 20)}…` : row.cuentaNombre,
  }))
  const collectorData = collectors.map((row) => ({
    ...row,
    label: row.cobrador.length > 22 ? `${row.cobrador.slice(0, 22)}…` : row.cobrador,
  }))

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartCard title="Cobrado por desarrollo" subtitle="Inmobiliaria Ruiz y Valle de Flores, sin importar la unidad elegida">
        <AmountBars data={developments} fill="#142127" />
      </ChartCard>

      <ChartCard title="Cobrado por método de pago" subtitle="De la unidad elegida">
        <AmountBars data={methods} fill="#2563eb" />
      </ChartCard>

      <ChartCard
        title="Cobrado a lo largo del tiempo"
        subtitle="Comparación entre monto cobrado y aplicado"
        className="xl:col-span-2"
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid stroke="#ebebeb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} width={52} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => tooltipCurrency(value as number)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="monto" name="Cobrado" stroke="#142127" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="aplicado" name="Aplicado" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Cobrado por cuenta bancaria" subtitle="Distribución del monto cobrado">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accountData} layout="vertical" margin={{ top: 4, right: 16, left: 12, bottom: 4 }}>
              <CartesianGrid stroke="#ebebeb" horizontal={false} />
              <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={105} tick={{ fontSize: 11, fill: '#343c40' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => tooltipCurrency(value as number)} />
              <Bar dataKey="monto" name="Cobrado" fill="#142127" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Cobrado por cobrador" subtitle="Ranking por monto cobrado">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collectorData} layout="vertical" margin={{ top: 4, right: 16, left: 12, bottom: 4 }}>
              <CartesianGrid stroke="#ebebeb" horizontal={false} />
              <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={125} tick={{ fontSize: 11, fill: '#343c40' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => tooltipCurrency(value as number)} />
              <Bar dataKey="monto" name="Cobrado" fill="#2563eb" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Pagos por cuenta" subtitle="Cantidad de operaciones registradas">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={accountData} dataKey="pagos" nameKey="cuentaNombre" innerRadius={65} outerRadius={100} paddingAngle={3}>
                {accountData.map((row, index) => <Cell key={row.cuentaNombre} fill={['#142127', '#2563eb', '#6366f1', '#94a3b8'][index % 4]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value} pagos`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Diferencias de conciliación" subtitle="Ajustes entre lo cobrado y lo aplicado">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid stroke="#ebebeb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#787574' }} tickLine={false} axisLine={false} width={52} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => tooltipCurrency(value as number)} />
              <Bar dataKey="diferenciaAjustes" name="Ajustes" radius={[5, 5, 0, 0]}>
                {dailyData.map((row) => <Cell key={row.fecha} fill={row.diferenciaAjustes >= 0 ? '#16a34a' : '#f97316'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="xl:col-span-2 text-right text-xs text-[#787574]">
        Los gráficos respetan los filtros actuales. Los importes usan moneda MXN.
      </div>
    </div>
  )
}
