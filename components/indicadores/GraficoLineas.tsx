"use client";

import { useEffect, useRef, useState } from "react";
import { nombreMes } from "@/lib/finanzas/ingresos";

export interface LineaSerie {
  id: string;
  nombre: string;
  color: string;
  /** Un valor por mes (null si no hay dato). */
  valores: (number | null)[];
}

const mesCorto = (mes: string) => nombreMes(mes, true).replace(/^./, (c) => c.toUpperCase());

/**
 * Líneas por mes con cursor y tooltip. Se dibuja al ancho real del contenedor, así el texto de los
 * ejes no se agranda ni se achica. "referencia" dibuja una línea de base (0 o 100).
 */
export function GraficoLineas({
  meses,
  series,
  formatoEje,
  formatoValor,
  descripcion,
  referencia = 0,
  incluirReferencia = true,
  etiquetaMes,
}: {
  meses: string[];
  series: LineaSerie[];
  formatoEje: (v: number, paso: number) => string;
  formatoValor: (v: number) => string;
  descripcion: string;
  referencia?: number;
  incluirReferencia?: boolean;
  etiquetaMes?: (mes: string) => string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const valores = series.flatMap((s) => s.valores).filter((v): v is number => v != null);
  const minimo = Math.min(...(incluirReferencia ? [referencia] : []), ...valores);
  const maximo = Math.max(...(incluirReferencia ? [referencia] : []), ...valores, minimo + 1e-9);
  const paso = (() => {
    const bruto = (maximo - minimo) / 4 || 1;
    const p = 10 ** Math.floor(Math.log10(bruto));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= bruto)!;
  })();
  const tope = Math.ceil(maximo / paso) * paso;
  const piso = Math.floor(minimo / paso) * paso;
  const marcas: number[] = [];
  for (let v = piso; v <= tope + paso / 2; v += paso) marcas.push(Number(v.toFixed(10)));

  const H = W < 500 ? 220 : 280;
  const izq = 56;
  const der = 12;
  const arriba = 12;
  const abajo = 28;
  const x = (i: number) => izq + (meses.length <= 1 ? 0 : (i / (meses.length - 1)) * (W - izq - der));
  const y = (v: number) => arriba + (1 - (v - piso) / (tope - piso || 1)) * (H - arriba - abajo);
  const cada = Math.ceil(meses.length / Math.max(3, Math.floor((W - izq) / 80)));

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || meses.length < 2) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - izq) / (W - izq - der)) * (meses.length - 1));
    setActivo(Math.max(0, Math.min(meses.length - 1, i)));
  };

  return (
    <div className="cac__grafico" ref={caja}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={descripcion} onPointerMove={mover} onPointerLeave={() => setActivo(null)}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={izq} x2={W - der} y1={y(v)} y2={y(v)} className="cac__grilla" />
            <text x={izq - 8} y={y(v)} className="cac__eje" textAnchor="end" dominantBaseline="middle">
              {formatoEje(v, paso)}
            </text>
          </g>
        ))}
        {incluirReferencia && <line x1={izq} x2={W - der} y1={y(referencia)} y2={y(referencia)} className="cac__cero" />}
        {meses.map((mes, i) =>
          (i % cada === 0 && meses.length - 1 - i >= Math.max(1, cada * 0.7)) || i === meses.length - 1 ? (
            <text key={mes} x={x(i)} y={H - 8} className="cac__eje" textAnchor={i === meses.length - 1 ? "end" : "middle"}>
              {mesCorto(mes)}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          // Cortes donde falta el dato: un tramo por cada racha de meses con valor.
          const tramos: string[][] = [[]];
          s.valores.forEach((v, i) => (v == null ? tramos.push([]) : tramos.at(-1)!.push(`${x(i)},${y(v)}`)));
          return tramos
            .filter((t) => t.length > 1)
            .map((t, k) => (
              <polyline key={`${s.id}-${k}`} points={t.join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ));
        })}
        {activo != null && (
          <g>
            <line x1={x(activo)} x2={x(activo)} y1={arriba} y2={H - abajo} className="cac__cursor" />
            {series.map((s) => {
              const v = s.valores[activo];
              return v == null ? null : <circle key={s.id} cx={x(activo)} cy={y(v)} r={4.5} fill={s.color} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
            })}
          </g>
        )}
      </svg>
      {activo != null && (
        <div className="tooltip cac__tooltip" style={{ left: `${(x(activo) / W) * 100}%`, transform: activo > meses.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }} role="tooltip">
          <strong>{etiquetaMes ? etiquetaMes(meses[activo]) : nombreMes(meses[activo])}</strong>
          {series.map((s) => (
            <span key={s.id}>
              <i className="leyenda__marca" style={{ background: s.color }} /> {s.nombre}: {s.valores[activo] == null ? "sin dato" : formatoValor(s.valores[activo]!)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
