import "server-only";
import { leerCrm } from "../crm/fuente";
import { cuentasCorrientes, datosComercial } from "../finanzas/fuente";
import { hoyBuenosAires } from "../inversores/cobranzas";
import { PROYECTO_PRINCIPAL, PROYECTOS } from "../modulos";
import { leerPropuestas } from "../proyectos/propuestasFuente";
import { leerTareas } from "../tareas/fuente";
import { resultadosCuentas, resultadosLeads, resultadosPropuestas, resultadosTareas, resultadosUnidades } from "./datos";
import type { Resultado } from "./indice";

/** Todo lo buscable de los datos. Cada fuente por separado: si una falla, el resto sale igual. */
export async function indiceDeDatos(): Promise<{ resultados: Resultado[]; faltan: string[] }> {
  const hoy = hoyBuenosAires();
  const activos = PROYECTOS.filter((p) => p.estado === "activo");
  const fuentes: [string, () => Promise<Resultado[]>][] = [
    ["leads", async () => resultadosLeads((await leerCrm()).contactos)],
    ["propuestas", async () => (await Promise.all(activos.map((p) => leerPropuestas(p.id)))).flatMap(resultadosPropuestas)],
    ["unidades", async () => (await Promise.all(activos.filter((p) => p.planillaMadre).map(async (p) => resultadosUnidades(p.id, (await datosComercial(p.id)).comercial.unidades)))).flat()],
    ["inversores", async () => resultadosCuentas(PROYECTO_PRINCIPAL.id, (await cuentasCorrientes()).cuentas.cuentas, hoy)],
    ["tareas", async () => resultadosTareas((await leerTareas()).tareas)],
  ];
  const leidos = await Promise.allSettled(fuentes.map(([, f]) => f()));
  const resultados: Resultado[] = [];
  const faltan: string[] = [];
  leidos.forEach((r, i) => {
    if (r.status === "fulfilled") resultados.push(...r.value);
    else {
      console.error("buscar", fuentes[i][0], r.reason);
      faltan.push(fuentes[i][0]);
    }
  });
  return { resultados, faltan };
}
