"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLES_FIJOS, type Acceso, type ConfigUsuario, type Permiso, type Rol } from "@/lib/permisos/modelo";
import { leerJson } from "../formato";
import { Icono } from "../Icono";

interface UsuarioAjustes {
  email: string;
  config: ConfigUsuario | null;
  acceso: Acceso;
  apodo: string;
  nombre: string;
}

interface Datos {
  usuarios: UsuarioAjustes[];
  roles: Rol[];
  permisos: Permiso[];
  proyectos: { id: string; nombre: string }[];
  superAdmin: string;
  yo: Acceso;
}

/** Ajustes: los usuarios (datos, rol, permisos por módulo y proyectos) y los roles con lo que ve cada uno. */
export function Ajustes() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestania, setPestania] = useState<"usuarios" | "roles">("usuarios");
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await leerJson<Datos>(await fetch("/api/ajustes/usuarios", { cache: "no-store" })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error && !datos) return <p className="alerta alerta--error">{error}</p>;
  if (!datos) return <p className="ficha__nota">Cargando los usuarios…</p>;
  const rolNombre = (id: string) => datos.roles.find((r) => r.id === id)?.nombre ?? id;
  const u = datos.usuarios.find((x) => x.email === abierto);

  return (
    <div className="ajustes">
      <nav className="crm__pestanias" aria-label="Ajustes">
        {(["usuarios", "roles"] as const).map((p) => (
          <button key={p} type="button" className={`crm__pestania cf__pestania${pestania === p ? " crm__pestania--activa" : ""}`} onClick={() => setPestania(p)}>
            {p === "usuarios" ? "Usuarios" : "Roles"}
          </button>
        ))}
      </nav>

      {pestania === "usuarios" ? (
        <section className="card">
          <p className="crm-ficha__sub">
            Los que pueden entrar son los mails habilitados en Vercel (ALLOWED_EMAILS). Para sumar a alguien nuevo, se agrega su mail ahí y aparece acá para darle rol y permisos. El super administrador es fijo.
          </p>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Puesto</th>
                  <th>Rol</th>
                  <th>Ve</th>
                  <th>Proyectos</th>
                </tr>
              </thead>
              <tbody>
                {datos.usuarios.map((x) => (
                  <tr key={x.email}>
                    <td data-etiqueta="Usuario">
                      <button type="button" className="ingresos__enlace" onClick={() => setAbierto(x.email)}>
                        {x.nombre}
                      </button>
                      <span className="tabla__sub">
                        @{x.apodo} · {x.email}
                      </span>
                    </td>
                    <td data-etiqueta="Puesto">{x.config?.puesto || "—"}</td>
                    <td data-etiqueta="Rol">
                      <span className={`ajustes__rol ajustes__rol--${x.acceso.rol}`}>{rolNombre(x.acceso.rol)}</span>
                      {!x.config && x.email !== datos.superAdmin && <span className="tabla__sub">Sin configurar</span>}
                      {x.config?.claves && <span className="tabla__sub">Permisos a medida</span>}
                    </td>
                    <td data-etiqueta="Ve">
                      {x.acceso.claves.length} de {datos.permisos.length} módulos
                    </td>
                    <td data-etiqueta="Proyectos">{x.acceso.proyectos ? x.acceso.proyectos.map((p) => datos.proyectos.find((y) => y.id === p)?.nombre ?? p).join(", ") || "Ninguno" : "Todos"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <Roles datos={datos} cambiar={() => void cargar()} />
      )}

      {u && <FichaUsuario key={u.email} u={u} datos={datos} cerrar={() => setAbierto(null)} guardado={(usuarios) => setDatos({ ...datos, usuarios })} />}
    </div>
  );
}

/** Los módulos agrupados por área, para la grilla de permisos. */
function porArea(permisos: Permiso[]) {
  const m = new Map<string, Permiso[]>();
  for (const p of permisos) m.set(p.area, [...(m.get(p.area) ?? []), p]);
  return [...m];
}

function Roles({ datos, cambiar }: { datos: Datos; cambiar: (roles: Rol[]) => void }) {
  const roles = datos.roles.filter((r) => r.id !== "sin-rol");
  const puedeEditar = datos.yo.superAdmin;
  const [editando, setEditando] = useState<Rol | "nuevo" | null>(null);
  const editable = (r: Rol) => puedeEditar && !ROLES_FIJOS.includes(r.id);
  return (
    <section className="card">
      <div className="ajustes__barra-roles">
        <p className="crm-ficha__sub">
          Lo que ve cada rol de entrada. A cada persona se le puede cambiar (en su ficha, &quot;Permisos a medida&quot;) y limitar los proyectos.
          {puedeEditar ? " Tocá el nombre de un rol para editarlo." : " Los roles los edita el super administrador."}
        </p>
        {puedeEditar && (
          <button type="button" className="btn btn--primario btn--chico" onClick={() => setEditando("nuevo")}>
            + Nuevo rol
          </button>
        )}
      </div>
      <div className="tabla-contenedor">
        <table className="tabla ajustes__matriz">
          <thead>
            <tr>
              <th>Módulo</th>
              {roles.map((r) => (
                <th key={r.id} title={r.descripcion}>
                  {editable(r) ? (
                    <button type="button" className="ajustes__rol-boton" onClick={() => setEditando(r)}>
                      {r.nombre} <Icono nombre="ajustes" size={12} />
                    </button>
                  ) : (
                    r.nombre
                  )}
                  {r.modificado && <small className="ajustes__marca">cambiado</small>}
                  {r.deFabrica === false && <small className="ajustes__marca">creado</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {porArea(datos.permisos).map(([area, lista]) =>
              lista.map((p, i) => (
                <tr key={p.clave}>
                  <td>
                    {i === 0 && <strong className="ajustes__area">{area}</strong>}
                    {p.nombre !== area && <span>{p.nombre}</span>}
                  </td>
                  {roles.map((r) => (
                    <td key={r.id} className="ajustes__celda">
                      {r.claves.includes(p.clave) ? <Icono nombre="check" size={16} /> : <span className="ajustes__no">—</span>}
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <ul className="ajustes__roles">
        {roles.map((r) => (
          <li key={r.id}>
            <strong>{r.nombre}</strong>: {r.descripcion || "—"}
          </li>
        ))}
      </ul>
      {editando && (
        <FichaRol
          key={editando === "nuevo" ? "nuevo" : editando.id}
          rol={editando === "nuevo" ? null : editando}
          datos={datos}
          cerrar={() => setEditando(null)}
          guardado={(r) => {
            cambiar(r);
            setEditando(null);
          }}
        />
      )}
    </section>
  );
}

/** Editar un rol (o crear uno): nombre, descripción y qué módulos ve. Solo el super administrador. */
function FichaRol({ rol, datos, cerrar, guardado }: { rol: Rol | null; datos: Datos; cerrar: () => void; guardado: (roles: Rol[]) => void }) {
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? "");
  const [claves, setClaves] = useState<Set<string>>(new Set(rol?.claves ?? []));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const usan = rol ? datos.usuarios.filter((u) => u.acceso.rol === rol.id && !u.config?.claves).length : 0;

  const enviar = async (metodo: "PUT" | "DELETE") => {
    setOcupado(true);
    setError(null);
    try {
      const r = await leerJson<{ roles: Rol[] }>(
        metodo === "PUT"
          ? await fetch("/api/ajustes/roles", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: rol?.id, nombre, descripcion, claves: [...claves] }) })
          : await fetch(`/api/ajustes/roles?id=${encodeURIComponent(rol!.id)}`, { method: "DELETE" }),
      );
      guardado(r.roles);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha" aria-label={rol ? `Rol ${rol.nombre}` : "Nuevo rol"} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{rol ? rol.nombre : "Nuevo rol"}</h2>
            <span className="crm-ficha__sub">{rol ? `${usan} ${usan === 1 ? "persona lo usa" : "personas lo usan"} (sin permisos a medida)` : "Elegí el nombre y qué módulos ve"}</span>
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="crm-ficha__cuerpo">
          <section className="crm-ficha__seccion">
            <label className="campo">
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Obra" autoFocus={!rol} />
            </label>
            <label className="campo">
              Descripción
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué hace y qué ve" />
            </label>
          </section>
          <section className="crm-ficha__seccion">
            <h3>Qué módulos ve</h3>
            <div className="ajustes__grilla">
              {porArea(datos.permisos).map(([area, lista]) => (
                <fieldset key={area}>
                  <legend>{area}</legend>
                  {lista.map((p) => (
                    <label key={p.clave} className="crm__check">
                      <input
                        type="checkbox"
                        checked={claves.has(p.clave)}
                        onChange={(e) => {
                          const s = new Set(claves);
                          if (e.target.checked) s.add(p.clave);
                          else s.delete(p.clave);
                          setClaves(s);
                        }}
                      />{" "}
                      {p.nombre}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            {claves.has("ajustes") && <p className="crm-ficha__sub">Con Ajustes, este rol puede editar usuarios (no los roles).</p>}
          </section>
          {error && <p className="oliver__error">{error}</p>}
          <div className="tarea-ficha__acciones">
            <button type="button" className="btn btn--primario btn--chico" disabled={ocupado || !nombre.trim()} onClick={() => void enviar("PUT")}>
              {ocupado ? "Guardando…" : rol ? "Guardar" : "Crear rol"}
            </button>
            {rol?.modificado && (
              <button type="button" className="btn btn--borde btn--chico" disabled={ocupado} onClick={() => window.confirm(`¿Volver ${rol.nombre} a como venía?`) && void enviar("DELETE")}>
                Volver a lo de fábrica
              </button>
            )}
            {rol && rol.deFabrica === false && (
              <button
                type="button"
                className="btn btn--texto btn--chico"
                disabled={ocupado}
                onClick={() => window.confirm(usan ? `¿Borrar ${rol.nombre}? ${usan} ${usan === 1 ? "persona queda" : "personas quedan"} sin permisos hasta que les asignes otro rol.` : `¿Borrar ${rol.nombre}?`) && void enviar("DELETE")}
              >
                Borrar rol
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function FichaUsuario({ u, datos, cerrar, guardado }: { u: UsuarioAjustes; datos: Datos; cerrar: () => void; guardado: (usuarios: UsuarioAjustes[]) => void }) {
  const esSuper = u.email === datos.superAdmin;
  const inicial = {
    nombre: u.config?.nombre ?? "",
    apellido: u.config?.apellido ?? "",
    usuario: u.config?.usuario ?? u.apodo,
    celular: u.config?.celular ?? "",
    horario: u.config?.horario ?? "",
    puesto: u.config?.puesto ?? "",
    rol: u.config?.rol && u.config.rol !== "super" ? u.config.rol : u.acceso.rol === "super" ? "admin" : u.acceso.rol,
  };
  const [f, setF] = useState(inicial);
  const [aMedida, setAMedida] = useState(!!u.config?.claves);
  const [claves, setClaves] = useState<Set<string>>(new Set(u.acceso.claves));
  const [todos, setTodos] = useState(!u.acceso.proyectos);
  const [proyectos, setProyectos] = useState<Set<string>>(new Set(u.acceso.proyectos ?? datos.proyectos.map((p) => p.id)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rol = datos.roles.find((r) => r.id === f.rol);
  const efectivas = useMemo(() => (aMedida ? claves : new Set(rol?.claves ?? [])), [aMedida, claves, rol]);
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const puedeEditar = !esSuper || datos.yo.superAdmin;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await leerJson<{ usuarios: UsuarioAjustes[] }>(
        await fetch("/api/ajustes/usuarios", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: u.email, ...f, claves: aMedida ? [...claves] : null, proyectos: todos ? null : [...proyectos] }),
        }),
      );
      guardado(r.usuarios);
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha" aria-label={`Usuario ${u.nombre}`} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{u.nombre}</h2>
            <span className="crm-ficha__sub">
              {u.email}
              {esSuper ? " · Super administrador (fijo)" : ""}
            </span>
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="crm-ficha__cuerpo">
          <section className="crm-ficha__seccion">
            <h3>Datos</h3>
            <div className="tarea-ficha__grilla">
              <label className="campo">
                Nombre
                <input value={f.nombre} onChange={(e) => poner("nombre", e.target.value)} />
              </label>
              <label className="campo">
                Apellido
                <input value={f.apellido} onChange={(e) => poner("apellido", e.target.value)} />
              </label>
              <label className="campo">
                @usuario (para mencionarlo)
                <input value={f.usuario} onChange={(e) => poner("usuario", e.target.value.replace(/\s/g, ""))} placeholder="Tadeo" />
              </label>
              <label className="campo">
                Celular
                <input inputMode="tel" value={f.celular} onChange={(e) => poner("celular", e.target.value)} />
              </label>
              <label className="campo">
                Horario de trabajo
                <input value={f.horario} onChange={(e) => poner("horario", e.target.value)} placeholder="Lun a vie, 9 a 18" />
              </label>
              <label className="campo">
                Puesto
                <input value={f.puesto} onChange={(e) => poner("puesto", e.target.value)} placeholder="Administración" />
              </label>
            </div>
          </section>

          {esSuper ? (
            <section className="crm-ficha__seccion">
              <h3>Permisos</h3>
              <p className="crm-ficha__sub">Es el super administrador: ve todo siempre, incluido Ajustes. No se puede cambiar desde acá.</p>
            </section>
          ) : (
            <>
              <section className="crm-ficha__seccion">
                <h3>Rol</h3>
                <select value={f.rol} onChange={(e) => poner("rol", e.target.value)} aria-label="Rol">
                  {datos.roles
                    .filter((r) => r.id !== "super")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                </select>
                {rol && <p className="crm-ficha__sub">{rol.descripcion}</p>}
              </section>

              <section className="crm-ficha__seccion">
                <h3>Qué módulos ve</h3>
                <label className="crm__check">
                  <input
                    type="checkbox"
                    checked={aMedida}
                    onChange={(e) => {
                      setAMedida(e.target.checked);
                      if (e.target.checked) setClaves(new Set(rol?.claves ?? []));
                    }}
                  />{" "}
                  Permisos a medida (si no, los del rol)
                </label>
                <div className="ajustes__grilla">
                  {porArea(datos.permisos).map(([area, lista]) => (
                    <fieldset key={area} disabled={!aMedida}>
                      <legend>{area}</legend>
                      {lista.map((p) => (
                        <label key={p.clave} className="crm__check">
                          <input
                            type="checkbox"
                            checked={efectivas.has(p.clave)}
                            onChange={(e) => {
                              const s = new Set(claves);
                              if (e.target.checked) s.add(p.clave);
                              else s.delete(p.clave);
                              setClaves(s);
                            }}
                          />{" "}
                          {p.nombre}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              </section>

              <section className="crm-ficha__seccion">
                <h3>Proyectos</h3>
                <label className="crm__check">
                  <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Todos (también los que se sumen)
                </label>
                {!todos &&
                  datos.proyectos.map((p) => (
                    <label key={p.id} className="crm__check">
                      <input
                        type="checkbox"
                        checked={proyectos.has(p.id)}
                        onChange={(e) => {
                          const s = new Set(proyectos);
                          if (e.target.checked) s.add(p.id);
                          else s.delete(p.id);
                          setProyectos(s);
                        }}
                      />{" "}
                      {p.nombre}
                    </label>
                  ))}
              </section>
            </>
          )}
          {error && <p className="oliver__error">{error}</p>}
          {puedeEditar && (
            <div className="tarea-ficha__acciones">
              <button type="button" className="btn btn--primario btn--chico" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" className="btn btn--texto btn--chico" onClick={cerrar}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
