import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MARKDOWN_COMPONENTS } from "@/client/components/Markdown";
import { rehypeAncoras } from "./sumario";

/** O `id` chega pronto do `rehypeAncoras`; aqui só se desenha. */
function TituloAncorado({ id, children }: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      id={id}
      className="mt-6 mb-2 scroll-mt-4 text-base font-semibold first:mt-0"
    >
      {children}
    </h2>
  );
}

function SemImagem() {
  return null;
}

// Fora do componente: um objeto novo a cada render faria o React tratar cada
// título como outro tipo de componente e remontá-lo a cada refetch.
const COMPONENTES = {
  ...MARKDOWN_COMPONENTS,
  // Imagem não sai: o entregável vem do bucket e uma `<img>` com endereço
  // externo seria uma requisição que ninguém pediu.
  img: SemImagem,
  h2: TituloAncorado,
};

const REMARK = [remarkGfm];
const REHYPE = [rehypeAncoras];

/**
 * Markdown do entregável. Os ids dos `<h2>` saem do mesmo ancorador do
 * sumário, então `-2`, `-3` batem com os links do topo.
 */
export function MarkdownAuditoria({ texto }: { texto: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={COMPONENTES}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
