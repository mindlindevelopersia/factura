"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calcularHonorarios, costoM2 as costoM2De, costoTotal, type DatosHonorarios, type Escenario } from "@/lib/proyectos/honorarios";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { m2, pct, useProyectoId, usd } from "./datos";
import { Origen } from "./Origen";

interface Respuesta {
  datos: DatosHonorarios;
  vendidas: { codigo: string; inversor: string; precioUsd: number; contrato: boolean }[];
  costoProyectadoOriginalUsd: number;
  fuenteCosto: "presupuesto" | "cash-flow";
  mesActual: string;
  avisos: string[];
}

const NOMBRE_GRUPO: Record<string, string> = {
  terreno: "Terreno",
  hard: "Costo hard",
  soft: "Costo soft",
  impuestos: "Impuestos y gastos",
  obra: "Obra",
  equipamiento: "Equipamiento y ascensores",
  honorarios: "Honorarios y gestiones",
  otros: "Impuestos, seguros y otros",
  iva: "IVA e ingresos brutos",
  "sin-clasificar": "Sin clasificar",
};

const numero = (t: string) => Number(t.replace(/\./g, "").replace(",", ".")) || null;

/**
 * Los honorarios de los desarrolladores: el 15% de lo que ingresa por boleto, y cuántos m² son si
 * se canjean al costo. Con el control de que la obra se termine con el 85% y un simulador para
 * separar unidades.
 */
export function Honorarios() {
  const id = useProyectoId();
  const [r, setR] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costoTexto, setCostoTexto] = useState("");
  const [ventaTexto, setVentaTexto] = useState("");
  const [separadas, setSeparadas] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    try {
      setR(await leerJson<Respuesta>(await fetch(`/api/proyectos/${id}/honorarios`)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const h = useMemo(() => (r ? calcularHonorarios(r.datos, { costoM2: numero(costoTexto), precioVentaM2: numero(ventaTexto), separadas }) : null), [r, costoTexto, ventaTexto, separadas]);

  if (error) return <p className="alerta alerta--error">Honorarios: {error}</p>;
  if (!r || !h) return <p className="ficha__nota">Calculando los honorarios…</p>;
  const d = r.datos;
  const costoCalculado = costoM2De(d);
  const porGrupo = Object.entries(d.costos.reduce<Record<string, number>>((acc, p) => ((acc[p.grupo] = (acc[p.grupo] ?? 0) + p.usd), acc), {})).sort((a, b) => b[1] - a[1]);
  const parte = pct(d.parte);

  const cifra = (titulo: string, nota: string, e: Escenario, destacada = false) => (
    <div key={titulo} className={`cifra${destacada ? " cifra--destacada" : ""}`}>
      <span className="cifra__titulo">{titulo}</span>
      <span className="cifra__valor">{usd(e.honorariosUsd)}</span>
      <span className="cifra__nota">
        {parte} de {usd(e.ingresosUsd)} · {nota}
      </span>
      <span className="honorarios__m2">
        = <strong>{m2(e.m2, 1)}</strong> al costo · vendidos a {usd(h.precioVentaM2)}/m² valen <strong>{usd(e.valorVentaUsd)}</strong>
      </span>
    </div>
  );

  return (
    <section className="honorarios" aria-label="Honorarios de los desarrolladores">
      <div className="honorarios__cabeza">
        <h2>Honorarios: {parte} de lo que ingresa</h2>
        <p className="cobranzas__nota">
          De todo lo que pagan los compradores, el {parte} es de los desarrolladores (el precio ya lo incluye) y la obra se termina con el resto. Se puede cobrar en plata o canjear por m² <strong>al costo</strong>: así, al venderlos a precio de mercado, se gana la diferencia. Todo en dólares (MEP del día de cada pago). Hasta hoy no se cobró nada de honorarios.
        </p>
      </div>

      <div className="ingresos__cifras">
        {cifra("Ya ganado (lo que entró)", "cobrado a hoy", h.hoy, true)}
        {cifra("Por lo vendido", `firmado en ${r.vendidas.length} boletos`, h.firmado)}
        {cifra("Al final (si se vende lo que queda a lista)", `más ${d.libres.length} unidades libres`, h.total)}
      </div>

      <section className="card ingresos__filtros honorarios__valores" aria-label="Valores del m²">
        <div className="ingresos__campos">
          <label className="campo campo--filtro">
            Costo del m² para el canje (US$)
            <input inputMode="decimal" value={costoTexto} placeholder={String(Math.round(costoCalculado))} onChange={(e) => setCostoTexto(e.target.value)} />
            <small>
              Calculado: {usd(costoCalculado)} = {usd(costoTotal(d))} ÷ {m2(d.m2Venta)}
            </small>
          </label>
          <label className="campo campo--filtro">
            Precio de venta del m² (US$)
            <input inputMode="decimal" value={ventaTexto} placeholder={String(Math.round(h.precioVentaM2))} onChange={(e) => setVentaTexto(e.target.value)} />
            <small>Por defecto: el de lista de lo que queda sin vender</small>
          </label>
        </div>
        <p className="honorarios__comparar">
          <Icono nombre="ayuda" size={14} />
          <span>
            No es lo mismo que el {parte} de los m²: eso da <strong>{m2(h.m2ParteDeLosMetros, 1)}</strong> ({parte} de {m2(d.m2Venta)} vendibles). El canje a costo de todo da <strong>{m2(h.total.m2, 1)}</strong>; la diferencia sale de que los compradores no pagan todos lo mismo por m² ni lo mismo que el costo.
          </span>
        </p>
      </section>

      <div className="honorarios__dos">
        <section className="card ingresos__seccion">
          <h3>¿Alcanza el {pct(1 - d.parte)} para la obra?</h3>
          <dl className="honorarios__control">
            <div>
              <dt>Hasta hoy</dt>
              <dd>
                {pct(1 - d.parte)} de lo cobrado: {usd(h.obraHoy.paraLaObraUsd)} · gastado: {usd(h.obraHoy.gastadoUsd)}
                <strong className={h.obraHoy.sobraUsd < 0 ? "honorarios--mal" : "honorarios--bien"}>
                  {h.obraHoy.sobraUsd < 0 ? ` La obra usó ${usd(-h.obraHoy.sobraUsd)} de los honorarios.` : ` Sobran ${usd(h.obraHoy.sobraUsd)}.`}
                </strong>
              </dd>
            </div>
            <div>
              <dt>Al final</dt>
              <dd>
                {pct(1 - d.parte)} de {usd(h.obra.ingresosUsd)}: {usd(h.obra.paraLaObraUsd)} · costo total: {usd(h.obra.costoUsd)}
                <strong className={h.obra.sobraUsd < 0 ? "honorarios--mal" : "honorarios--bien"}>
                  {h.obra.sobraUsd < 0 ? ` Faltan ${usd(-h.obra.sobraUsd)}: o sube el costo para los compradores o salen de los honorarios.` : ` Sobran ${usd(h.obra.sobraUsd)}.`}
                </strong>
              </dd>
            </div>
          </dl>
          <Origen
            texto={
              r.fuenteCosto === "presupuesto"
                ? "Ingresos: lo firmado en los boletos más las unidades libres a precio de lista. Costo: el presupuesto de obra (Finanzas → Presupuesto): lo pagado más lo que falta de cada ítem."
                : `Ingresos: lo firmado en los boletos más las unidades libres a precio de lista. Costo: el cash flow "actualizado" (lo real hasta ${r.mesActual} y lo proyectado del Excel madre de ahí en más), porque todavía no hay presupuesto cargado. El Excel madre solo daba ${usd(r.costoProyectadoOriginalUsd)}.`
            }
          />
        </section>

        <section className="card ingresos__seccion">
          <h3>De dónde sale el costo del m²</h3>
          <p className="ficha__nota">
            {r.fuenteCosto === "presupuesto" ? "Del presupuesto de obra (pagado + lo que falta)." : "Del cash flow del Excel madre: cargá el presupuesto en Finanzas → Presupuesto para que sea real."}
          </p>
          <table className="tabla tabla--compacta">
            <tbody>
              {porGrupo.map(([g, v]) => (
                <tr key={g}>
                  <td>{NOMBRE_GRUPO[g] ?? g}</td>
                  <td className="tabla__numero">{usd(v)}</td>
                </tr>
              ))}
              <tr className="tabla__total">
                <td>Costo total (con terreno)</td>
                <td className="tabla__numero">{usd(costoTotal(d))}</td>
              </tr>
              <tr>
                <td>÷ m² vendibles (sin amenities)</td>
                <td className="tabla__numero">{m2(d.m2Venta)}</td>
              </tr>
              <tr className="tabla__total">
                <td>Costo del m²</td>
                <td className="tabla__numero">{usd(costoCalculado)}</td>
              </tr>
            </tbody>
          </table>
          {d.excluidos.length > 0 && (
            <p className="ficha__nota">
              No cuentan como costo: {d.excluidos.map((x) => `${x.nombre} (${usd(x.usd)})`).join(", ")}.
            </p>
          )}
        </section>
      </div>

      <section className="card ingresos__seccion">
        <h3>Separar unidades</h3>
        <p className="ficha__nota">Elegí las unidades libres que se quedarían los desarrolladores: se valúan al costo y se comparan con los honorarios del final.</p>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th></th>
                <th>Unidad</th>
                <th className="tabla__numero">m²</th>
                <th className="tabla__numero">Al costo</th>
                <th className="tabla__numero">A lista</th>
                <th className="tabla__numero">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {d.libres.map((u) => {
                const sel = separadas.includes(u.codigo);
                return (
                  <tr key={u.codigo} className={sel ? "honorarios__elegida" : undefined}>
                    <td>
                      <input type="checkbox" checked={sel} onChange={() => setSeparadas((l) => (sel ? l.filter((x) => x !== u.codigo) : [...l, u.codigo]))} aria-label={`Separar ${u.codigo}`} />
                    </td>
                    <td data-etiqueta="Unidad">
                      <strong>{u.codigo}</strong> <span className="tabla__sub">{u.tipologia}</span>
                    </td>
                    <td data-etiqueta="m²" className="tabla__numero">
                      {m2(u.m2, 1)}
                    </td>
                    <td data-etiqueta="Al costo" className="tabla__numero">
                      {usd(u.m2 * h.costoM2)}
                    </td>
                    <td data-etiqueta="A lista" className="tabla__numero">
                      {usd(u.precioUsd)}
                    </td>
                    <td data-etiqueta="Diferencia" className="tabla__numero">
                      {usd(u.precioUsd - u.m2 * h.costoM2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {h.separadas ? (
          <p className="honorarios__resumen">
            {h.separadas.codigos.join(", ")}: <strong>{m2(h.separadas.m2, 1)}</strong>, al costo <strong>{usd(h.separadas.valorCostoUsd)}</strong> = {pct(h.separadas.cubre)} de los honorarios del final ({usd(h.total.honorariosUsd)}).{" "}
            {h.separadas.diferenciaUsd >= 0 ? `Quedan ${usd(h.separadas.diferenciaUsd)} por cobrar (en plata u otros m²).` : `Se pasan por ${usd(-h.separadas.diferenciaUsd)}: habría que compensar.`} Vendidas a lista valen {usd(h.separadas.valorListaUsd)}: {usd(h.separadas.valorListaUsd - h.separadas.valorCostoUsd)} más que tomarlo en plata.
          </p>
        ) : (
          <p className="ficha__nota">Todavía no elegiste ninguna.</p>
        )}
      </section>

      <details className="card ingresos__seccion honorarios__detalle">
        <summary>Lo firmado, unidad por unidad ({r.vendidas.length})</summary>
        <table className="tabla tabla--compacta">
          <tbody>
            {r.vendidas.map((v) => (
              <tr key={v.codigo}>
                <td>
                  <strong>{v.codigo}</strong> <span className="tabla__sub" data-sensible="">{v.inversor}</span>
                  {v.contrato && <span className="tabla__sub">Pagada con obra</span>}
                </td>
                <td className="tabla__numero">{usd(v.precioUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {r.avisos.length > 0 && <p className="ficha__nota">{r.avisos.join(" ")}</p>}
    </section>
  );
}
