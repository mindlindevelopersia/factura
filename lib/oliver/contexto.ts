import "server-only";
import { porRubro, totalesEgresos, egresosPorMes } from "../finanzas/egresos";
import {
  cajaEgresos,
  cobranzas,
  cuentasCorrientes,
  datosComercial,
  datosPanorama,
  dolarHoy,
  flujoIngresos,
  serieCac,
} from "../finanzas/fuente";
import { resumenCuenta, totalesCuentas, type Cuenta } from "../inversores/cuentas";
import { avanceEnPesos } from "../inversores/pesos";
import { PROYECTOS, proyecto as buscarProyecto } from "../modulos";
import { resumen } from "../proyectos/comercial";
import { hoyBA, tablero, temperatura, todasLasAlarmas, unidadesPara } from "../crm/alarmas";
import { leerCrm } from "../crm/fuente";
import { esDelProyecto } from "../crm/modelo";
import { estadosDeUnidades, unidadesDisponibles } from "../finanzas/fuente";

/**
 * Lo que Oliver sabe de la sección en la que está la persona: un nombre, de qué es especialista y
 * los datos de esa sección (los mismos que se ven en pantalla, resumidos). Se arma en el servidor:
 * el navegador solo dice en qué página está.
 */
export interface Contexto {
  seccion: string;
  especialidad: string;
  datos: unknown;
}

const r0 = (n: number | null | undefined) => (n == null ? null : Math.round(n));
const r2 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100) / 100);
const pct = (n: number | null | undefined) => (n == null ? null : `${Math.round(n * 1000) / 10}%`);

function cuentaResumida(c: Cuenta, mesActual: string, cac: Parameters<typeof avanceEnPesos>[1]) {
  const r = resumenCuenta(c, mesActual);
  const p = avanceEnPesos(c, cac, mesActual);
  return {
    unidad: c.unidad,
    inversor: c.inversor,
    mesBaseCac: c.mesBaseCac,
    costoUsd: r0(c.precioUsd),
    costoArsContrato: r0(c.precioArs),
    formalUsd: r0(c.formalUsd),
    informalUsd: r0(c.informalUsd),
    pagadoUsd: r0(r.pagadoUsd),
    saldoUsd: r0(r.saldoUsd),
    avanceUsd: pct(r.avance),
    pagadoFormalUsd: r0(r.formal.pagado),
    pagadoInformalUsd: r0(r.informal.pagado),
    enPesosDeHoy: p
      ? { aValoresDe: p.mesCac, costoHoy: r0(p.costoHoy), pagadoHoy: r0(p.pagadoHoy), saldoHoy: r0(p.saldoHoy), avance: pct(p.avance), falta: p.falta }
      : null,
    pendienteFlujo: { ARS: r0(r.pendienteFlujo.ARS), USD: r0(r.pendienteFlujo.USD) },
    vencidos: r.vencidos.length,
    terminaDePagar: r.ultimoMes,
    origen: c.origen === "planilla" ? `Pagos por Inversor, bloque en la columna ${c.columna}` : "solo el Flujo de fondos",
    avisos: c.avisos.map((a) => `${a.titulo}: ${a.detalle}`),
  };
}

async function contextoCuentas(idCuenta: string | null): Promise<Contexto> {
  const { cuentas: cc, cac, leido } = await cuentasCorrientes();
  const cuentas = cc.cuentas.map((c) => cuentaResumida(c, cc.mesActual, cac));
  const abierta = idCuenta ? cc.cuentas.find((c) => c.id === idCuenta) : null;
  const detalle = (c: Cuenta) => {
    const p = avanceEnPesos(c, cac, cc.mesActual);
    return {
      ...cuentaResumida(c, cc.mesActual, cac),
      pagos: c.pagos.map((x) => ({
        fecha: x.fecha ?? x.fechaTexto,
        concepto: [x.concepto, x.numero].filter(Boolean).join(" "),
        monto: r2(x.monto),
        moneda: x.moneda,
        formal: x.formal,
        tipoCambio: r2(x.tipoCambio),
        usd: r2(x.usd),
        pesosDeHoy: r0(p?.pagos[x.fila]?.hoy),
        fila: x.fila,
      })),
      pendientes: c.pendientes.map((x) => ({ mes: x.mes, detalle: x.detalle, monto: r0(x.monto), moneda: x.moneda, bn: x.bn, vencido: x.atrasado, celda: x.celda })),
      cobradoSegunFlujo: c.cobradoFlujo.map((x) => ({ mes: x.mes, detalle: x.detalle, monto: r0(x.monto), moneda: x.moneda })),
    };
  };
  return {
    seccion: abierta ? `Cuenta corriente de ${abierta.inversor} (${abierta.unidad})` : "Inversores · Cuentas corrientes",
    especialidad: "cuentas corrientes de inversores en un desarrollo al costo: pagos, saldos en dólares y en pesos ajustados por CAC, cuotas y refuerzos",
    datos: {
      leido,
      mesActual: cc.mesActual,
      totales: (() => {
        const t = totalesCuentas(cc.cuentas, cc.mesActual);
        return { cuentas: t.cuentas, costoUsd: r0(t.precio), pagadoUsd: r0(t.pagado), saldoUsd: r0(t.saldo), avance: pct(t.avance), sinPrecio: t.sinPrecio, aCobrarSegunFlujoArs: r0(t.pendiente.ARS), cuentasConVencidos: t.conVencidos };
      })(),
      cuentaAbierta: abierta ? detalle(abierta) : null,
      // Con una cuenta abierta, del resto va solo el resumen; si no, el detalle de todas.
      cuentas: abierta ? cuentas : cc.cuentas.map(detalle),
      avisosGenerales: cc.avisos.map((a) => `${a.unidad} ${a.inversor}: ${a.titulo}`),
    },
  };
}

async function contextoCobranzas(): Promise<Contexto> {
  const c = await cobranzas();
  const item = (i: (typeof c.cobranzas)[number]["vencidos"][number]) => ({
    detalle: i.pago.detalle,
    mes: i.pago.mes,
    monto: r0(i.pago.monto),
    moneda: i.pago.moneda,
    formal: i.formal,
    vence: i.vence,
    diasVencido: i.diasVencido,
    actualizadoPorCac: r0(i.actualizado),
    calculo: i.calculo,
  });
  return {
    seccion: "Inversores · Cobranzas",
    especialidad: "cobranzas a inversores: qué está vencido, cuánto es actualizado por CAC, qué vence este mes y a quién avisar",
    datos: {
      leido: c.leido,
      hoy: c.hoy,
      ultimoCacPublicado: c.cacUltimo,
      errorCac: c.errorCac,
      totales: c.totales,
      cobranzas: c.cobranzas.map((x) => ({
        unidad: x.unidad,
        inversor: x.inversor,
        venceElDia: x.dia,
        vencidos: x.vencidos.map(item),
        esteMes: x.esteMes.map(item),
        proximoMes: x.proximoMes.map(item),
        totalVencido: x.totalVencido,
        revisarAntesDeAvisar: x.verificar,
        tieneCuentaEnPagosPorInversor: x.conCuenta,
      })),
    },
  };
}

async function contextoComercial(id: string, management: boolean): Promise<Contexto> {
  const d = await datosComercial(id);
  const c = d.comercial;
  const r = resumen(c.unidades);
  const p = buscarProyecto(id);
  const datos: Record<string, unknown> = {
    leido: d.leido,
    proyecto: p?.nombre,
    precioVigente: { baseM2Piso1: r0(c.precioBaseM2), aumentoPorPiso: pct(c.aumentoPorPiso) },
    resumen: {
      deptos: r.deptos,
      vendidas: r.vendidas,
      libres: r.libres,
      cocheras: r.cocheras,
      m2: { total: r2(r.m2.total), vendidos: r2(r.m2.vendidos), libres: r2(r.m2.libres) },
      modalidades: r.modalidades,
      enReventa: r.enReventa,
      vendido: { totalUsd: r0(r.vendido.total), deptosUsd: r0(r.vendido.deptos), cocherasUsd: r0(r.vendido.cocheras), promedioUsdM2: r0(r.vendido.promedioM2) },
      faltaVenderAListaUsd: r0(r.porVender),
    },
    superficies: c.superficies,
    unidades: c.unidades.map((u) => ({
      codigo: u.codigo,
      piso: u.piso,
      tipologia: u.tipologia,
      orientacion: u.orientacion,
      estado: u.estado,
      inversor: u.inversor || null,
      supTotal: r2(u.supTotal),
      supVenta: r2(u.supVenta),
      supAmenities: r2(u.supAmenities),
      supDescubierta: r2(u.supDescubierta),
      m2ParaPrecioM2: r2(u.supPromedio),
      coeficiente: pct(u.coeficiente),
      precioListaUsd: r0(u.precioLista),
      precioVentaUsd: r0(u.precioVenta),
      precioSegunPagosPorInversorUsd: r0(u.precioCuenta),
      cocheraIncluidaUsd: r0(u.precioCochera),
      incluidaEn: u.incluidaEn,
      modalidad: u.modalidad,
      tope: pct(u.tope),
      contrato: u.contrato,
      reventaUsd: r0(u.reventa),
      correccion: u.ajuste,
      filaListaDePrecios: u.fila,
    })),
    supuestosYAlarmas: c.supuestos.map((s) => ({ tipo: s.tipo, titulo: s.titulo, detalle: s.detalle, mientras: s.mientras, origen: s.origen })),
  };
  if (management && d.desarrolladores) {
    const dev = d.desarrolladores;
    datos.desarrolladores = {
      parte: pct(dev.parte),
      m2Venta: r2(dev.m2Venta),
      m2Amenities: r2(dev.m2Amenities),
      m2Desarrolladores: r2(dev.m2),
      m2EnEERR: dev.m2EnPlanilla,
      stockSinVenderM2: r2(dev.m2Libres),
      socios: dev.socios.map((s) => ({ nombre: s.nombre, parte: pct(s.parte), m2: r2(s.m2) })),
      supuestos: dev.supuestos.map((s) => ({ tipo: s.tipo, titulo: s.titulo, detalle: s.detalle })),
      hq: dev.hq
        ? {
            movimientos: dev.hq.movimientos,
            ARS: r0(dev.hq.ARS),
            USD: r0(dev.hq.USD),
            enDuda: dev.hq.enDudaHq,
            oficina: dev.hq.oficina,
            // Los del banco son cientos de filas chicas: van sumados; el resto, fila por fila.
            revisar: dev.hq.revisar.filter((e) => e.duda !== "banco"),
            banco: { movimientos: dev.hq.revisar.filter((e) => e.duda === "banco").length },
          }
        : null,
    };
  }
  return {
    seccion: `${p?.nombre ?? id} · ${management ? "Management" : "Comercial"}`,
    especialidad: management
      ? "el management del proyecto: los m² de los desarrolladores, su valuación y reparto entre socios, y los gastos de HQ"
      : "la parte comercial del proyecto: unidades, superficies, lista de precios, ventas, modalidades (al costo, precio cerrado, canje) y lo que falta vender",
    datos,
  };
}

async function contextoIngresos(): Promise<Contexto> {
  const { flujo, leido } = await flujoIngresos();
  const porMes = new Map<string, Record<string, number>>();
  for (const p of flujo.pagos) {
    const clave = p.mes ?? "sin mes";
    const m = porMes.get(clave) ?? {};
    const k = `${p.estado}-${p.moneda}`;
    m[k] = (m[k] ?? 0) + p.monto;
    porMes.set(clave, m);
  }
  return {
    seccion: "Finanzas · Ingresos",
    especialidad: "los ingresos del proyecto según el Flujo de fondos: lo cobrado y lo que falta cobrar, por mes, moneda, inversor y blanco o negro",
    datos: {
      leido,
      mesActual: flujo.mesActual,
      porMes: Object.fromEntries([...porMes].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => [m, Object.fromEntries(Object.entries(v).map(([k, n]) => [k, r0(n)]))])),
      atrasados: flujo.pagos
        .filter((p) => p.atrasado)
        .map((p) => ({ unidad: p.unidad, inversor: p.inversor, mes: p.mes, detalle: p.detalle, monto: r0(p.monto), moneda: p.moneda, bn: p.bn, celda: p.celda })),
      pagos: flujo.pagos.map((p) => [p.unidad, p.inversor, p.mes, p.detalle, r0(p.monto), p.moneda, p.bn, p.estado]),
      formatoDePagos: "[unidad, inversor, mes, detalle, monto, moneda, blanco/negro, estado]",
      avisos: flujo.avisos.map((a) => `${a.titulo}: ${a.detalle}`),
    },
  };
}

async function contextoEgresos(): Promise<Contexto> {
  const { caja, leido } = await cajaEgresos();
  const t = totalesEgresos(caja.egresos);
  return {
    seccion: "Finanzas · Egresos",
    especialidad: "los egresos del proyecto: en qué se gasta, por rubro, mes, proyecto (Lerma o HQ) y blanco o negro",
    datos: {
      leido,
      totales: t,
      porRubro: { ARS: porRubro(caja.egresos, "ARS"), USD: porRubro(caja.egresos, "USD") },
      porMes: { ARS: egresosPorMes(caja.egresos, "ARS").slice(-18), USD: egresosPorMes(caja.egresos, "USD").slice(-18) },
      egresos: caja.egresos.map((e) => [e.fecha, e.descripcion, e.rubro, e.proyecto, e.bn, r2(e.monto), e.moneda, e.pestania, e.fila]),
      formatoDeEgresos: "[fecha, descripción, rubro, corresponde a, blanco/negro, monto, moneda, pestaña, fila]",
      avisos: caja.avisos.map((a) => `${a.titulo}: ${a.detalle}`),
    },
  };
}

async function contextoIndicadores(ruta: string): Promise<Contexto> {
  if (ruta.startsWith("/indicadores/cac")) {
    const { serie, leido } = await serieCac();
    return {
      seccion: "Indicadores · Índice CAC",
      especialidad: "el índice del costo de la construcción de la Cámara Argentina de la Construcción (general, materiales y mano de obra)",
      datos: {
        leido,
        ultimo: serie.ultimo,
        meses: serie.meses.slice(-36).map((m) => ({ mes: m.mes, general: m.general, materiales: m.materiales, manoDeObra: m.manoDeObra, provisorio: m.provisorio })),
      },
    };
  }
  const p = await datosPanorama();
  return {
    seccion: ruta.startsWith("/indicadores/materiales") ? "Indicadores · Materiales" : "Indicadores · Panorama",
    especialidad: "el CAC contra la inflación y el dólar, y si conviene comprar materiales ahora",
    datos: {
      leido: p.leido,
      cacUltimo: p.cacUltimo,
      series: p.series.map((s) => ({ nombre: s.nombre, unidad: s.unidad, fuente: s.fuente, ultimos24Meses: s.puntos.slice(-24) })),
      materiales: p.materiales.map((m) => ({ material: m.descripcion, unidad: m.unidad, ultimoMes: m.ultimoMes, precio: m.precio, resumen: m.resumen, senalPesos: m.senalPesos, senalDolares: m.senalDolares })),
      fuentes: p.fuentes,
    },
  };
}

async function contextoInicio(): Promise<Contexto> {
  const dolar = await dolarHoy().then(
    (r) => r.valor.cotizaciones,
    () => null,
  );
  return {
    seccion: "Inicio",
    especialidad: "el hub de Mindlin Developers: sus proyectos, sus áreas y el dólar del día",
    datos: {
      dolarHoy: dolar,
      proyectos: PROYECTOS.map((p) => ({ nombre: p.nombre, vehiculo: p.vehiculo, descripcion: p.descripcion, estado: p.estado })),
      areas: "Cada proyecto tiene Comercial (unidades, lista de precios), Administración (facturas), Finanzas (ingresos, egresos), Inversores (cuentas corrientes, cobranzas) y Management (desarrolladores). De toda la empresa: Indicadores (Índice CAC, Materiales).",
    },
  };
}

async function contextoCrm(id: string): Promise<Contexto> {
  const [{ contactos: todos, actividad }, unidades, estados] = await Promise.all([leerCrm(), unidadesDisponibles(id), estadosDeUnidades(id)]);
  const contactos = todos.filter((c) => esDelProyecto(c, id));
  const ahora = new Date().toISOString();
  const hoy = hoyBA();
  const minimo = unidades.length ? Math.min(...unidades.map((u) => u.precioUsd)) : null;
  return {
    seccion: `${buscarProyecto(id)?.nombre ?? id} · CRM`,
    especialidad:
      "el CRM de ventas: a quién hablarle y cuándo, en qué etapa está cada interesado (Nuevo, Contactado, Interesado, Propuesta enviada, Vendido, Perdido, Dormido), su temperatura (hot, tibio, frío) y qué mensaje mandarle",
    datos: {
      hoy,
      reglas:
        "Ningún contacto abierto queda sin próximo paso con fecha. Temperatura: hot si tiene una propuesta enviada (o decide en menos de 2 meses) y hablamos en la última semana; frío si hace más de 14 días que no hablamos, decide en más de 6 meses o no le alcanza; tibio el resto. Hablarle cada 2 días si es hot, 7 si es tibio, 30 si es frío. La propuesta vence a los 7 días.",
      tablero: tablero(contactos, actividad, ahora, minimo),
      alarmas: todasLasAlarmas(contactos, ahora, minimo, estados).map((a) => `[${a.nivel}] ${a.texto}`),
      contactos: contactos.map((c) => ({
        nombre: c.nombre,
        proyectos: c.proyectos,
        etapa: c.etapa,
        temperatura: temperatura(c, hoy, minimo),
        telefono: c.telefono || null,
        mail: c.mail || null,
        origen: [c.origen, c.referido].filter(Boolean).join(" · ") || null,
        presupuestoUsd: c.presupuestoUsd,
        formaPago: c.formaPago || null,
        plazo: c.plazo || null,
        ambientes: c.ambientes || null,
        unidadesDeInteres: c.unidades,
        unidadesQueLeSirven: unidadesPara(c, unidades).slice(0, 3).map((u) => u.codigo),
        proximoPaso: c.proximoPaso || null,
        proximaFecha: c.proximaFecha,
        ultimoContacto: c.ultimoContacto?.slice(0, 10) ?? null,
        motivoPerdida: c.motivoPerdida || null,
        unidadVendida: c.unidadVendida || null,
        precioVentaUsd: c.precioVentaUsd,
        notas: c.notas || null,
      })),
      actividadReciente: actividad.slice(0, 150).map((a) => `${a.fecha.slice(0, 10)} ${a.usuario} · ${a.contacto} · ${a.tipo}: ${a.detalle}`),
      unidadesDisponibles: unidades,
    },
  };
}

/** El contexto de la página en la que se está. */
export async function contextoDe(ruta: string): Promise<Contexto> {
  const m = ruta.match(/^\/proyectos\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?/);
  if (m) {
    const [, id, area, modulo, detalle] = m;
    const p = buscarProyecto(id);
    if (!p || p.estado !== "activo") return { seccion: "Proyecto en preparación", especialidad: "el hub", datos: { aviso: "Este proyecto todavía no tiene datos." } };
    if (area === "inversores" && modulo === "cobranzas") return contextoCobranzas();
    if (area === "inversores") return contextoCuentas(modulo === "cuentas-corrientes" && detalle ? decodeURIComponent(detalle) : null);
    if (area === "finanzas" && modulo === "egresos") return contextoEgresos();
    if (area === "finanzas") return contextoIngresos();
    if (area === "management") return contextoComercial(id, true);
    if (area === "comercial" && modulo === "crm") return contextoCrm(id);
    if (area === "administracion") {
      return {
        seccion: `${p.nombre} · Administración`,
        especialidad: "la carga de facturas y comprobantes",
        datos: { aviso: "En esta sección todavía no tengo datos para analizar: los comprobantes se revisan uno por uno en la pantalla." },
      };
    }
    return contextoComercial(id, false);
  }
  if (ruta.startsWith("/indicadores")) return contextoIndicadores(ruta);
  return contextoInicio();
}
