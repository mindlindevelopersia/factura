"use client";

import { useMemo, useState } from "react";
import { nombreMes } from "@/lib/finanzas/ingresos";
import { ANIOS_HISTORIA, TEXTO_SENAL, type AnalisisMaterial, type Medida, type Resumen } from "@/lib/indicadores/materiales";
import { Icono } from "../Icono";
import { BarraLectura } from "../finanzas/comun";
import { CLASE_SENAL, pctSigno, TEXTO_CORTO, usePanorama } from "./datos";
import { GraficoLineas } from "./GraficoLineas";
import { TarjetaAlarma } from "./Panorama";

/** Los 50 materiales de "Precios Medios" con su alarma de compra y la historia de cada uno. */
export function Materiales() {
  const { datos, error, cargando, actualizar } = usePanorama();
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState<Resumen | "todos">("todos");
  const [abierto, setAbierto] = useState<string | null>("142001");
  const lista = useMemo(() => {
    const q = buscar.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return (datos?.materiales ?? []).filter(
      (m) => (filtro === "todos" || m.resumen === filtro) && (!q || m.descripcion.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q)),
    );
  }, [datos, buscar, filtro]);
  const cuenta = (r: Resumen) => datos?.materiales.filter((m) => m.resumen === r).length ?? 0;
  const atraso = datos?.materiales[0]?.atraso ?? 0;

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {datos && (
        <>
          {atraso > 2 && (
            <p className="alerta alerta--aviso">
              <Icono nombre="alerta" size={18} />
              <span>
                Los precios llegan hasta {nombreMes(datos.materiales[0].ultimoMes).toLowerCase()}: las alarmas dicen cómo estaba cada material en ese momento. Hay que actualizar
                &quot;Precios Medios&quot; en la planilla de indicadores (o sumarlo a la carga automática de la Cámara).
              </span>
            </p>
          )}
          <p className="cobranzas__nota">
            Cada material se compara contra su propia historia de los últimos {ANIOS_HISTORIA} años, de dos maneras: <strong>con pesos ajustados por CAC</strong> (su precio llevado al
            último CAC, como cobran las cuotas) y <strong>en dólares blue</strong>. Barato: está entre el 25% más barato de su historia. Caro: entre el 25% más caro. Si las dos lecturas no
            coinciden, depende de con qué plata se compre.
          </p>
          <div className="panorama__alarmas">
            {datos.materiales
              .filter((m) => m.id === "142001" || m.id === "4001")
              .map((m) => (
                <TarjetaAlarma key={m.id} m={m} />
              ))}
          </div>

          <section className="card ingresos__seccion">
            <div className="ingresos__titulo cuentas__controles">
              <h2>Todos los materiales ({lista.length})</h2>
              <label className="campo campo--filtro">
                <span className="sr-only">Buscar material</span>
                <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar material" />
              </label>
              <div className="ingresos__atajos" role="group" aria-label="Filtrar por señal">
                {(["todos", "comprar", "depende", "normal", "esperar"] as const).map((r) => (
                  <button key={r} type="button" className={`btn btn--chico ${filtro === r ? "btn--primario" : "btn--borde"}`} aria-pressed={filtro === r} onClick={() => setFiltro(r)}>
                    {r === "todos" ? "Todos" : `${TEXTO_SENAL[r]} (${cuenta(r)})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="tabla__numero">Último precio</th>
                    <th>Con pesos (CAC)</th>
                    <th>En dólares blue</th>
                    <th>Señal</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((m) => (
                    <FilaMaterial key={m.id} m={m} abierto={abierto === m.id} alternar={() => setAbierto((a) => (a === m.id ? null : m.id))} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FilaMaterial({ m, abierto, alternar }: { m: AnalisisMaterial; abierto: boolean; alternar: () => void }) {
  const lectura = (medida: Medida | null, senal: AnalisisMaterial["senalPesos"]) =>
    medida && senal ? (
      <>
        <span className={`senal senal--chica ${CLASE_SENAL[senal]}`}>{TEXTO_CORTO[senal]}</span>
        <span className="tabla__sub">{pctSigno(medida.vsMediana, 0)} vs. lo habitual</span>
      </>
    ) : (
      "—"
    );
  return (
    <>
      <tr>
        <td data-etiqueta="Material">
          <button type="button" className="ingresos__enlace" onClick={alternar} aria-expanded={abierto}>
            {m.descripcion}
          </button>
          <span className="tabla__sub">Código {m.id}</span>
        </td>
        <td data-etiqueta="Último precio" className="tabla__numero">
          $ {m.precio.toLocaleString("es-AR", { maximumFractionDigits: 2 })} / {m.unidad}
          <span className="tabla__sub">{nombreMes(m.ultimoMes)}</span>
        </td>
        <td data-etiqueta="Con pesos (CAC)">{lectura(m.real, m.senalPesos)}</td>
        <td data-etiqueta="En dólares blue">{lectura(m.usd, m.senalDolares)}</td>
        <td data-etiqueta="Señal">{m.resumen ? <span className={`senal ${CLASE_SENAL[m.resumen]}`}>{TEXTO_SENAL[m.resumen]}</span> : "—"}</td>
      </tr>
      {abierto && (
        <tr className="material__detalle">
          <td colSpan={5}>
            <p className="alarma__motivo">{m.motivo}</p>
            <div className="material__graficos">
              {m.usd && <Historia titulo="En dólares blue" medida={m.usd} formato={(v) => `US$ ${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`} color="#1baf7a" />}
              {m.real && <Historia titulo={`A valores de hoy (por CAC)`} medida={m.real} formato={(v) => `$ ${Math.round(v).toLocaleString("es-AR")}`} color="#006dbb" />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Historia({ titulo, medida, formato, color }: { titulo: string; medida: Medida; formato: (v: number) => string; color: string }) {
  return (
    <figure className="material__grafico">
      <figcaption>
        <strong>{titulo}</strong>
        <span className="tabla__sub">
          Hoy {formato(medida.actual)} · lo habitual (mediana) {formato(medida.mediana)} · mínimo {formato(medida.minimo.valor)} ({nombreMes(medida.minimo.mes, true)}) · máximo{" "}
          {formato(medida.maximo.valor)} ({nombreMes(medida.maximo.mes, true)})
        </span>
      </figcaption>
      <GraficoLineas
        meses={medida.serie.map((p) => p.mes)}
        series={[{ id: titulo, nombre: titulo, color, valores: medida.serie.map((p) => p.valor) }]}
        formatoEje={(v) => (v >= 1000 ? `${Math.round(v / 1000).toLocaleString("es-AR")} mil` : v.toLocaleString("es-AR", { maximumFractionDigits: 0 }))}
        formatoValor={formato}
        descripcion={`${titulo}: la línea gris es lo habitual (mediana).`}
        referencia={medida.mediana}
      />
    </figure>
  );
}
