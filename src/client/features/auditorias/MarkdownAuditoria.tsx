import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MARKDOWN_COMPONENTS } from "@/client/components/Markdown";
import { criarAncorador } from "./sumario";

/** O texto visível do título, por mais aninhado que venha (negrito, código). */
function textoDe(no: ReactNode): string {
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map((n: ReactNode) => textoDe(n)).join("");
  if (isValidElement<{ children?: ReactNode }>(no)) {
    return textoDe(no.props.children);
  }
  return "";
}

/**
 * Markdown do entregável. Imagem não sai: o entregável vem do bucket e uma
 * `<img>` com endereço externo seria uma requisição que ninguém pediu. O `id`
 * do `<h2>` sai do mesmo ancorador do sumário, então `-2`, `-3` batem.
 */
export function MarkdownAuditoria({ texto }: { texto: string }) {
  const proxima = criarAncorador();
  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          ...MARKDOWN_COMPONENTS,
          img: () => null,
          h2: ({ children }: { children?: ReactNode }) => (
            <h2
              id={proxima(textoDe(children))}
              className="mt-6 mb-2 scroll-mt-4 text-base font-semibold first:mt-0"
            >
              {children}
            </h2>
          ),
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
