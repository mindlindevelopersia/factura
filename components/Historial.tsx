import { comprobante, contraparte, type ItemCola } from "@/lib/cola/item";
import { fechaHora, importe } from "./formato";

/** Lo que pasó por la app: aprobado (con su fila y su archivo) o descartado. */
export function Historial({ items }: { items: ItemCola[] }) {
  if (items.length === 0) return <p className="carga__resumen">Todavía no se aprobó ni descartó ningún comprobante.</p>;
  return (
    <div className="card tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            <th>Resuelta</th>
            <th>Estado</th>
            <th>Contraparte</th>
            <th>Comprobante</th>
            <th className="tabla__numero">Total</th>
            <th>Planilla</th>
            <th>Origen</th>
            <th>Archivo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const f = i.lectura?.factura;
            return (
              <tr key={i.id}>
                <td data-etiqueta="Resuelta">
                  {fechaHora(i.resuelta)}
                  <span className="tabla__sub">{i.resueltaPor}</span>
                </td>
                <td data-etiqueta="Estado">
                  <span className={`estado estado--${i.estado === "aprobada" ? "guardada" : "error"}`}>
                    {i.estado === "aprobada" ? "Aprobada" : "Descartada"}
                  </span>
                </td>
                <td data-etiqueta="Contraparte">{f ? contraparte(f) : i.archivo.nombre}</td>
                <td data-etiqueta="Comprobante">{f ? comprobante(f) : ""}</td>
                <td data-etiqueta="Total" className="tabla__numero">
                  {f ? importe(f.total, f.moneda) : ""}
                </td>
                <td data-etiqueta="Planilla">
                  {i.resultado?.pestania}
                  {i.resultado?.fila && (
                    <>
                      {", "}
                      <a href={`/ir/planilla-${f?.categoria === "venta" ? "ingresos" : "egresos"}?fila=${i.resultado.fila}`} target="_blank" rel="noopener">
                        fila {i.resultado.fila}
                      </a>
                    </>
                  )}
                </td>
                <td data-etiqueta="Origen">
                  {i.origen === "telegram" ? "Telegram" : "Web"}
                  <span className="tabla__sub">{i.enviadaPor}</span>
                </td>
                <td data-etiqueta="Archivo">
                  {i.estado === "aprobada" && (
                    <a href={i.archivo.url} target="_blank" rel="noreferrer">
                      Ver en Drive
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
