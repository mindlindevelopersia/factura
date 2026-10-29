"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { comprobante, contraparte, type ItemCola } from "@/lib/cola/item";
import type { Pendiente } from "@/lib/cola/servicio";
import { FichaRevision } from "./FichaRevision";
import { EstadoConfiguracion } from "./EstadoConfiguracion";
import { ErrorRespuesta, fechaHora, importe, leerJson } from "./formato";
import { Historial } from "./Historial";
import { Subir } from "./Subir";
import { TelegramPanel } from "./TelegramPanel";
import { Icono } from "./Icono";
import { CATEGORIAS_VISTA, esDuplicada, estadoVisible, filtrarCola, type FiltroCola } from "./cola-vista";

type Vista = "revisar" | "subir" | "historial";
type Datos = { pendientes: Pendiente[]; historial: ItemCola[] };
const REFRESCO_MS = 20_000;

export function Bandeja({ revisar }: { revisar?: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faltaConfigurar, setFaltaConfigurar] = useState(false);
  const [verEstado, setVerEstado] = useState(false);
  const [aviso, setAviso] = useState<{
    texto: string;
    historial: boolean;
    error?: boolean;
  } | null>(null);
  const [vista, setVista] = useState<Vista>("revisar");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroCola>("todos");
  const [categoria, setCategoria] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(revisar ?? null);
  const [enDetalle, setEnDetalle] = useState(!!revisar);
  const [subiendo, setSubiendo] = useState(0);
  const [actualizando, setActualizando] = useState(false);
  const ultimaPeticion = useRef(0);
  const montado = useRef(true);
  const ultimaSubida = useRef<string | null>(null);
  const detalleRef = useRef<HTMLDivElement>(null);
  const filaSeleccionadaRef = useRef<HTMLButtonElement>(null);

  const cargar = useCallback(async () => {
    const peticion = ++ultimaPeticion.current;
    setActualizando(true);
    try {
      const nuevos = await leerJson<Datos>(await fetch("/api/cola", { cache: "no-store" }));
      if (!montado.current || peticion !== ultimaPeticion.current) return;
      setDatos(nuevos);
      setError(null);
      setFaltaConfigurar(false);
    } catch (e) {
      if (!montado.current || peticion !== ultimaPeticion.current) return;
      setError((e as Error).message);
      setFaltaConfigurar(e instanceof ErrorRespuesta && e.status === 503);
    } finally {
      if (montado.current && peticion === ultimaPeticion.current) setActualizando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    void cargar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, REFRESCO_MS);
    return () => {
      montado.current = false;
      ++ultimaPeticion.current;
      clearInterval(intervalo);
    };
  }, [cargar]);

  useEffect(() => {
    if (revisar) {
      setSeleccion(revisar);
      setEnDetalle(true);
    }
  }, [revisar]);

  function cambiarVista(v: Vista) {
    setVista(v);
    setAviso(null);
  }
  function limpiarFiltros() {
    setBusqueda("");
    setFiltro("todos");
    setCategoria("");
  }
  function resuelto(texto: string, item: ItemCola) {
    // Una respuesta iniciada antes de la acción no debe restaurar una fila ya resuelta.
    ++ultimaPeticion.current;
    const terminado = item.estado === "aprobada" || item.estado === "descartada";
    setDatos((prev) =>
      prev
        ? {
            pendientes: !terminado
              ? prev.pendientes.map((p) => (p.id === item.id ? { ...p, ...item } : p))
              : prev.pendientes.filter((p) => p.id !== item.id),
            historial: !terminado
              ? prev.historial
              : [item, ...prev.historial.filter((p) => p.id !== item.id)].slice(0, 100),
          }
        : prev,
    );
    setAviso({ texto, historial: terminado, error: item.estado === "error" });
    void cargar();
  }

  const pendientes = datos?.pendientes ?? [];
  const visibles = filtrarCola(pendientes, busqueda, filtro, categoria);
  const actual = visibles.find((i) => i.id === seleccion) ?? visibles[0];
  const duplicadas = pendientes.filter(esDuplicada).length;
  const errores = pendientes.filter((i) => i.estado === "error").length;
  const leyendo = pendientes.filter((i) => i.estado === "leyendo").length;
  const porRevisar = pendientes.filter((i) => i.estado === "pendiente" && !esDuplicada(i)).length;
  const filtros: { valor: FiltroCola; texto: string; cantidad: number }[] = [
    { valor: "todos", texto: "Todos", cantidad: pendientes.length },
    { valor: "pendiente", texto: "Para revisar", cantidad: porRevisar },
    { valor: "duplicada", texto: "Duplicados", cantidad: duplicadas },
    { valor: "error", texto: "Con error", cantidad: errores },
    { valor: "leyendo", texto: "Leyendo", cantidad: leyendo },
  ];

  return (
    <div className={`bandeja${vista === "revisar" && enDetalle && actual ? " bandeja--revisando" : ""}`}>
      <div className="resumen-operativo" aria-label="Resumen de comprobantes">
        <div className="resumen-operativo__item">
          <span className="resumen-operativo__icono">
            <Icono nombre="bandeja" />
          </span>
          <div>
            <strong>{datos ? porRevisar : "—"}</strong>
            <span>Para revisar</span>
          </div>
        </div>
        <div className="resumen-operativo__item">
          <span className="resumen-operativo__icono resumen-operativo__icono--aviso">
            <Icono nombre="alerta" />
          </span>
          <div>
            <strong>{datos ? duplicadas : "—"}</strong>
            <span>Posibles duplicados</span>
          </div>
        </div>
        <div className="resumen-operativo__item">
          <span className="resumen-operativo__icono">
            <Icono nombre="check" />
          </span>
          <div>
            <strong>{datos ? datos.historial.filter((i) => i.estado === "aprobada").length : "—"}</strong>
            <span>Aprobados en historial</span>
          </div>
        </div>
      </div>

      <div className="barra-secciones">
        <nav className="pestanias" aria-label="Secciones">
          {(
            [
              { vista: "revisar", texto: "Bandeja", icono: "bandeja" },
              { vista: "subir", texto: "Subir facturas", icono: "subir" },
              { vista: "historial", texto: "Historial", icono: "historial" },
            ] as const
          ).map((p) => (
            <button
              key={p.vista}
              type="button"
              className={`pestania${vista === p.vista ? " pestania--activa" : ""}`}
              aria-current={vista === p.vista ? "page" : undefined}
              onClick={() => cambiarVista(p.vista)}
            >
              <Icono nombre={p.icono} size={18} />
              <span>{p.texto}</span>
              {p.vista === "revisar" && datos && <span className="pestania__cantidad">{pendientes.length}</span>}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="btn btn--texto btn--chico"
          disabled={actualizando}
          onClick={() => void cargar()}
          aria-label="Actualizar comprobantes"
        >
          <Icono nombre="recargar" size={16} className={actualizando ? "girando" : undefined} />
          <span>{actualizando ? "Actualizando" : "Actualizar"}</span>
        </button>
      </div>

      {subiendo > 0 && vista !== "subir" && (
        <div role="status" className="alerta alerta--info">
          <Icono nombre="subir" />
          <span>
            {subiendo} {subiendo === 1 ? "archivo sigue" : "archivos siguen"} procesándose. Podés revisar mientras
            tanto; mantené esta pestaña abierta.
          </span>
          <button className="btn btn--texto btn--chico" onClick={() => cambiarVista("subir")}>
            Ver cargas
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" />
          <div>
            <strong>No pudimos actualizar la bandeja.</strong>
            <p>{error}</p>
            {datos && <p>Seguís viendo los últimos datos recibidos.</p>}
          </div>
          <button type="button" className="btn btn--texto btn--chico" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      )}
      {faltaConfigurar && <EstadoConfiguracion />}
      {aviso && (
        <div role={aviso.error ? "alert" : "status"} className={`alerta alerta--${aviso.error ? "error" : "ok"}`}>
          <Icono nombre={aviso.error ? "alerta" : "check"} />
          <span>{aviso.texto}</span>
          {aviso.historial && (
            <button type="button" className="btn btn--texto btn--chico" onClick={() => cambiarVista("historial")}>
              Ver historial <Icono nombre="flecha" size={16} />
            </button>
          )}
          <button type="button" className="btn-icono" aria-label="Cerrar confirmación" onClick={() => setAviso(null)}>
            <Icono nombre="cerrar" size={18} />
          </button>
        </div>
      )}

      <section aria-label="Bandeja de revisión" hidden={vista !== "revisar"}>
        {!datos && !error && (
          <div className="card estado-vacio" role="status">
            <Icono nombre="recargar" className="girando" />
            <h2>Cargando tu bandeja</h2>
            <p>Buscamos los comprobantes recibidos por la web y Telegram.</p>
          </div>
        )}
        {datos && pendientes.length === 0 && (
          <div className="card estado-vacio">
            <span className="estado-vacio__icono">
              <Icono nombre="check" size={28} />
            </span>
            <h2>Todo al día</h2>
            <p>Las facturas que subas o recibas por Telegram van a aparecer acá para revisar.</p>
            <button type="button" className="btn btn--primario" onClick={() => cambiarVista("subir")}>
              <Icono nombre="subir" size={18} />
              Subir facturas
            </button>
          </div>
        )}
        {datos && pendientes.length > 0 && (
          <>
            <div className="herramientas-cola">
              <label className="buscador">
                <Icono nombre="buscar" size={18} />
                <input
                  aria-label="Buscar comprobantes"
                  placeholder="Buscar proveedor, número o archivo…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <label className="campo campo--filtro">
                <span className="sr-only">Filtrar por categoría</span>
                <select
                  aria-label="Filtrar por categoría"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {Object.entries(CATEGORIAS_VISTA).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="filtros-cola" role="group" aria-label="Filtrar por estado">
              {filtros.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  className={`filtro${filtro === f.valor ? " filtro--activo" : ""}`}
                  aria-pressed={filtro === f.valor}
                  onClick={() => setFiltro(f.valor)}
                >
                  {f.texto}
                  <span>{f.cantidad}</span>
                </button>
              ))}
            </div>
            {visibles.length === 0 && (
              <div className="card estado-vacio">
                <Icono nombre="buscar" size={28} />
                <h2>No encontramos coincidencias</h2>
                <p>Probá con otro nombre, número o categoría.</p>
                <button type="button" className="btn btn--borde" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              </div>
            )}
            <div className={`espacio-revision${enDetalle && actual ? " espacio-revision--detalle" : ""}`}>
              {visibles.length > 0 && (
                <aside className="lista-cola" aria-label="Comprobantes recibidos">
                  <div className="lista-cola__titulo">
                    <strong>
                      {visibles.length} {visibles.length === 1 ? "comprobante" : "comprobantes"}
                    </strong>
                    <span>Más antiguos primero</span>
                  </div>
                  <ul>
                    {visibles.map((i) => {
                      const f = i.lectura?.factura;
                      const estado = estadoVisible(i);
                      return (
                        <li key={i.id}>
                          <button
                            ref={actual?.id === i.id ? filaSeleccionadaRef : undefined}
                            type="button"
                            className={`fila-cola${actual?.id === i.id ? " fila-cola--activa" : ""}`}
                            aria-current={actual?.id === i.id ? "true" : undefined}
                            onClick={() => {
                              setSeleccion(i.id);
                              setEnDetalle(true);
                              if (window.matchMedia("(max-width: 900px)").matches)
                                requestAnimationFrame(() => detalleRef.current?.focus());
                            }}
                          >
                            <span className="fila-cola__superior">
                              <span className={`estado estado--${estado.clase}`}>{estado.texto}</span>
                              <span className="fila-cola__fecha">{fechaHora(i.recibida)}</span>
                            </span>
                            <strong>{f ? contraparte(f) || i.archivo.nombre : i.archivo.nombre}</strong>
                            <span className="fila-cola__comprobante">{f ? comprobante(f) : "Lectura pendiente"}</span>
                            <span className="fila-cola__inferior">
                              <span>
                                {f ? CATEGORIAS_VISTA[f.categoria] : i.origen === "telegram" ? "Telegram" : "Web"}
                              </span>
                              <strong>{f ? importe(f.total, f.moneda) : "—"}</strong>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              )}
              <div className="detalle-cola" ref={detalleRef} tabIndex={-1}>
                {actual && (
                  <button
                    type="button"
                    className="btn btn--texto volver-bandeja"
                    onClick={() => {
                      setEnDetalle(false);
                      requestAnimationFrame(() => filaSeleccionadaRef.current?.focus());
                    }}
                  >
                    <Icono nombre="volver" size={18} />
                    Volver a la bandeja
                  </button>
                )}
                {pendientes.map((item) => (
                  <FichaRevision
                    key={item.id}
                    item={item}
                    activa={vista === "revisar" && actual?.id === item.id}
                    onResuelto={resuelto}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Mantener montado evita perder las subidas al cambiar de sección. */}
      <section aria-label="Subir facturas" hidden={vista !== "subir"}>
        <div className="seccion-titulo">
          <div>
            <h2>Subir facturas</h2>
            <p>Elegí los archivos. La IA los lee y los deja en tu bandeja para revisar.</p>
          </div>
          <span className="paso-etiqueta">
            1. Subir <span>→ 2. Revisar → 3. Aprobar</span>
          </span>
        </div>
        <Subir
          onSubida={(id) => {
            ultimaSubida.current = id;
            void cargar();
          }}
          onActividad={setSubiendo}
          onIrARevisar={(id) => {
            limpiarFiltros();
            setSeleccion(id ?? ultimaSubida.current);
            setEnDetalle(true);
            cambiarVista("revisar");
          }}
        />
        {vista === "subir" && <TelegramPanel />}
        <details
          className="configuracion-tecnica"
          onToggle={(e) => {
            if (e.currentTarget.open) setVerEstado(true);
          }}
        >
          <summary>
            <Icono nombre="ayuda" size={16} />
            Conexiones y configuración
          </summary>
          {verEstado && <EstadoConfiguracion />}
        </details>
      </section>
      <section aria-label="Historial" hidden={vista !== "historial"}>
        {!datos ? (
          <p className="carga__resumen" role="status">
            Cargando historial…
          </p>
        ) : (
          <Historial items={datos.historial} />
        )}
      </section>
    </div>
  );
}
