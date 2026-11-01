# Honorarios de los desarrolladores

En **Management → Desarrolladores**, debajo de los m² de los desarrolladores.

## La regla (Mati, 01/11/2026)

- **El 15% de todo lo que ingresa por boleto** es de los desarrolladores. El precio que pagan los
  compradores ya lo incluye, y la obra se termina con el 85% restante.
- **Hasta hoy no se cobró nada** de honorarios.
- **Se cobran en plata o se canjean por m² al costo.** El costo del m² es el costo total del
  proyecto (terreno incluido, sin los honorarios de los desarrolladores) dividido por los m²
  vendibles (sin amenities).
- **Por qué conviene el canje:** esos m², vendidos después a precio de mercado, valen más que
  tomarlos en plata.
- **Todo en dólares,** al MEP del día de cada pago.

## Qué muestra

| | De dónde sale |
| --- | --- |
| Ya ganado | 15% de lo cobrado (todos los pagos de las cuentas corrientes, formales e informales). |
| Por lo vendido | 15% de lo firmado (el precio de venta de cada unidad vendida; las cocheras incluidas en un depto no suman aparte). |
| Al final | 15% de lo firmado más las unidades libres a precio de lista (las reventas son de sus dueños). |
| m² al costo | Cada uno de esos honorarios ÷ el costo del m². |
| Valor de venta | Esos m² × el precio de venta del m² (por defecto, el de lista de lo que queda). |

- **Valores editables:** el costo del m² y el precio de venta se pueden cambiar en la pantalla.
- **Comparación:** se muestra el 15% de los m² (los ~194 m²), que no es lo mismo que el canje a
  costo.

**Costo del m²**

- Sale del cash flow **actualizado**: lo real hasta el mes pasado y lo proyectado del Excel madre
  de ahí en más.
- No se cuentan los préstamos, las devoluciones ni las partidas de honorarios de los
  desarrolladores.
- Se muestra el detalle por rubro y lo excluido.

**¿Alcanza el 85%?**

- **Hasta hoy:** lo gastado contra el 85% de lo cobrado. Si se gastó más, la obra usó plata de los
  honorarios.
- **Al final:** el costo total contra el 85% de los ingresos totales.

**Separar unidades:** se eligen unidades libres y se ve cuántos m² son, cuánto valen al costo, qué
parte de los honorarios del final cubren, lo que queda por cobrar y cuánto más valen vendidas a
lista que tomando los honorarios en plata.

## Código

- `lib/proyectos/honorarios.ts`: el cálculo (puro, con tests).
- `app/api/proyectos/[proyecto]/honorarios`: junta cuentas corrientes, comercial y cash flow.
  Por ahora solo Lerma 439, que es el proyecto con los cobros cargados.
- `components/proyectos/Honorarios.tsx`: la pantalla.
