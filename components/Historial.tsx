"use client";

import { useState } from "react";
import { comprobante, contraparte, type ItemCola } from "@/lib/cola/item";
import { fechaHora, importe } from "./formato";
import { CATEGORIAS_VISTA, coincideBusqueda } from "./cola-vista";
import { Icono } from "./Icono";

export function Historial({ items }: { items: ItemCola[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const visibles = items.filter(
    (i) => coincideBusqueda(i, busqueda) && (!estado || i.estado === estado),
  );
  return (
    <>
      <div className="seccion-titulo">
        <div>
          <h2>Historial de comprobantes</h2>
          <p>
            Consultá las cargas aprobadas y los archivos descartados. Se
            muestran los últimos 100 resueltos.
          </p>
        </div>
        <span className="paso-etiqueta">Trazabilidad de cada carga</span>
      </div>
      {items.length === 0 ? (
        <div className="card estado-vacio">
          <Icono nombre="historial" size={28} />
          <h3>Tu historial empieza con la primera revisión</h3>
          <p>
            Cuando apruebes o descartes un comprobante, vas a encontrar acá el
            resultado y su archivo.
          </p>
        </div>
      ) : (
        <>
          <div className="herramientas-cola">
            <label className="buscador">
              <Icono nombre="buscar" size={18} />
              <input
                aria-label="Buscar en el historial"
                placeholder="Buscar proveedor, número o archivo…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <label className="campo campo--filtro">
              <span className="sr-only">Estado del historial</span>
              <select
                aria-label="Estado del historial"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="aprobada">Aprobados</option>
                <option value="descartada">Descartados</option>
              </select>
            </label>
            <span className="contador-resultados" role="status">
              {visibles.length}{" "}
              {visibles.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>
          {visibles.length === 0 ? (
            <div className="card estado-vacio">
              <Icono nombre="buscar" size={26} />
              <h3>No hay coincidencias</h3>
              <p>Probá con otra búsqueda o estado.</p>
              <button
                type="button"
                className="btn btn--borde"
                onClick={() => {
                  setBusqueda("");
                  setEstado("");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="card tabla-contenedor">
              <table className="tabla">
                <caption className="sr-only">
                  Comprobantes resueltos, del más reciente al más antiguo
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Comprobante</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="tabla__numero">
                      Total
                    </th>
                    <th scope="col">Registro</th>
                    <th scope="col">Resuelto por</th>
                    <th scope="col">Archivo</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((i) => {
                    const f = i.lectura?.factura;
                    const total =
                      f?.tipo_comprobante === "nota_credito"
                        ? -Math.abs(f.total)
                        : f?.total;
                    return (
                      <tr key={i.id}>
                        <td data-etiqueta="Comprobante">
                          <div>
                            <strong>
                              {f ? contraparte(f) : i.archivo.nombre}
                            </strong>
                            <span className="tabla__sub">
                              {f ? comprobante(f) : i.archivo.nombre}
                            </span>
                            {f && (
                              <span className="tabla__sub">
                                {CATEGORIAS_VISTA[f.categoria]} ·{" "}
                                {i.origen === "telegram" ? "Telegram" : "Web"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-etiqueta="Estado">
                          <span
                            className={`estado estado--${i.estado === "aprobada" ? "guardada" : "neutro"}`}
                          >
                            <Icono
                              nombre={
                                i.estado === "aprobada" ? "check" : "papelera"
                              }
                              size={13}
                            />
                            {i.estado === "aprobada"
                              ? "Aprobado"
                              : "Descartado"}
                          </span>
                        </td>
                        <td data-etiqueta="Total" className="tabla__numero">
                          {f ? importe(total, f.moneda) : "—"}
                        </td>
                        <td data-etiqueta="Registro">
                          <div>
                            {i.resultado ? (
                              <>
                                <strong>
                                  {f?.categoria === "venta"
                                    ? "Ingresos"
                                    : "Egresos"}
                                  {i.resultado.fila
                                    ? ` · fila ${i.resultado.fila}`
                                    : ""}
                                </strong>
                                <span className="tabla__sub">
                                  {fechaHora(i.resuelta)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>Sin carga contable</span>
                                <span className="tabla__sub">
                                  {fechaHora(i.resuelta)}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td data-etiqueta="Resuelto por">
                          <span className="tabla__email">
                            {i.resueltaPor || "—"}
                          </span>
                        </td>
                        <td data-etiqueta="Archivo">
                          {i.estado === "aprobada" ? (
                            <a
                              className="enlace-archivo"
                              href={i.archivo.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver en Drive <Icono nombre="externo" size={14} />
                            </a>
                          ) : (
                            <span className="tabla__sub">En papelera</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
