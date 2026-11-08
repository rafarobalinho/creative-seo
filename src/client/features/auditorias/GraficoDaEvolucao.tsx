import { Line, LineChart } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import { dataCurta, dataLonga, decimal } from "@/shared/auditorias/formatos";
import type { PontoDaSerie } from "@/shared/auditorias/serie";

const CONFIG_DO_GRAFICO: ChartConfig = {
  agregado: { label: "Score agregado" },
};

type PontoDoGrafico = {
  rotulo: string;
  ciclo: string;
  agregado: number | null;
  /** Mediu eixos diferentes do ciclo anterior: o ponto sai vazado. */
  diferente: boolean;
};

type PropsDoPonto = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: PontoDoGrafico;
};

function PontoDaLinha({ cx, cy, index, payload }: PropsDoPonto) {
  if (cx === undefined || cy === undefined || payload === undefined) {
    return <g key={index} />;
  }
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={4}
      strokeWidth={2}
      stroke="var(--color-agregado)"
      fill={payload.diferente ? "var(--background)" : "var(--color-agregado)"}
    />
  );
}

/** O tooltip entrega o ponto como `unknown`; lê só o ciclo, se ele for texto. */
function cicloDoItem(item: unknown): string {
  if (typeof item !== "object" || item === null || !("payload" in item)) {
    return "";
  }
  const { payload } = item;
  if (typeof payload !== "object" || payload === null) return "";
  return "ciclo" in payload && typeof payload.ciclo === "string"
    ? payload.ciclo
    : "";
}

/** O gráfico é uma imagem para leitor de tela; a tabela de comparação traz os valores. */
function resumoDoGrafico(dados: PontoDoGrafico[]): string {
  const comScore = dados.filter((d) => d.agregado !== null);
  const primeiro = comScore[0];
  const ultimo = comScore.at(-1);
  if (primeiro === undefined || ultimo === undefined) {
    return "Gráfico do score agregado por ciclo, sem valores lidos.";
  }
  if (primeiro === ultimo) {
    return `Gráfico do score agregado: ${decimal(ultimo.agregado)} no ciclo de ${dataLonga(ultimo.ciclo)}.`;
  }
  return `Gráfico do score agregado por ciclo, de ${decimal(primeiro.agregado)} em ${dataLonga(primeiro.ciclo)} a ${decimal(ultimo.agregado)} em ${dataLonga(ultimo.ciclo)}.`;
}

export function GraficoDaEvolucao({ pontos }: { pontos: PontoDaSerie[] }) {
  const dados: PontoDoGrafico[] = pontos.map((p) => ({
    rotulo: dataCurta(p.ciclo),
    ciclo: p.ciclo,
    agregado: p.agregado,
    diferente: p.anterior !== null && !p.comparavelComAnterior,
  }));

  return (
    <div className="space-y-1">
      <div role="img" aria-label={resumoDoGrafico(dados)}>
        <ChartContainer config={CONFIG_DO_GRAFICO} className="h-48">
          <LineChart
            data={dados}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <ChartGrid />
            <ChartXAxis dataKey="rotulo" />
            <ChartYAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              width={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, itens) =>
                    dataLonga(cicloDoItem(itens[0]))
                  }
                  valueFormatter={(v) =>
                    decimal(typeof v === "number" ? v : null)
                  }
                />
              }
            />
            <Line
              type="monotone"
              dataKey="agregado"
              stroke="var(--color-agregado)"
              strokeWidth={2}
              dot={PontoDaLinha}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
      {dados.some((d) => d.diferente) ? (
        <p className="text-xs text-muted-foreground">
          Ponto vazado: o ciclo mediu eixos diferentes do anterior.
        </p>
      ) : null}
    </div>
  );
}
