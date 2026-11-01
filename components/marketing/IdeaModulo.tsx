import type { IdeaModulo } from "@/lib/marketing/ideas";
import { Icono } from "../Icono";

/** La tarjeta con la idea de un submódulo de marketing (mientras se construye): para arrancar. */
export function TarjetaIdea({ idea }: { idea: IdeaModulo }) {
  return (
    <article className="idea-mk">
      <header className="idea-mk__cabeza">
        <span className="idea-mk__sello">
          <Icono nombre="ensayo" size={14} /> La idea · para arrancar
        </span>
        <p className="idea-mk__objetivo">{idea.objetivo}</p>
      </header>

      <section className="idea-mk__bloque">
        <h2>Qué va a tener, de menos a más</h2>
        <ol className="idea-mk__etapas">
          {idea.etapas.map((e) => (
            <li key={e.nombre} className="idea-mk__etapa">
              <h3>{e.nombre}</h3>
              <ul>
                {e.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {idea.agente && (
        <section className="idea-mk__bloque idea-mk__agente">
          <h2>
            <Icono nombre="mensaje" size={16} /> Agente: {idea.agente.nombre}
          </h2>
          <div className="idea-mk__dos">
            <div>
              <h3>Qué hace</h3>
              <ul>
                {idea.agente.hace.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Qué no hace</h3>
              <ul>
                {idea.agente.limites.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="idea-mk__bloque">
        <h2>Con qué se conecta</h2>
        <ul className="idea-mk__integraciones">
          {idea.integraciones.map((i) => (
            <li key={i.nombre}>
              <strong>{i.nombre}</strong>
              <span>Para {i.para}.</span>
              {i.nota && <small>{i.nota}</small>}
            </li>
          ))}
        </ul>
      </section>

      <section className="idea-mk__bloque">
        <h2>
          <Icono nombre="ayuda" size={16} /> Para decidir
        </h2>
        <ul className="idea-mk__decisiones">
          {idea.decisiones.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <footer className="idea-mk__primer-paso">
        <Icono nombre="flecha" size={18} />
        <div>
          <strong>Primer paso</strong>
          <span>{idea.primerPaso}</span>
        </div>
      </footer>
    </article>
  );
}
