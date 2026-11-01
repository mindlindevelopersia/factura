import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EtiquetaBeta } from "@/components/Beta";
import { TarjetaIdea } from "@/components/marketing/IdeaModulo";
import { requireRuta } from "@/lib/auth/session";
import { IDEAS } from "@/lib/marketing/ideas";

export function generateStaticParams() {
  return IDEAS.map((i) => ({ sub: i.sub }));
}

export async function generateMetadata({ params }: { params: Promise<{ sub: string }> }): Promise<Metadata> {
  const { sub } = await params;
  return { title: IDEAS.find((i) => i.sub === sub)?.nombre ?? "Marketing" };
}

export default async function SubmoduloMarketing({ params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const idea = IDEAS.find((i) => i.sub === sub);
  if (!idea) notFound();
  await requireRuta(`/marketing/${idea.sub}`);
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">HQ · Marketing</span>
          <h1>
            {idea.nombre} <EtiquetaBeta />
          </h1>
          <p>{idea.resumen}</p>
        </div>
      </div>
      <TarjetaIdea idea={idea} />
    </main>
  );
}
