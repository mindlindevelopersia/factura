"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Pendiente } from "@/lib/cola/servicio";
import { contraparte, type ItemCola } from "@/lib/cola/item";
import type { Factura } from "@/lib/invoice/schema";
import { claveDuplicado } from "@/lib/invoice/tipos";
import { importesSinColumna } from "@/lib/sheets/columnas";
import { validateInvoice } from "@/lib/validation";
import { fechaHora, importe, leerJson } from "./formato";
import {
  aFactura,
  aValores,
  camposDe,
  ETIQUETAS_IMPORTE,
  type CampoEditable,
  type DefCampo,
  type Valores,
} from "./formulario";
import { CATEGORIAS_VISTA, estadoVisible } from "./cola-vista";
import { Confirmacion } from "./Confirmacion";
import { Icono } from "./Icono";

export type AccionRevision = "aprobar" | "descartar" | "reintentar";
const IDENTIDAD = new Set(["categoria", "fecha_factura", "tipo_comprobante", "letra", "punto_venta", "numero"]);
const CONTRAPARTE = new Set([
  "razon_social",
  "cuit",
  "cliente",
  "cuit_receptor",
  "tipo_pago",
  "depto",
  "concepto",
  "rubro",
  "rubro_detalle",
  "corresponde_a",
]);
const ADICIONALES = new Set([
  "iva_otras",
  "percepcion_iva",
  "percepcion_iibb_caba",
  "percepcion_iibb_pba",
  "otros_tributos",
  "cae",
]);

export function FichaRevision({
  item,
  activa = true,
  onResuelto,
}: {
  item: Pendiente;
  activa?: boolean;
  onResuelto: (mensaje: string, item: ItemCola, accion: AccionRevision) => void;
}) {
  const original = item.lectura?.factura;
  const [valores, setValores] = useState<Valores | null>(original ? aValores(original) : null);
  const [tocados, setTocados] = useState<Set<CampoEditable>>(new Set());
  const [revisados, setRevisados] = useState<Set<CampoEditable>>(new Set());
  const [ocupado, setOcupado] = useState<AccionRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<"descartar" | "reintentar" | null>(null);
  const [verArchivo, setVerArchivo] = useState(false);
  const enCurso = useRef(false);
  const id = useId();
  const lecturaClave = item.lectura ? JSON.stringify(item.lectura.factura) : "";
  useEffect(() => {
    setValores(item.lectura ? aValores(item.lectura.factura) : null);
    setTocados(new Set());
    setRevisados(new Set());
    setError(null);
  }, [lecturaClave]); // La encuesta de la bandeja no debe borrar ediciones locales.

  useEffect(() => {
    if (!tocados.size) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [tocados.size]);

  async function accion(nombre: AccionRevision, factura?: Factura) {
    if (enCurso.current) return;
    enCurso.current = true;
    setConfirmar(null);
    setOcupado(nombre);
    setError(null);
    try {
      const { item: nuevo } = await leerJson<{ item: ItemCola }>(
        await fetch(`/api/cola/${item.id}/${nombre}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(factura ? { factura } : {}),
        }),
      );
      let mensaje =
        nombre === "aprobar"
          ? `Comprobante aprobado${nuevo.resultado?.fila ? ` · fila ${nuevo.resultado.fila}` : ""}. Se guardó en la planilla y en Drive.`
          : nombre === "descartar"
            ? "Comprobante descartado. El archivo se movió a la papelera de Drive."
            : "Lectura actualizada. Revisá los datos propuestos.";
      if (nombre === "reintentar" && (nuevo.estado === "aprobada" || nuevo.estado === "descartada"))
        mensaje = `El comprobante ya quedó ${nuevo.estado === "aprobada" ? "aprobado" : "descartado"}. Se conservó su resultado.`;
      if (nuevo.estado === "error")
        mensaje = "No se pudo completar la lectura. Revisá el error del comprobante para reintentar.";
      onResuelto(mensaje, nuevo, nombre);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }

  // El componente sigue montado al cambiar de comprobante para conservar sus ediciones.
  if (!activa) return null;
  const factura = original && valores ? aFactura(original, valores, tocados) : null;
  const dudosos = new Set<string>();
  for (const c of original?.campos_dudosos ?? [])
    if (!tocados.has(c as CampoEditable) && !revisados.has(c as CampoEditable)) dudosos.add(c);
  const validacion = factura?.success ? validateInvoice(factura.data) : null;
  validacion?.problemas.forEach((p) => p.campos.forEach((c) => dudosos.add(c)));
  const invalidos = new Set(factura && !factura.success ? factura.error.issues.map((e) => String(e.path[0])) : []);
  const mismaIdentidad = !!(
    factura?.success &&
    original &&
    claveDuplicado(original) === claveDuplicado(factura.data) &&
    Math.abs(original.total - factura.data.total) <= 1
  );
  // Una aprobación cortada a mitad de camino puede haber escrito ya la fila: completarla no la duplica.
  const aprobando = item.estado === "aprobando";
  const duplicada = !aprobando && mismaIdentidad && item.cargada?.tipo === "duplicada";
  const repetida = !aprobando && mismaIdentidad && !!item.repetida;
  const pestaniaPlanilla = original?.categoria === "venta" ? "ingresos" : "egresos";
  const linkFila = (fila: number, pestania: string = pestaniaPlanilla) => (
    <a href={`/ir/planilla-${pestania}?fila=${fila}`} target="_blank" rel="noopener">
      fila {fila}
    </a>
  );
  const sinColumna = factura?.success ? importesSinColumna(factura.data) : [];
  const archivoUrl = `/api/cola/${item.id}/archivo`;
  const estado = estadoVisible(item);
  const campos = valores ? camposDe(valores.categoria, valores.moneda) : [];
  const cantidadDudosos = campos.filter((c) => dudosos.has(c.campo)).length;
  const extraConDatos = campos.some(
    (c) =>
      ADICIONALES.has(c.campo) &&
      ((c.campo !== "cae" && Number(valores?.[c.campo])) || dudosos.has(c.campo) || invalidos.has(c.campo)),
  );

  function campo(def: DefCampo) {
    if (!valores) return null;
    const invalido = invalidos.has(def.campo);
    const problemaCampo =
      factura && !factura.success ? factura.error.issues.find((p) => p.path[0] === def.campo) : undefined;
    const dudoso = dudosos.has(def.campo);
    const campoId = `${id}-${def.campo}`;
    const props = {
      "aria-label": def.etiqueta,
      id: campoId,
      disabled: ocupado !== null,
      value: valores[def.campo],
      "aria-invalid": invalido || undefined,
      "aria-describedby": invalido || dudoso ? `${campoId}-ayuda` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setValores({ ...valores, [def.campo]: e.target.value });
        setTocados((p) => new Set(p).add(def.campo));
      },
      onBlur: () => setRevisados((p) => new Set(p).add(def.campo)),
    };
    return (
      <label
        key={def.campo}
        htmlFor={campoId}
        className={`campo${dudoso ? " campo--dudoso" : ""}${invalido ? " campo--invalido" : ""}${def.ancho ? " campo--ancho" : ""}`}
      >
        <span>
          {def.etiqueta}
          {dudoso && <span className="campo__revisar">Revisar</span>}
        </span>
        {def.tipo === "opciones" ? (
          <select {...props}>
            {!def.opciones?.some((o) => o.valor === valores[def.campo]) && valores[def.campo] && (
              <option value={valores[def.campo]}>{valores[def.campo]}</option>
            )}
            {def.opciones!.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...props}
            type={def.tipo === "fecha" ? "date" : def.tipo === "texto" ? "text" : "number"}
            step={def.tipo === "importe" ? "0.01" : def.tipo === "entero" ? "1" : undefined}
            inputMode={def.tipo === "importe" ? "decimal" : def.tipo === "entero" ? "numeric" : undefined}
          />
        )}
        {(invalido || dudoso) && (
          <span id={`${campoId}-ayuda`} className="campo__ayuda">
            {invalido
              ? problemaCampo?.code === "custom"
                ? problemaCampo.message
                : "Ingresá un valor válido para este campo."
              : "Contrastá este dato con el comprobante."}
          </span>
        )}
      </label>
    );
  }

  return (
    <article className="card factura" aria-label={`Revisión de ${item.archivo.nombre}`} aria-busy={ocupado !== null}>
      <header className="factura__encabezado">
        <div>
          <span className="eyebrow">{original ? CATEGORIAS_VISTA[original.categoria] : "Comprobante recibido"}</span>
          <h2>{original ? contraparte(original) || item.archivo.nombre : item.archivo.nombre}</h2>
          <p className="factura__origen">
            {item.archivo.nombre} · {item.origen === "telegram" ? "Telegram" : "Web"} · {fechaHora(item.recibida)}
          </p>
        </div>
        <span className={`estado estado--${estado.clase}`}>{estado.texto}</span>
      </header>
      {(error || item.error) && (
        <div role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" />
          <span>{error ?? item.error}</span>
        </div>
      )}
      {item.estado === "leyendo" ? (
        <div className="estado-vacio" role="status">
          <Icono nombre="recargar" className="girando" size={28} />
          <h3>Estamos leyendo el comprobante</h3>
          <p>La IA está buscando los datos. Podés revisar otro archivo mientras termina.</p>
        </div>
      ) : (
        <>
          {(duplicada || repetida) && (
            <div className="alerta alerta--aviso">
              <Icono nombre="alerta" />
              <div>
                <strong>
                  {duplicada ? "Este comprobante ya está cargado" : "Este comprobante ya está en la bandeja"}
                </strong>
                <p>
                  {duplicada ? (
                    <>Coincide con la {linkFila(item.cargada!.fila)} de la planilla. No se volverá a registrar.</>
                  ) : (
                    `${item.repetida?.descripcion}. Revisá el envío anterior y descartá la copia si corresponde.`
                  )}
                </p>
              </div>
            </div>
          )}
          {mismaIdentidad && item.cargada?.tipo === "mismo_numero" && (
            <div className="alerta alerta--aviso">
              <Icono nombre="alerta" />
              <span>
                Hay un comprobante con este número y otro total en la {linkFila(item.cargada.fila)}. Verificá ambos antes de
                aprobar.
              </span>
            </div>
          )}
          <div className="factura__cuerpo">
            <div className={`factura__vista${verArchivo ? " factura__vista--abierta" : ""}`}>
              <div className="vista-documento__barra">
                <span>
                  <Icono nombre="archivo" size={16} />
                  Documento original
                </span>
                <a
                  href={archivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${item.archivo.nombre} en otra pestaña`}
                >
                  <Icono nombre="externo" size={17} />
                </a>
                <button
                  type="button"
                  className="btn btn--texto btn--chico vista-documento__alternar"
                  aria-expanded={verArchivo}
                  onClick={() => setVerArchivo((v) => !v)}
                >
                  {verArchivo ? "Ocultar" : "Ver documento"}
                </button>
              </div>
              <div className="vista-documento__contenido">
                {item.archivo.mediaType === "application/pdf" ? (
                  <iframe src={archivoUrl} title={`Vista previa de ${item.archivo.nombre}`} />
                ) : (
                  <img src={archivoUrl} alt={`Vista previa de ${item.archivo.nombre}`} />
                )}
              </div>
              <p className="vista-documento__ayuda">
                Si no se ve,{" "}
                <a href={archivoUrl} target="_blank" rel="noreferrer">
                  abrí el documento en otra pestaña
                </a>
                .
              </p>
            </div>
            <div className="factura__datos">
              {valores && (
                <>
                  <div className="revision-indicacion">
                    <Icono nombre={cantidadDudosos ? "alerta" : "check"} size={18} />
                    <span>
                      {cantidadDudosos
                        ? `${cantidadDudosos} ${cantidadDudosos === 1 ? "dato para contrastar" : "datos para contrastar"} con el original.`
                        : "Revisá los datos antes de confirmar la carga."}
                    </span>
                    {tocados.size > 0 && <span className="revision-indicacion__edicion">Cambios sin aprobar</span>}
                  </div>
                  {validacion && validacion.problemas.length > 0 && (
                    <div className="alerta alerta--aviso">
                      <div>
                        <strong>Controles para revisar</strong>
                        <ul>
                          {validacion.problemas.map((p) => (
                            <li key={p.mensaje}>{p.mensaje}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  <fieldset className="grupo-campos">
                    <legend>Datos del comprobante</legend>
                    <div className="factura__campos">{campos.filter((c) => IDENTIDAD.has(c.campo)).map(campo)}</div>
                  </fieldset>
                  <fieldset className="grupo-campos">
                    <legend>{valores.categoria === "venta" ? "Cliente y destino" : "Proveedor y destino"}</legend>
                    <div className="factura__campos">{campos.filter((c) => CONTRAPARTE.has(c.campo)).map(campo)}</div>
                  </fieldset>
                  <fieldset className="grupo-campos">
                    <legend>Importes</legend>
                    <div className="factura__campos">
                      {campos
                        .filter(
                          (c) => !IDENTIDAD.has(c.campo) && !CONTRAPARTE.has(c.campo) && !ADICIONALES.has(c.campo),
                        )
                        .map(campo)}
                    </div>
                    {valores.tipo_comprobante === "nota_credito" && (
                      <p className="campo__ayuda">
                        Los importes se muestran como en el comprobante. La nota de crédito se registra con signo
                        negativo en la planilla.
                      </p>
                    )}
                  </fieldset>
                  <details className="detalles-revision" open={extraConDatos || undefined}>
                    <summary>
                      Otros impuestos y datos fiscales
                      {extraConDatos && <span className="estado estado--revision">Con datos</span>}
                    </summary>
                    <div className="factura__campos">{campos.filter((c) => ADICIONALES.has(c.campo)).map(campo)}</div>
                  </details>
                  {sinColumna.length > 0 && (
                    <p className="factura__nota">
                      Sin columna propia en la planilla: {sinColumna.map((c) => ETIQUETAS_IMPORTE[c]).join(", ")}. Se
                      conservan en el total.
                    </p>
                  )}
                </>
              )}
              {(item.lectura?.desde || original?.observaciones || item.notas.length > 0) && (
                <details className="detalles-revision" open={item.notas.length > 0 || undefined}>
                  <summary>
                    Contexto de la lectura
                    {item.notas.length > 0 && <span className="estado">{item.notas.length} comentarios</span>}
                  </summary>
                  {item.lectura?.desde && (
                    <p className="factura__nota">
                      Se recuperaron datos de la última carga de esta contraparte, {linkFila(item.lectura.desde.fila, item.lectura.desde.pestania)} de{" "}
                      {item.lectura.desde.pestania}.
                    </p>
                  )}
                  {original?.observaciones && (
                    <p className="factura__nota">
                      <strong>Observación de la IA:</strong> {original.observaciones}
                    </p>
                  )}
                  {item.notas.length > 0 && (
                    <ul className="notas" aria-label="Comentarios de quien la mandó">
                      {item.notas.map((n, i) => (
                        <li key={i} className="notas__item">
                          {n.tipo === "audio" ? (
                            <audio controls preload="none" src={`/api/cola/${item.id}/nota?n=${i}`}>
                              <a href={n.audio?.url} target="_blank" rel="noreferrer">
                                Escuchar en Drive
                              </a>
                            </audio>
                          ) : (
                            <span className="notas__texto">{n.texto}</span>
                          )}
                          <span className="notas__de">
                            {n.de} · {fechaHora(n.fecha)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
              <p className="factura__origen">Enviado por {item.enviadaPor}</p>
              {invalidos.size > 0 && (
                <p role="alert" className="alerta alerta--error">
                  Corregí los campos marcados antes de aprobar:{" "}
                  {campos
                    .filter((c) => invalidos.has(c.campo))
                    .map((c) => c.etiqueta)
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          </div>
          <footer className="factura__pie">
            <div className="factura__total">
              <span>
                {valores?.tipo_comprobante === "nota_credito" ? "Total a descontar" : "Total del comprobante"}
              </span>
              <strong>
                {valores?.total.trim() && Number.isFinite(Number(valores.total.replace(",", ".")))
                  ? importe(Number(valores.total.replace(",", ".")), valores.moneda)
                  : "—"}
              </strong>
            </div>
            <div className="factura__acciones">
              {!aprobando && (
                <button
                  type="button"
                  className="btn btn--texto btn--chico"
                  disabled={ocupado !== null}
                  onClick={() => setConfirmar("descartar")}
                >
                  <Icono nombre="papelera" size={17} />
                  Descartar
                </button>
              )}
              {item.estado === "pendiente" && (
                <button
                  type="button"
                  className="btn btn--borde btn--chico"
                  disabled={ocupado !== null}
                  onClick={() => (tocados.size ? setConfirmar("reintentar") : void accion("reintentar"))}
                >
                  <Icono nombre="recargar" size={16} />
                  {ocupado === "reintentar" ? "Leyendo…" : "Volver a leer"}
                </button>
              )}
              {item.estado === "error" ? (
                <button
                  type="button"
                  className="btn btn--primario"
                  disabled={ocupado !== null}
                  onClick={() => void accion("reintentar")}
                >
                  {ocupado === "reintentar" ? "Leyendo…" : "Reintentar lectura"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primario"
                  disabled={!factura?.success || ocupado !== null || duplicada || repetida || (aprobando && !item.error)}
                  onClick={() => factura?.success && void accion("aprobar", factura.data)}
                >
                  <Icono
                    nombre={ocupado === "aprobar" ? "recargar" : "check"}
                    size={18}
                    className={ocupado === "aprobar" ? "girando" : undefined}
                  />
                  {ocupado === "aprobar" || (aprobando && !item.error)
                    ? "Guardando en planilla y Drive…"
                    : aprobando
                      ? "Completar la aprobación"
                      : duplicada || repetida
                      ? "Duplicado detectado"
                      : "Aprobar y cargar"}
                </button>
              )}
            </div>
            {ocupado && (
              <span className="factura__progreso" role="status">
                {ocupado === "aprobar"
                  ? "Estamos guardando el archivo y registrando la fila. Esperá la confirmación."
                  : ocupado === "descartar"
                    ? "Moviendo el archivo a la papelera…"
                    : "La IA está leyendo otra vez. Tus datos se actualizarán al terminar."}
              </span>
            )}
          </footer>
        </>
      )}
      {confirmar && (
        <Confirmacion
          titulo={confirmar === "descartar" ? "¿Descartar este comprobante?" : "¿Volver a leer el archivo?"}
          confirmar={confirmar === "descartar" ? "Sí, descartar" : "Volver a leer"}
          peligro={confirmar === "descartar"}
          onCancelar={() => setConfirmar(null)}
          onConfirmar={() => void accion(confirmar)}
        >
          {confirmar === "descartar" ? (
            <p>
              <strong>{item.archivo.nombre}</strong> va a la papelera de Drive y queda en el historial como descartado.
              Esta acción no modifica filas de la planilla.
            </p>
          ) : (
            <p>La nueva lectura reemplazará los cambios que hiciste en este comprobante. ¿Querés continuar?</p>
          )}
        </Confirmacion>
      )}
    </article>
  );
}
